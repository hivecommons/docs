/**
 * NPS relay for standalone hives (hivecommons/hive#9619).
 *
 * A hive that is connected to a hub forwards its dashboard NPS responses to
 * that hub directly. A standalone hive has no hub link, so, when its operator
 * opts in, it posts them here instead. The hivecommons hub then pulls the
 * entries from this relay and deletes them once stored.
 *
 * Endpoints (all JSON, server-to-server only, no CORS):
 *
 *   POST /api/nps          submit one response. Auth: a per-install token.
 *   GET  /api/nps/pending  the hub pulls up to `limit` entries, oldest first.
 *                          Auth: the hub pull secret.
 *   POST /api/nps/ack      the hub deletes the entries it has stored.
 *                          Auth: the hub pull secret.
 *
 * There is deliberately NO public read path: GET /api/nps is 405
 * (kubestellar/console#16486 served free text to anyone).
 *
 * Security properties (the kubestellar/console NPS function shipped without
 * each of these):
 *   - Submissions need an allowlisted per-install token (console#13664,
 *     console#13758). Only SHA-256 hashes of tokens are configured here.
 *   - Per-IP rate limit, 1 submission per 24h, plus a per-install cap.
 *     IPs are stored only as hashes.
 *   - Bodies are capped by the bytes actually READ, never by Content-Length,
 *     so a chunked or lying request cannot make the function buffer more
 *     (console#16666).
 *   - Score must be an integer 1-4; feedback at most 500 characters.
 *   - Entries live in Netlify Blobs as a rolling window.
 *
 * Operator setup (Netlify site environment variables):
 *
 *   NPS_RELAY_INSTALL_TOKENS    comma- or newline-separated `label:sha256hex`
 *                               entries, one per install allowed to submit.
 *   NPS_RELAY_HUB_SECRET_SHA256 sha256 hex of the hub pull secret.
 *
 * Issuing a token to a standalone hive operator (phase 1, admin-issued):
 *
 *   TOKEN=$(openssl rand -hex 32)
 *   printf '%s' "$TOKEN" | sha256sum        # -> <hash>
 *   # append `<install-label>:<hash>` to NPS_RELAY_INSTALL_TOKENS, redeploy,
 *   # and send $TOKEN privately to the hive operator, who sets
 *   # HIVE_NPS_RELAY_TOKEN (and HIVE_NPS_RELAY_URL, HIVE_NPS_ENABLED=true).
 *
 * Revoking a token is removing its entry. The hub pull secret is generated
 * the same way; the hub gets the raw secret as HIVE_NPS_RELAY_PULL_SECRET and
 * this site gets its hash as NPS_RELAY_HUB_SECRET_SHA256.
 */

import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'

// ── Constants ────────────────────────────────────────────────────────

/** Public route of the submit endpoint; the hub routes hang off it. */
export const RELAY_BASE_PATH = '/api/nps'
export const PENDING_PATH = `${RELAY_BASE_PATH}/pending`
export const ACK_PATH = `${RELAY_BASE_PATH}/ack`

/** Netlify Blobs store holding entries and rate-limit counters. */
export const STORE_NAME = 'hive-nps-relay'
/** Key prefix of stored entries. Keys sort oldest first. */
export const ENTRY_PREFIX = 'entry/'
/** Key prefix of per-IP rate-limit records (IP is hashed). */
export const IP_RATE_PREFIX = 'rate/ip/'
/** Key prefix of per-install rate-limit records. */
export const INSTALL_RATE_PREFIX = 'rate/install/'

/** Env var: allowlist of `label:sha256hex` install token hashes. */
export const INSTALL_TOKENS_ENV = 'NPS_RELAY_INSTALL_TOKENS'
/** Env var: sha256 hex of the hub pull secret. */
export const HUB_SECRET_HASH_ENV = 'NPS_RELAY_HUB_SECRET_SHA256'

/** Maximum bytes read from a submission body. */
export const MAX_SUBMIT_BODY_BYTES = 4_096
/** Maximum bytes read from an ack body (a full batch of ids fits). */
export const MAX_ACK_BODY_BYTES = 16_384
/** Maximum feedback length, in characters (code points). */
export const MAX_FEEDBACK_CHARS = 500
/** Maximum stored dashboard version length. */
export const MAX_VERSION_CHARS = 64
/** Maximum hive id length (matches the hub's name rule). */
export const MAX_HIVE_ID_CHARS = 100
/** Valid score range: the 4-point emoji scale. */
export const SCORE_MIN = 1
export const SCORE_MAX = 4

