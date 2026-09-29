import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ACK_PATH,
  ENTRY_PREFIX,
  MAX_ENTRIES,
  MAX_FEEDBACK_CHARS,
  MAX_PER_INSTALL_PER_WINDOW,
  MAX_PULL_BATCH,
  MAX_SUBMIT_BODY_BYTES,
  PENDING_PATH,
  RATE_WINDOW_MS,
  RELAY_BASE_PATH,
  handleRelayRequest,
  matchInstallToken,
  parseInstallTokens,
  type RelayDeps,
  type RelayEntry,
  type RelayStore,
} from './relay'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ORIGIN = 'https://relay.test'
const INSTALL_TOKEN = 'install-token-for-tests'
const OTHER_TOKEN = 'not-on-the-allowlist'
const HUB_SECRET = 'hub-pull-secret-for-tests'
const T0 = Date.UTC(2026, 8, 29, 12, 0, 0)

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

let store: MemoryStore
let now: number

function deps(overrides: Partial<RelayDeps> = {}): RelayDeps {
  return {
    store,
    env: {
      installTokens: `acme-lab:${sha256(INSTALL_TOKEN)}`,
      hubSecretHash: sha256(HUB_SECRET),
    },
    clientIp: '203.0.113.7',
    now: () => now,
    ...overrides,
  }
}

