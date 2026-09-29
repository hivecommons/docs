import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACK_PATH,
  ENTRY_PREFIX,
  HEADER_INSTALL_ID,
  HEADER_NONCE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  INSTALL_PREFIX,
  MAX_ENTRIES,
  MAX_FEEDBACK_CHARS,
  MAX_NONCES_PER_INSTALL,
  MAX_PER_INSTALL_PER_WINDOW,
  MAX_PULL_BATCH,
  MAX_REGISTER_BODY_BYTES,
  MAX_REGISTRATIONS_PER_DAY,
  MAX_REGISTRATIONS_PER_IP_PER_WINDOW,
  MAX_SUBMIT_BODY_BYTES,
  NONCE_PREFIX,
  PENDING_PATH,
  PURPOSE_REGISTER,
  PURPOSE_SUBMIT,
  RATE_WINDOW_MS,
  REGISTER_DAY_PREFIX,
  REGISTER_PATH,
  RELAY_BASE_PATH,
  SIGNATURE_MAX_SKEW_MS,
  UNKNOWN_INSTALL_CODE,
  handleRelayRequest,
  signingInput,
  validateRegistration,
  verifyEd25519,
  type InstallRecord,
  type RelayDeps,
  type RelayEntry,
  type RelayStore,
} from './relay'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ORIGIN = 'https://relay.test'
const HUB_SECRET = 'hub-pull-secret-for-tests'
const T0 = Date.UTC(2026, 8, 29, 12, 0, 0)
const MS_PER_SECOND = 1000
const NONCE_BYTES = 16

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** In-memory stand-in for the Netlify Blobs store. */
class MemoryStore implements RelayStore {
  data = new Map<string, unknown>()
  writes = 0

  async get(key: string): Promise<unknown> {
    return this.data.has(key) ? JSON.parse(JSON.stringify(this.data.get(key))) : null
  }

  async setJSON(key: string, value: unknown): Promise<void> {
    this.writes++
    this.data.set(key, JSON.parse(JSON.stringify(value)))
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key)
  }

  async list({ prefix }: { prefix: string }): Promise<{ blobs: Array<{ key: string }> }> {
    return { blobs: [...this.data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) }
  }

  entries(): RelayEntry[] {
    return [...this.data.entries()]
      .filter(([k]) => k.startsWith(ENTRY_PREFIX))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v as RelayEntry)
  }
}

/** A test hive: an install id plus an Ed25519 keypair. */
interface Hive {
  installId: string
  publicKey: string
  privateKey: KeyObject
}

let uuidCounter = 0
function newHive(): Hive {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const der = publicKey.export({ format: 'der', type: 'spki' })
  uuidCounter++
  return {
    installId: `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`,
    // The raw 32-byte key is the tail of the SPKI DER encoding.
    publicKey: der.subarray(der.length - 32).toString('base64'),
    privateKey,
  }
}

let store: MemoryStore
let now: number
let hive: Hive

function deps(overrides: Partial<RelayDeps> = {}): RelayDeps {
  return {
    store,
    env: { hubSecretHash: sha256(HUB_SECRET) },
    clientIp: '203.0.113.7',
    now: () => now,
    ...overrides,
  }
}

interface SignOptions {
  signer?: Hive
  /** Install id placed in the header (defaults to the signer's). */
  headerInstallId?: string
  timestampMs?: number
  nonce?: string
  /** Sign these bytes instead of the body actually sent. */
  signedBody?: string
  purpose?: string
  omit?: string
}

function signedHeaders(body: string, purpose: string, opts: SignOptions = {}): Record<string, string> {
  const signer = opts.signer ?? hive
  const installId = opts.headerInstallId ?? signer.installId
  const ts = String(Math.floor((opts.timestampMs ?? now) / MS_PER_SECOND))
  const nonce = opts.nonce ?? randomBytes(NONCE_BYTES).toString('hex')
  const message = signingInput(opts.purpose ?? purpose, installId, ts, nonce, Buffer.from(opts.signedBody ?? body, 'utf8'))
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    [HEADER_INSTALL_ID]: installId,
    [HEADER_TIMESTAMP]: ts,
    [HEADER_NONCE]: nonce,
    [HEADER_SIGNATURE]: sign(null, message, signer.privateKey).toString('base64'),
  }
  if (opts.omit) delete headers[opts.omit]
  return headers
}