/** Rolling window: at most this many entries are kept, oldest dropped. */
export const MAX_ENTRIES = 1_000
/** Most entries one pull returns (and the default). */
export const MAX_PULL_BATCH = 100

/** Rate-limit window for submissions. */
export const RATE_WINDOW_MS = 24 * 60 * 60 * 1000
/** Submissions accepted per client IP per window. */
export const MAX_PER_IP_PER_WINDOW = 1
/** Submissions accepted per install token per window (bounds a leaked token). */
export const MAX_PER_INSTALL_PER_WINDOW = 10

/** Length of a sha256 hex digest. */
const SHA256_HEX_LENGTH = 64
/** Width the millisecond timestamp in an entry id is zero-padded to. */
const ENTRY_ID_TIME_WIDTH = 13

const HIVE_ID_PATTERN = /^[A-Za-z0-9._-]+$/
const INSTALL_LABEL_PATTERN = /^[A-Za-z0-9._-]{1,64}$/
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/
/** Entry ids are `<zero-padded ms>-<uuid>`; also the hub's accepted id shape. */
const ENTRY_ID_PATTERN = /^\d{13}-[0-9a-f-]{36}$/
const VERSION_DISALLOWED = /[^A-Za-z0-9._/-]/g
/** Control characters other than newline and tab. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000b-\u001f\u007f]/g

// ── Types ────────────────────────────────────────────────────────────

/** The subset of the Netlify Blobs store API the relay uses. */
export interface RelayStore {
  get(key: string, options: { type: 'json' }): Promise<unknown>
  setJSON(key: string, value: unknown): Promise<unknown>
  delete(key: string): Promise<unknown>
  list(options: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }>
}

export interface RelayEnv {
  installTokens?: string
  hubSecretHash?: string
}

export interface RelayDeps {
  store: RelayStore
  env: RelayEnv
  /** Client IP as reported by the platform; undefined when unknown. */
  clientIp?: string
  now?: () => number
}

/** One stored entry, exactly as the hub pull returns it. */
export interface RelayEntry {
  id: string
  install_id: string
  hive_id: string
  score: number
  feedback?: string
  dashboard_version?: string
  timestamp: string
}

interface RateRecord {
  times: number[]
}

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`request body exceeds ${maxBytes} bytes`)
    this.name = 'BodyTooLargeError'
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** Constant-time comparison of two sha256 hex digests. */
function hashesEqual(a: string, b: string): boolean {
  if (a.length !== SHA256_HEX_LENGTH || b.length !== SHA256_HEX_LENGTH) return false
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'))
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') ?? ''
  const match = /^Bearer (.+)$/.exec(auth)
  const token = match?.[1]?.trim()
  return token ? token : null
}

/**
 * Parses NPS_RELAY_INSTALL_TOKENS. Malformed entries are ignored, so a typo
 * can only fail closed.
 */
export function parseInstallTokens(raw: string | undefined): Array<{ label: string; hash: string }> {
  if (!raw) return []
  const out: Array<{ label: string; hash: string }> = []
  for (const part of raw.split(/[\s,]+/)) {
    const sep = part.lastIndexOf(':')
    if (sep <= 0) continue
    const label = part.slice(0, sep)
    const hash = part.slice(sep + 1).toLowerCase()
    if (INSTALL_LABEL_PATTERN.test(label) && SHA256_HEX_PATTERN.test(hash)) {
      out.push({ label, hash })
    }
  }
  return out
}

/** Returns the install label for a presented token, or null. */
export function matchInstallToken(token: string, raw: string | undefined): string | null {
  const presented = sha256Hex(token)
  let matched: string | null = null
  // Compare against every entry (no early exit) so timing does not reveal
  // the position of a match.
  for (const { label, hash } of parseInstallTokens(raw)) {
    if (hashesEqual(presented, hash) && matched === null) matched = label
  }
  return matched
}

function hubSecretMatches(token: string, rawHash: string | undefined): boolean {
  const expected = (rawHash ?? '').trim().toLowerCase()
  if (!SHA256_HEX_PATTERN.test(expected)) return false
  return hashesEqual(sha256Hex(token), expected)
}

