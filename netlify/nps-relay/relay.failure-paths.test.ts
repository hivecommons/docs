import {
  createHash,
  generateKeyPairSync,
  randomBytes,
  sign,
  type KeyObject,
} from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACK_PATH,
  HEADER_INSTALL_ID,
  HEADER_NONCE,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  INSTALL_PREFIX,
  PENDING_PATH,
  PURPOSE_REGISTER,
  REGISTER_PATH,
  RELAY_BASE_PATH,
  BodyTooLargeError,
  handleRelayRequest,
  readCappedBytes,
  readCappedText,
  signingInput,
  type ConditionalSetOptions,
  type RelayDeps,
  type RelayStore,
  type WriteOutcome,
} from "./relay";

const ORIGIN = "https://relay.test";
const HUB_SECRET = "hub-pull-secret-for-failure-tests";
const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);
const MS_PER_SECOND = 1000;
const NONCE_BYTES = 16;

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** Minimal in-memory store; every method can be overridden per test. */
class MemoryStore implements RelayStore {
  data = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.data.has(key)
      ? JSON.parse(JSON.stringify(this.data.get(key)))
      : null;
  }

  async getWithMetadata(
    key: string
  ): Promise<{ data: unknown; etag?: string } | null> {
    const data = await this.get(key);
    return data === null ? null : { data, etag: '"v1"' };
  }

  async setJSON(
    key: string,
    value: unknown,
    options?: ConditionalSetOptions
  ): Promise<WriteOutcome> {
    if (options?.onlyIfNew && this.data.has(key)) return { modified: false };
    this.data.set(key, JSON.parse(JSON.stringify(value)));
    return { modified: true, etag: '"v2"' };
  }

  async delete(key: string): Promise<void> {
    this.data.delete(key);
  }

  async list({
    prefix,
  }: {
    prefix: string;
  }): Promise<{ blobs: Array<{ key: string }> }> {
    return {
      blobs: [...this.data.keys()]
        .filter(k => k.startsWith(prefix))
        .map(key => ({ key })),
    };
  }
}

interface Hive {
  installId: string;
  publicKey: string;
  privateKey: KeyObject;
}

let counter = 0;
function newHive(): Hive {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  counter++;
  return {
    installId: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    publicKey: der.subarray(der.length - 32).toString("base64"),
    privateKey,
  };
}

let store: MemoryStore;

function deps(overrides: Partial<RelayDeps> = {}): RelayDeps {
  return {
    store,
    env: { hubSecretHash: sha256(HUB_SECRET) },
    clientIp: "203.0.113.9",
    now: () => T0,
    ...overrides,
  };
}

function registerRequest(hive: Hive): Request {
  const body = JSON.stringify({
    install_id: hive.installId,
    public_key: hive.publicKey,
  });
  const ts = String(Math.floor(T0 / MS_PER_SECOND));
  const nonce = randomBytes(NONCE_BYTES).toString("hex");
  const message = signingInput(
    PURPOSE_REGISTER,
    hive.installId,
    ts,
    nonce,
    Buffer.from(body, "utf8")
  );
  return new Request(ORIGIN + REGISTER_PATH, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [HEADER_INSTALL_ID]: hive.installId,
      [HEADER_TIMESTAMP]: ts,
      [HEADER_NONCE]: nonce,
      [HEADER_SIGNATURE]: sign(null, message, hive.privateKey).toString(
        "base64"
      ),
    },
    body,
  });
}

function hubHeaders(): Record<string, string> {
  return { authorization: `Bearer ${HUB_SECRET}` };
}

/** A request whose body stream fails mid-read. */
function brokenBodyRequest(path: string, headers: Record<string, string>) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([0x7b]));
      controller.error(new Error("socket reset"));
    },
  });
  return new Request(ORIGIN + path, {
    method: "POST",
    headers,
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

beforeEach(() => {
  store = new MemoryStore();
});

describe("hub routes refuse the wrong method", () => {
  it("answers 405 for non-GET on pending and non-POST on ack, before auth", async () => {
    for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
      const res = await handleRelayRequest(
        new Request(ORIGIN + PENDING_PATH, { method }),
        deps()
      );
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error: "method not allowed" });
    }
    for (const method of ["GET", "PUT", "DELETE", "OPTIONS"]) {
      const res = await handleRelayRequest(
        new Request(ORIGIN + ACK_PATH, { method }),
        deps()
      );
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ error: "method not allowed" });
    }
  });

  it("treats a trailing slash as the same route", async () => {
    const res = await handleRelayRequest(
      new Request(`${ORIGIN}${PENDING_PATH}///`, { method: "POST" }),
      deps()
    );
    expect(res.status).toBe(405);
  });
});

describe("unreadable request bodies", () => {
  it("maps a failing body stream to 400 rather than 413 or 500", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleRelayRequest(
      brokenBodyRequest(ACK_PATH, {
        ...hubHeaders(),
        "content-type": "application/json",
      }),
      deps()
    );
    error.mockRestore();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unreadable body" });
  });

  it("readCappedBytes propagates the stream error after releasing the reader", async () => {
    const req = brokenBodyRequest(RELAY_BASE_PATH, {});
    await expect(readCappedBytes(req, 1024)).rejects.toThrow("socket reset");
    expect(req.body?.locked).toBe(false);
  });
});