function register(target: Hive = hive, opts: SignOptions = {}, bodyOverride?: unknown): Request {
  const body = JSON.stringify(
    bodyOverride ?? { install_id: target.installId, public_key: target.publicKey, hive_version: 'abc1234' },
  )
  return new Request(ORIGIN + REGISTER_PATH, {
    method: 'POST',
    headers: signedHeaders(body, PURPOSE_REGISTER, { signer: target, ...opts }),
    body,
  })
}

function submit(body: unknown, opts: SignOptions = {}): Request {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  return new Request(ORIGIN + RELAY_BASE_PATH, {
    method: 'POST',
    headers: signedHeaders(raw, PURPOSE_SUBMIT, opts),
    body: raw,
  })
}

function pending(token: string | null = HUB_SECRET, query = ''): Request {
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  return new Request(ORIGIN + PENDING_PATH + query, { method: 'GET', headers })
}

function ack(ids: unknown, token: string | null = HUB_SECRET): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return new Request(ORIGIN + ACK_PATH, { method: 'POST', headers, body: JSON.stringify({ ids }) })
}

async function registerOk(target: Hive = hive, ip = '198.18.0.1'): Promise<void> {
  const res = await handleRelayRequest(register(target), deps({ clientIp: ip }))
  expect(res.status).toBe(201)
}

const GOOD = { hive_id: 'solo-hive', score: 4, feedback: 'works well', dashboard_version: 'abc1234' }

beforeEach(() => {
  store = new MemoryStore()
  now = T0
  hive = newHive()
})

describe('signing contract', () => {
  it('matches the byte string the hive signs (src/pkg/dashboard/nps_relay.go)', () => {
    const got = signingInput(
      PURPOSE_SUBMIT,
      '11111111-2222-4333-8444-555555555555',
      '1790000000',
      '00112233445566778899aabbccddeeff',
      Buffer.from('{}', 'utf8'),
    ).toString('utf8')
    expect(got).toBe(
      'hive-nps-relay-v1\nsubmit\n11111111-2222-4333-8444-555555555555\n1790000000\n' +
        '00112233445566778899aabbccddeeff\n44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a',
    )
  })

  it('verifies a real Ed25519 signature and rejects anything malformed', () => {
    const msg = Buffer.from('hello', 'utf8')
    const sig = sign(null, msg, hive.privateKey).toString('base64')
    expect(verifyEd25519(hive.publicKey, msg, sig)).toBe(true)
    expect(verifyEd25519(hive.publicKey, Buffer.from('hellO', 'utf8'), sig)).toBe(false)
    expect(verifyEd25519(newHive().publicKey, msg, sig)).toBe(false)
    expect(verifyEd25519('not base64!', msg, sig)).toBe(false)
    expect(verifyEd25519(hive.publicKey, msg, 'AAAA')).toBe(false)
    expect(verifyEd25519(Buffer.alloc(31).toString('base64'), msg, sig)).toBe(false)
  })
})