/**
 * Reads a request body, enforcing the cap on bytes actually read. The
 * Content-Length header is never consulted.
 */
export async function readCappedText(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        throw new BodyTooLargeError(maxBytes)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const combined = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(combined)
}

async function readCappedJson(req: Request, maxBytes: number): Promise<unknown> {
  return JSON.parse(await readCappedText(req, maxBytes))
}

function newEntryId(now: number): string {
  return `${String(now).padStart(ENTRY_ID_TIME_WIDTH, '0')}-${randomUUID()}`
}

async function entryKeysOldestFirst(store: RelayStore): Promise<string[]> {
  const { blobs } = await store.list({ prefix: ENTRY_PREFIX })
  return blobs.map((b) => b.key).sort()
}

/** Timestamps inside the window, from a stored rate record. */
async function recentTimes(store: RelayStore, key: string, now: number): Promise<number[]> {
  const rec = (await store.get(key, { type: 'json' })) as RateRecord | null
  const times = rec && Array.isArray(rec.times) ? rec.times : []
  return times.filter((t) => typeof t === 'number' && now - t < RATE_WINDOW_MS)
}

// ── Validation ───────────────────────────────────────────────────────

type Submission = Pick<RelayEntry, 'hive_id' | 'score' | 'feedback' | 'dashboard_version'>

/** Validates a submission body; returns the clean fields or an error. */
export function validateSubmission(body: unknown): { ok: true; value: Submission } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' }
  }
  const b = body as Record<string, unknown>
  const hiveId = b.hive_id
  if (
    typeof hiveId !== 'string' ||
    hiveId.length === 0 ||
    hiveId.length > MAX_HIVE_ID_CHARS ||
    !HIVE_ID_PATTERN.test(hiveId)
  ) {
    return { ok: false, error: 'invalid hive_id' }
  }
  const score = b.score
  if (typeof score !== 'number' || !Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) {
    return { ok: false, error: `score must be an integer ${SCORE_MIN}-${SCORE_MAX}` }
  }
  let feedback: string | undefined
  if (b.feedback !== undefined && b.feedback !== null) {
    if (typeof b.feedback !== 'string') return { ok: false, error: 'feedback must be a string' }
    if ([...b.feedback].length > MAX_FEEDBACK_CHARS) {
      return { ok: false, error: `feedback must be at most ${MAX_FEEDBACK_CHARS} characters` }
    }
    const cleaned = b.feedback.replace(CONTROL_CHARS, '').trim()
    feedback = cleaned || undefined
  }
  let version: string | undefined
  if (typeof b.dashboard_version === 'string') {
    version = b.dashboard_version.replace(VERSION_DISALLOWED, '').slice(0, MAX_VERSION_CHARS) || undefined
  }
  return { ok: true, value: { hive_id: hiveId, score, feedback, dashboard_version: version } }
}

// ── Handlers ─────────────────────────────────────────────────────────

async function handleSubmit(req: Request, deps: RelayDeps, now: number): Promise<Response> {
  const { store, env } = deps
  if (parseInstallTokens(env.installTokens).length === 0) {
    return json(503, { error: 'relay submissions are not configured' })
  }
  // Authenticate before touching storage, so unauthenticated callers cannot
  // make the relay write anything (not even rate-limit records).
  const token = bearerToken(req)
  const installId = token ? matchInstallToken(token, env.installTokens) : null
  if (!installId) return json(401, { error: 'unauthorized' })

  const ipKey = `${IP_RATE_PREFIX}${sha256Hex(deps.clientIp || 'unknown')}`
  const ipTimes = await recentTimes(store, ipKey, now)
  if (ipTimes.length >= MAX_PER_IP_PER_WINDOW) {
    return json(429, { error: 'rate limit exceeded' })
  }

  let body: unknown
  try {
    body = await readCappedJson(req, MAX_SUBMIT_BODY_BYTES)
  } catch (err) {
    if (err instanceof BodyTooLargeError) return json(413, { error: 'payload too large' })
    return json(400, { error: 'invalid JSON body' })
  }
  const parsed = validateSubmission(body)
  if (!parsed.ok) return json(400, { error: parsed.error })

  const installKey = `${INSTALL_RATE_PREFIX}${installId}`
  const installTimes = await recentTimes(store, installKey, now)
  if (installTimes.length >= MAX_PER_INSTALL_PER_WINDOW) {
    return json(429, { error: 'rate limit exceeded' })
  }

  const entry: RelayEntry = {
    id: newEntryId(now),
    install_id: installId,
    hive_id: parsed.value.hive_id,
    score: parsed.value.score,
    ...(parsed.value.feedback ? { feedback: parsed.value.feedback } : {}),
    ...(parsed.value.dashboard_version ? { dashboard_version: parsed.value.dashboard_version } : {}),
    timestamp: new Date(now).toISOString(),
  }
  await store.setJSON(`${ENTRY_PREFIX}${entry.id}`, entry)
  await store.setJSON(ipKey, { times: [...ipTimes, now] })
  await store.setJSON(installKey, { times: [...installTimes, now] })

  // Rolling window: drop the oldest entries beyond the cap.
  const keys = await entryKeysOldestFirst(store)
  const overflow = keys.length - MAX_ENTRIES
  if (overflow > 0) {
    await Promise.allSettled(keys.slice(0, overflow).map((key) => store.delete(key)))
  }
  return json(201, { ok: true })
}