describe("readCappedText", () => {
  it("decodes a body that fits within the cap as UTF-8", async () => {
    const req = new Request(ORIGIN + RELAY_BASE_PATH, {
      method: "POST",
      body: "héllo ✓",
    });
    await expect(readCappedText(req, 64)).resolves.toBe("héllo ✓");
  });

  it("returns an empty string for a request without a body", async () => {
    const req = new Request(ORIGIN + RELAY_BASE_PATH, { method: "GET" });
    await expect(readCappedText(req, 64)).resolves.toBe("");
  });

  it("rejects with BodyTooLargeError once bytes read exceed the cap", async () => {
    const req = new Request(ORIGIN + RELAY_BASE_PATH, {
      method: "POST",
      body: "x".repeat(65),
    });
    await expect(readCappedText(req, 64)).rejects.toBeInstanceOf(
      BodyTooLargeError
    );
  });
});

describe("internal errors", () => {
  it("answers a bare 500 and logs only the error name, never the message", async () => {
    const boom = new Error(
      `blob backend down for ${HUB_SECRET} at install/secret-id`
    );
    boom.name = "BlobsUnavailable";
    const failing: RelayStore = {
      ...store,
      get: async () => {
        throw boom;
      },
      getWithMetadata: async () => {
        throw boom;
      },
      setJSON: async () => {
        throw boom;
      },
      delete: async () => {
        throw boom;
      },
      list: async () => {
        throw boom;
      },
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await handleRelayRequest(
      new Request(ORIGIN + PENDING_PATH, {
        method: "GET",
        headers: hubHeaders(),
      }),
      deps({ store: failing })
    );
    const logged = error.mock.calls
      .map(c => c.map(String).join(" "))
      .join("\n");
    const requestLog = JSON.parse(String(warn.mock.calls[0][0]));
    error.mockRestore();
    warn.mockRestore();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal server error" });
    expect(logged).toContain("nps relay: internal error:");
    expect(logged).toContain("BlobsUnavailable");
    expect(logged).not.toContain(HUB_SECRET);
    expect(logged).not.toContain("secret-id");
    expect(logged).not.toContain("blob backend down");
    expect(requestLog).toMatchObject({ route: "nps-pending", status: 500 });
  });

  it("labels a thrown non-Error as unknown", async () => {
    const failing: RelayStore = {
      ...store,
      list: async () => {
        throw "string-thrown-with-secret";
      },
      get: async () => null,
      getWithMetadata: async () => null,
      setJSON: async () => ({ modified: true, etag: '"v"' }),
      delete: async () => {},
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await handleRelayRequest(
      new Request(ORIGIN + PENDING_PATH, {
        method: "GET",
        headers: hubHeaders(),
      }),
      deps({ store: failing })
    );
    const logged = error.mock.calls
      .map(c => c.map(String).join(" "))
      .join("\n");
    vi.restoreAllMocks();
    expect(res.status).toBe(500);
    expect(logged).toContain("unknown");
    expect(logged).not.toContain("string-thrown-with-secret");
  });
});

describe("registration race loser", () => {
  it("answers 409 when the create-only write loses to a different key", async () => {
    const loser = newHive();
    const winner = newHive();
    const key = `${INSTALL_PREFIX}${loser.installId}`;
    // The pre-check sees no registration; another instance then wins the
    // create-only write with a different key before this one lands.
    const racing = new (class extends MemoryStore {
      async setJSON(
        k: string,
        value: unknown,
        options?: ConditionalSetOptions
      ): Promise<WriteOutcome> {
        if (k === key && options?.onlyIfNew && !this.data.has(k)) {
          this.data.set(k, {
            public_key: winner.publicKey,
            registered_at: new Date(T0).toISOString(),
          });
          return { modified: false };
        }
        return super.setJSON(k, value, options);
      }
    })();
    const res = await handleRelayRequest(
      registerRequest(loser),
      deps({ store: racing })
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "install_id is registered to a different key",
    });
    // The winner's binding is untouched.
    expect(await racing.get(key)).toMatchObject({
      public_key: winner.publicKey,
    });
  });

  it("answers 200 registered:false when the write loses to the same key", async () => {
    const hive = newHive();
    const key = `${INSTALL_PREFIX}${hive.installId}`;
    const racing = new (class extends MemoryStore {
      async setJSON(
        k: string,
        value: unknown,
        options?: ConditionalSetOptions
      ): Promise<WriteOutcome> {
        if (k === key && options?.onlyIfNew && !this.data.has(k)) {
          this.data.set(k, {
            public_key: hive.publicKey,
            registered_at: new Date(T0).toISOString(),
          });
          return { modified: false };
        }
        return super.setJSON(k, value, options);
      }
    })();
    const res = await handleRelayRequest(
      registerRequest(hive),
      deps({ store: racing })
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, registered: false });
  });
});