describe('POST /api/nps/register', () => {
  it('registers a new install with no operator configuration', async () => {
    const res = await handleRelayRequest(register(), deps({ env: {} }))
    expect(res.status).toBe(201)
    const rec = store.data.get(`${INSTALL_PREFIX}${hive.installId}`) as InstallRecord
    expect(rec).toMatchObject({ public_key: hive.publicKey, hive_version: 'abc1234', registered_at: new Date(T0).toISOString() })
    // The client IP is stored only as a hash.
    expect([...store.data.keys()].some((k) => k.includes('203.0.113.7'))).toBe(false)
  })

  it('is idempotent for the same install id and key, without consuming quota', async () => {
    await registerOk()
    const writes = store.writes
    for (let i = 0; i < MAX_REGISTRATIONS_PER_IP_PER_WINDOW + 1; i++) {
      const res = await handleRelayRequest(register(), deps({ clientIp: '198.18.0.1' }))
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ ok: true, registered: false })
    }
    expect(store.writes).toBe(writes)
  })

  it('rejects a different key for an existing install id (no takeover)', async () => {
    await registerOk()
    const attacker = { ...newHive(), installId: hive.installId }
    const res = await handleRelayRequest(register(attacker), deps({ clientIp: '198.51.100.9' }))
    expect(res.status).toBe(409)
    expect((store.data.get(`${INSTALL_PREFIX}${hive.installId}`) as InstallRecord).public_key).toBe(hive.publicKey)
  })

  it('requires proof of possession of the registered key', async () => {
    const other = newHive()
    // Body registers hive's key, but the request is signed by another key.
    const body = { install_id: hive.installId, public_key: hive.publicKey }
    const forged = register(hive, { signer: other, headerInstallId: hive.installId }, body)
    expect((await handleRelayRequest(forged, deps())).status).toBe(401)
    // Header install id must match the body's.
    const mismatch = register(hive, { headerInstallId: other.installId })
    expect((await handleRelayRequest(mismatch, deps())).status).toBe(401)
    // Missing signature, stale timestamp.
    expect((await handleRelayRequest(register(hive, { omit: HEADER_SIGNATURE }), deps())).status).toBe(401)
    const stale = register(hive, { timestampMs: T0 - SIGNATURE_MAX_SKEW_MS - MS_PER_SECOND })
    expect((await handleRelayRequest(stale, deps())).status).toBe(401)
    // A submit-purpose signature cannot register.
    expect((await handleRelayRequest(register(hive, { purpose: PURPOSE_SUBMIT }), deps())).status).toBe(401)
    expect(store.writes).toBe(0)
  })

  it('validates the registration body', async () => {
    expect(validateRegistration({ install_id: 'NOT-A-UUID', public_key: hive.publicKey }).ok).toBe(false)
    expect(validateRegistration({ install_id: hive.installId.toUpperCase(), public_key: hive.publicKey }).ok).toBe(false)
    expect(validateRegistration({ install_id: hive.installId, public_key: 'AAAA' }).ok).toBe(false)
    expect(validateRegistration({ install_id: hive.installId, public_key: 42 }).ok).toBe(false)
    expect(validateRegistration([hive.installId]).ok).toBe(false)
    const res = await handleRelayRequest(register(hive, {}, { install_id: hive.installId, public_key: 'short' }), deps())
    expect(res.status).toBe(400)
    const huge = register(hive, {}, { install_id: hive.installId, public_key: hive.publicKey, pad: 'x'.repeat(MAX_REGISTER_BODY_BYTES) })
    expect((await handleRelayRequest(huge, deps())).status).toBe(413)
    expect(store.writes).toBe(0)
  })

  it('rate limits new registrations per IP per 24h', async () => {
    for (let i = 0; i < MAX_REGISTRATIONS_PER_IP_PER_WINDOW; i++) {
      expect((await handleRelayRequest(register(newHive()), deps())).status).toBe(201)
    }
    const extra = newHive()
    expect((await handleRelayRequest(register(extra), deps())).status).toBe(429)
    expect(store.data.has(`${INSTALL_PREFIX}${extra.installId}`)).toBe(false)
    // Another IP is not affected; the first IP recovers after the window.
    expect((await handleRelayRequest(register(extra), deps({ clientIp: '198.51.100.3' }))).status).toBe(201)
    now = T0 + RATE_WINDOW_MS
    expect((await handleRelayRequest(register(newHive()), deps())).status).toBe(201)
  })

  it('caps new registrations per day globally', async () => {
    const dayKey = `${REGISTER_DAY_PREFIX}${new Date(T0).toISOString().slice(0, 10)}`
    store.data.set(dayKey, { count: MAX_REGISTRATIONS_PER_DAY - 1 })
    expect((await handleRelayRequest(register(), deps({ clientIp: '198.51.100.1' }))).status).toBe(201)
    const late = newHive()
    expect((await handleRelayRequest(register(late), deps({ clientIp: '198.51.100.2' }))).status).toBe(429)
    expect(store.data.has(`${INSTALL_PREFIX}${late.installId}`)).toBe(false)
    // An already-registered install can still re-register idempotently.
    expect((await handleRelayRequest(register(), deps())).status).toBe(200)
  })
})