function hubAuthorized(req: Request, env: RelayEnv): Response | null {
  if (!SHA256_HEX_PATTERN.test((env.hubSecretHash ?? '').trim().toLowerCase())) {
    return json(503, { error: 'relay pull is not configured' })
  }
  const token = bearerToken(req)
  if (!token || !hubSecretMatches(token, env.hubSecretHash)) {
    return json(401, { error: 'unauthorized' })
  }
  return null
}

async function handlePending(req: Request, deps: RelayDeps): Promise<Response> {
  const denied = hubAuthorized(req, deps.env)
  if (denied) return denied
  const requested = Number.parseInt(new URL(req.url).searchParams.get('limit') ?? '', 10)
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MAX_PULL_BATCH) : MAX_PULL_BATCH
  const keys = (await entryKeysOldestFirst(deps.store)).slice(0, limit)
  const entries: RelayEntry[] = []
  for (const key of keys) {
    const entry = (await deps.store.get(key, { type: 'json' })) as RelayEntry | null
    if (entry) entries.push(entry)
  }
  return json(200, { entries })
}

async function handleAck(req: Request, deps: RelayDeps): Promise<Response> {
  const denied = hubAuthorized(req, deps.env)
  if (denied) return denied
  let body: unknown
  try {
    body = await readCappedJson(req, MAX_ACK_BODY_BYTES)
  } catch (err) {
    if (err instanceof BodyTooLargeError) return json(413, { error: 'payload too large' })
    return json(400, { error: 'invalid JSON body' })
  }
  const ids = (body as { ids?: unknown } | null)?.ids
  if (!Array.isArray(ids) || ids.length > MAX_PULL_BATCH) {
    return json(400, { error: `ids must be an array of at most ${MAX_PULL_BATCH} entry ids` })
  }
  const valid = ids.filter((id): id is string => typeof id === 'string' && ENTRY_ID_PATTERN.test(id))
  await Promise.all(valid.map((id) => deps.store.delete(`${ENTRY_PREFIX}${id}`)))
  return json(200, { deleted: valid.length })
}

/** Routes one request. The Netlify function is a thin wrapper around this. */
export async function handleRelayRequest(req: Request, deps: RelayDeps): Promise<Response> {
  const now = (deps.now ?? Date.now)()
  const path = new URL(req.url).pathname.replace(/\/+$/, '')
  try {
    if (path === RELAY_BASE_PATH) {
      if (req.method !== 'POST') return json(405, { error: 'method not allowed' })
      return await handleSubmit(req, deps, now)
    }
    if (path === PENDING_PATH) {
      if (req.method !== 'GET') return json(405, { error: 'method not allowed' })
      return await handlePending(req, deps)
    }
    if (path === ACK_PATH) {
      if (req.method !== 'POST') return json(405, { error: 'method not allowed' })
      return await handleAck(req, deps)
    }
    return json(404, { error: 'not found' })
  } catch (err) {
    // Never echo request data (tokens live in headers) into logs.
    console.error('nps relay: internal error:', err instanceof Error ? err.name : 'unknown')
    return json(500, { error: 'internal server error' })
  }
}