function submit(body: unknown, token: string | null = INSTALL_TOKEN): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  return new Request(ORIGIN + RELAY_BASE_PATH, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
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

const GOOD = { hive_id: 'solo-hive', score: 4, feedback: 'works well', dashboard_version: 'abc1234' }

beforeEach(() => {
  store = new MemoryStore()
  now = T0
})

describe('install token allowlist', () => {
  it('parses label:hash entries and ignores malformed ones', () => {
    const hash = sha256(INSTALL_TOKEN)
    const parsed = parseInstallTokens(`acme:${hash}, bad-entry\nno-hash:\n:${hash}\nshort:abc123\nupper:${hash.toUpperCase()}`)
    expect(parsed).toEqual([
      { label: 'acme', hash },
      { label: 'upper', hash },
    ])
    expect(parseInstallTokens(undefined)).toEqual([])
  })

  it('matches only the hash of a listed token', () => {
    const raw = `acme:${sha256(INSTALL_TOKEN)}`
    expect(matchInstallToken(INSTALL_TOKEN, raw)).toBe('acme')
    expect(matchInstallToken(OTHER_TOKEN, raw)).toBeNull()
    // The hash itself is not a valid token.
    expect(matchInstallToken(sha256(INSTALL_TOKEN), raw)).toBeNull()
  })
})

describe('POST /api/nps (submit)', () => {
  it('stores a valid submission with the install label', async () => {
    const res = await handleRelayRequest(submit(GOOD), deps())
    expect(res.status).toBe(201)
    const [entry] = store.entries()
    expect(entry).toMatchObject({
      install_id: 'acme-lab',
      hive_id: 'solo-hive',
      score: 4,
      feedback: 'works well',
      dashboard_version: 'abc1234',
      timestamp: new Date(T0).toISOString(),
    })
    expect(entry.id).toMatch(/^\d{13}-[0-9a-f-]{36}$/)
    // The client IP is stored only as a hash.
    expect([...store.data.keys()].some((k) => k.includes('203.0.113.7'))).toBe(false)
  })

  it('rejects a missing or unknown token without writing anything', async () => {
    for (const token of [null, OTHER_TOKEN]) {
      const res = await handleRelayRequest(submit(GOOD, token), deps())
      expect(res.status).toBe(401)
    }
    expect(store.writes).toBe(0)
  })

  it('refuses all submissions when no tokens are configured', async () => {
    const res = await handleRelayRequest(submit(GOOD), deps({ env: { hubSecretHash: sha256(HUB_SECRET) } }))
    expect(res.status).toBe(503)
    expect(store.writes).toBe(0)
  })

  it('rate limits one submission per IP per 24h', async () => {
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(201)
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(429)
    // Another IP is not affected.
    expect((await handleRelayRequest(submit(GOOD), deps({ clientIp: '198.51.100.1' }))).status).toBe(201)
    // The first IP may submit again once the window has passed.
    now = T0 + RATE_WINDOW_MS
    expect((await handleRelayRequest(submit(GOOD), deps())).status).toBe(201)
    expect(store.entries()).toHaveLength(3)
  })

  it('caps submissions per install token across IPs', async () => {
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
      headers: { authorization: `Bearer ${INSTALL_TOKEN}` },
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
  it('refuses GET and OPTIONS on the submit route', async () => {
    await handleRelayRequest(submit(GOOD), deps())
    for (const method of ['GET', 'OPTIONS', 'PUT', 'DELETE']) {
      const res = await handleRelayRequest(new Request(ORIGIN + RELAY_BASE_PATH, { method }), deps())
      expect(res.status).toBe(405)
      expect(await res.text()).not.toContain('works well')
    }
  })

  it('refuses the hub routes without the hub secret', async () => {
    await handleRelayRequest(submit(GOOD), deps())
    for (const token of [null, INSTALL_TOKEN, OTHER_TOKEN]) {
      const res = await handleRelayRequest(pending(token), deps())
      expect(res.status).toBe(401)
      expect(await res.text()).not.toContain('works well')
      expect((await handleRelayRequest(ack(['x'], token), deps())).status).toBe(401)
    }
    expect(store.entries()).toHaveLength(1)
  })

  it('refuses the hub routes when no hub secret is configured', async () => {
    const noHub = deps({ env: { installTokens: `acme-lab:${sha256(INSTALL_TOKEN)}` } })
    expect((await handleRelayRequest(pending(), noHub)).status).toBe(503)
    expect((await handleRelayRequest(ack([]), noHub)).status).toBe(503)
  })

  it('404s any other path', async () => {
    const res = await handleRelayRequest(new Request(`${ORIGIN}/api/nps/all`), deps())
    expect(res.status).toBe(404)
  })
})

describe('hub pull and ack', () => {
  async function seed(count: number): Promise<void> {
    for (let i = 0; i < count; i++) {
      now = T0 + i
      const res = await handleRelayRequest(submit({ ...GOOD, score: (i % 4) + 1 }), deps({ clientIp: `10.0.${i >> 8}.${i & 255}` }))
      expect(res.status).toBe(201)
    }
  }

  it('returns entries oldest first, honoring the limit', async () => {
    await seed(3)
    const res = await handleRelayRequest(pending(HUB_SECRET, '?limit=2'), deps())
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const { entries } = (await res.json()) as { entries: RelayEntry[] }
    expect(entries.map((e) => e.score)).toEqual([1, 2])
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

  it('acks delete exactly the listed well-formed ids and are idempotent', async () => {
    await seed(3)
    const { entries } = (await (await handleRelayRequest(pending(), deps())).json()) as { entries: RelayEntry[] }
    const [first, second] = entries
    const res = await handleRelayRequest(ack([first.id, second.id, 'bogus/../id', 7]), deps())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: 2 })
    expect(store.entries().map((e) => e.id)).toEqual([entries[2].id])

    // Re-acking the same ids (a retried ack) is harmless.
    expect((await handleRelayRequest(ack([first.id, second.id]), deps())).status).toBe(200)
    expect(store.entries()).toHaveLength(1)
  })

  it('rejects an ack that is not a bounded id list', async () => {
    expect((await handleRelayRequest(ack('nope'), deps())).status).toBe(400)
    const tooMany = Array.from({ length: MAX_PULL_BATCH + 1 }, (_, i) => String(i))
    expect((await handleRelayRequest(ack(tooMany), deps())).status).toBe(400)
  })
})

describe('Netlify function wiring', () => {
  it('routes exactly the relay paths', () => {
    const fn = readFileSync(path.join(HERE, '..', 'functions', 'nps.mts'), 'utf8')
    for (const p of [RELAY_BASE_PATH, PENDING_PATH, ACK_PATH]) {
      expect(fn).toContain(`'${p}'`)
    }
    expect(fn).toContain('handleRelayRequest')
  })
})