describe('POST /api/nps (submit)', () => {
  beforeEach(async () => {
    await registerOk()
  })

  it('stores a signed submission with its install id, with no operator configuration', async () => {
    const res = await handleRelayRequest(submit(GOOD), deps({ env: {} }))
    expect(res.status).toBe(201)
    const [entry] = store.entries()
    expect(entry).toMatchObject({
      install_id: hive.installId,
      hive_id: 'solo-hive',
      score: 4,
      feedback: 'works well',
      dashboard_version: 'abc1234',
      timestamp: new Date(T0).toISOString(),
    })
    expect(entry.id).toMatch(/^\d{13}-[0-9a-f-]{36}$/)
    expect([...store.data.keys()].some((k) => k.includes('203.0.113.7'))).toBe(false)
  })

  it('rejects missing or bad signatures without writing anything', async () => {
    const before = store.writes
    const cases: Request[] = [
      submit(GOOD, { omit: HEADER_SIGNATURE }),
      submit(GOOD, { omit: HEADER_NONCE }),
      submit(GOOD, { omit: HEADER_TIMESTAMP }),
      submit(GOOD, { omit: HEADER_INSTALL_ID }),
      // Signed by a key that is not the one registered for this install.
      submit(GOOD, { signer: newHive(), headerInstallId: hive.installId }),
      // Body tampered after signing.
      submit(GOOD, { signedBody: JSON.stringify({ ...GOOD, score: 1 }) }),
      // A register-purpose signature cannot submit.
      submit(GOOD, { purpose: PURPOSE_REGISTER }),
      // Malformed nonce.
      submit(GOOD, { nonce: 'xyz' }),
    ]
    for (const req of cases) {
      const res = await handleRelayRequest(req, deps())
      expect(res.status).toBe(401)
    }
    expect(store.writes).toBe(before)
    expect(store.entries()).toHaveLength(0)
  })

  it('answers unknown_install for an unregistered install id so the hive re-registers', async () => {
    const stranger = newHive()
    const before = store.writes
    const res = await handleRelayRequest(submit(GOOD, { signer: stranger }), deps())
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: UNKNOWN_INSTALL_CODE })
    expect(store.writes).toBe(before)

    // After re-registering, the same install submits fine.
    await registerOk(stranger, '198.18.0.2')
    expect((await handleRelayRequest(submit(GOOD, { signer: stranger }), deps({ clientIp: '198.51.100.4' }))).status).toBe(201)
  })

  it('rejects timestamps outside the window', async () => {
    const stale = submit(GOOD, { timestampMs: T0 - SIGNATURE_MAX_SKEW_MS - MS_PER_SECOND })
    const future = submit(GOOD, { timestampMs: T0 + SIGNATURE_MAX_SKEW_MS + MS_PER_SECOND })
    expect((await handleRelayRequest(stale, deps())).status).toBe(401)
    expect((await handleRelayRequest(future, deps())).status).toBe(401)
    const edge = submit(GOOD, { timestampMs: T0 - SIGNATURE_MAX_SKEW_MS + MS_PER_SECOND })
    expect((await handleRelayRequest(edge, deps())).status).toBe(201)
  })

  it('rejects a replayed nonce, even from another IP', async () => {
    const nonce = 'a'.repeat(32)
    expect((await handleRelayRequest(submit(GOOD, { nonce }), deps())).status).toBe(201)
    const replay = await handleRelayRequest(submit(GOOD, { nonce }), deps({ clientIp: '198.51.100.5' }))
    expect(replay.status).toBe(401)
    expect(store.entries()).toHaveLength(1)
    expect(store.data.has(`${NONCE_PREFIX}${hive.installId}`)).toBe(true)
  })

  it('bounds the live nonces kept per install', async () => {
    const seen = Array.from({ length: MAX_NONCES_PER_INSTALL }, (_, i) => ({ n: String(i).padStart(32, '0'), t: T0 }))
    store.data.set(`${NONCE_PREFIX}${hive.installId}`, { seen })
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(429)
    // Once they age out, the install can submit again.
    now = T0 + 2 * SIGNATURE_MAX_SKEW_MS
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(201)
  })

  it('rate limits one submission per IP per 24h', async () => {
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(201)
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(429)
    expect((await handleRelayRequest(submit(GOOD), deps({ clientIp: '198.51.100.1' }))).status).toBe(201)
    now = T0 + RATE_WINDOW_MS
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(201)
    expect(store.entries()).toHaveLength(3)
  })

  it('caps submissions per install across IPs', async () => {
    for (let i = 0; i < MAX_PER_INSTALL_PER_WINDOW; i++) {
      const res = await handleRelayRequest(submit(GOOD), deps({ clientIp: `198.51.100.${i}` }))
      expect(res.status).toBe(201)
    }
    const res = await handleRelayRequest(submit(GOOD), deps({ clientIp: '192.0.2.99' }))
    expect(res.status).toBe(429)
    expect(store.entries()).toHaveLength(MAX_PER_INSTALL_PER_WINDOW)
  })

  it('caps the body by bytes read, including chunked bodies with no Content-Length', async () => {
    const chunk = new Uint8Array(1024).fill(0x20)
    const chunks = Math.ceil(MAX_SUBMIT_BODY_BYTES / chunk.byteLength) + 1
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < chunks; i++) controller.enqueue(chunk)
        controller.close()
      },
    })
    const req = new Request(ORIGIN + RELAY_BASE_PATH, {
      method: 'POST',
      headers: signedHeaders('', PURPOSE_SUBMIT),
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' })
    expect((await handleRelayRequest(req, deps())).status).toBe(413)

    const padded = JSON.stringify({ ...GOOD, pad: 'x'.repeat(MAX_SUBMIT_BODY_BYTES) })
    expect((await handleRelayRequest(submit(padded), deps({ clientIp: '198.51.100.2' }))).status).toBe(413)
    expect(store.entries()).toHaveLength(0)
  })

  it('never reads Content-Length to decide the cap', () => {
    const src = readFileSync(path.join(HERE, 'relay.ts'), 'utf8')
    expect(src.toLowerCase()).not.toContain("headers.get('content-length')")
  })

  it('validates score, feedback and hive_id', async () => {
    const bad: unknown[] = [
      { ...GOOD, score: 0 },
      { ...GOOD, score: 5 },
      { ...GOOD, score: 2.5 },
      { ...GOOD, score: '4' },
      { ...GOOD, score: undefined },
      { ...GOOD, feedback: 'x'.repeat(MAX_FEEDBACK_CHARS + 1) },
      { ...GOOD, feedback: 42 },
      { ...GOOD, hive_id: '' },
      { ...GOOD, hive_id: 'has space' },
      { ...GOOD, hive_id: 'x'.repeat(101) },
      [GOOD],
      'not json',
    ]
    for (const [i, body] of bad.entries()) {
      const res = await handleRelayRequest(submit(body), deps({ clientIp: `198.51.100.${i}` }))
      expect(res.status, JSON.stringify(body)).toBe(400)
    }
    expect(store.entries()).toHaveLength(0)

    const atLimit = { ...GOOD, feedback: 'y'.repeat(MAX_FEEDBACK_CHARS) }
    expect((await handleRelayRequest(submit(atLimit), deps())).status).toBe(201)
  })

  it('keeps a rolling window of entries', async () => {
    for (let i = 0; i < MAX_ENTRIES; i++) {
      const id = `${String(i).padStart(13, '0')}-00000000-0000-0000-0000-000000000000`
      store.data.set(`${ENTRY_PREFIX}${id}`, { id })
    }
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(201)
    const entries = store.entries()
    expect(entries).toHaveLength(MAX_ENTRIES)
    expect(entries[0].id.startsWith('0000000000000-')).toBe(false)
    expect(entries[entries.length - 1].hive_id).toBe('solo-hive')
  })
})

describe('no public read path', () => {
  beforeEach(async () => {
    await registerOk()
  })

  it('refuses GET and OPTIONS on the submit and register routes', async () => {
    await handleRelayRequest(submit(GOOD), deps())
    for (const route of [RELAY_BASE_PATH, REGISTER_PATH]) {
      for (const method of ['GET', 'OPTIONS', 'PUT', 'DELETE']) {
        const res = await handleRelayRequest(new Request(ORIGIN + route, { method }), deps())
        expect(res.status).toBe(405)
        const text = await res.text()
        expect(text).not.toContain('works well')
        expect(text).not.toContain(hive.publicKey)
      }
    }
  })

  it('refuses the hub routes without the hub secret', async () => {
    await handleRelayRequest(submit(GOOD), deps())
    for (const token of [null, 'not-the-secret', hive.publicKey]) {
      const res = await handleRelayRequest(pending(token), deps())
      expect(res.status).toBe(401)
      expect(await res.text()).not.toContain('works well')
      expect((await handleRelayRequest(ack(['x'], token), deps())).status).toBe(401)
    }
    expect(store.entries()).toHaveLength(1)
  })

  it('answers 503 on hub routes only when no hub secret is configured', async () => {
    const noHub = deps({ env: {} })
    expect((await handleRelayRequest(pending(), noHub)).status).toBe(503)
    expect((await handleRelayRequest(ack([]), noHub)).status).toBe(503)
    // Hives are unaffected by the missing hub secret.
    expect((await handleRelayRequest(submit(GOOD), noHub)).status).toBe(201)
    expect((await handleRelayRequest(register(newHive()), noHub)).status).toBe(201)
  })

  it('404s any other path', async () => {
    const res = await handleRelayRequest(new Request(`${ORIGIN}/api/nps/all`), deps())
    expect(res.status).toBe(404)
  })
})

describe('hub pull and ack', () => {
  beforeEach(async () => {
    await registerOk()
  })

  async function seed(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      now = T0 + i
      const res = await handleRelayRequest(
        submit({ ...GOOD, score: (i % 4) + 1 }),
        deps({ clientIp: `10.0.${i >> 8}.${i & 255}` }),
      )
      expect(res.status).toBe(201)
    }
  }

  it('returns entries oldest first, honoring the limit, with install ids', async () => {
    await seed(3)
    const res = await handleRelayRequest(pending(HUB_SECRET, '?limit=2'), deps())
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const { entries } = (await res.json()) as { entries: RelayEntry[] }
    expect(entries.map((e) => e.score)).toEqual([1, 2])
    expect(entries.every((e) => e.install_id === hive.installId)).toBe(true)
    expect(entries[0].timestamp < entries[1].timestamp).toBe(true)
  })

  it('never returns more than one batch', async () => {
    const seeded = MAX_PULL_BATCH + 1
    for (let i = 0; i < seeded; i++) {
      const id = `${String(T0 + i).padStart(13, '0')}-00000000-0000-0000-0000-${String(i).padStart(12, '0')}`
      store.data.set(`${ENTRY_PREFIX}${id}`, { id, score: 3 })
    }
    const res = await handleRelayRequest(pending(HUB_SECRET, '?limit=100000'), deps())
    const { entries } = (await res.json()) as { entries: RelayEntry[] }
    expect(entries).toHaveLength(MAX_PULL_BATCH)
  })

  it('never exposes registered keys or nonces through a pull', async () => {
    await seed(1)
    const text = await (await handleRelayRequest(pending(), deps())).text()
    expect(text).not.toContain(hive.publicKey)
    expect(text).not.toContain('registered_at')
  })

  it('acks delete exactly the listed well-formed ids and are idempotent', async () => {
    await seed(3)
    const { entries } = (await (await handleRelayRequest(pending(), deps())).json()) as { entries: RelayEntry[] }
    const [first, second] = entries
    const res = await handleRelayRequest(ack([first.id, second.id, 'bogus/../id', 7]), deps())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: 2 })
    expect(store.entries().map((e) => e.id)).toEqual([entries[2].id])

    expect((await handleRelayRequest(ack([first.id, second.id]), deps())).status).toBe(200)
    expect(store.entries()).toHaveLength(1)
    // Acks never touch registrations.
    expect(store.data.has(`${INSTALL_PREFIX}${hive.installId}`)).toBe(true)
  })

  it('rejects an ack that is not a bounded id list', async () => {
    expect((await handleRelayRequest(ack('nope'), deps())).status).toBe(400)
    const tooMany = Array.from({ length: MAX_PULL_BATCH + 1 }, (_, i) => String(i))
    expect((await handleRelayRequest(ack(tooMany), deps())).status).toBe(400)
  })
})

describe('Netlify function wiring', () => {
  it('routes exactly the relay paths and reads only the hub secret env var', () => {
    const fn = readFileSync(path.join(HERE, '..', 'functions', 'nps.mts'), 'utf8')
    for (const p of [RELAY_BASE_PATH, REGISTER_PATH, PENDING_PATH, ACK_PATH]) {
      expect(fn).toContain(`'${p}'`)
    }
    expect(fn).toContain('handleRelayRequest')
    expect(fn).toContain('HUB_SECRET_HASH_ENV')
    expect(fn).not.toContain('INSTALL_TOKENS')
  })
})
