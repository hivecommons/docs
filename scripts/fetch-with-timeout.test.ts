import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBytesWithTimeout,
  fetchTextWithTimeout,
  parseTimeoutMs,
} from "./fetch-with-timeout";

// A fetch that never resolves but rejects when its signal aborts.
const hanging = vi.fn(
  (_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError"))
      );
    })
) as unknown as typeof fetch;

// A fetch that answers 200 with headers right away but whose body stream
// never closes and ignores the abort signal (the "never completes the
// response" case from #394).
const stalledBody = vi.fn(
  async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("partial"));
        },
      }),
      { status: 200 }
    )
) as unknown as typeof fetch;

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchTextWithTimeout", () => {
  it("returns status fields and the body text", async () => {
    const fake = vi.fn(
      async () => new Response("ok", { status: 200, statusText: "OK" })
    ) as unknown as typeof fetch;
    await expect(
      fetchTextWithTimeout("https://x.test/a", {}, 1000, fake)
    ).resolves.toEqual({ ok: true, status: 200, statusText: "OK", body: "ok" });
  });

  it("reports non-2xx responses without throwing", async () => {
    const fake = vi.fn(
      async () =>
        new Response("missing", { status: 404, statusText: "Not Found" })
    ) as unknown as typeof fetch;
    const res = await fetchTextWithTimeout("https://x.test/a", {}, 1000, fake);
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    expect(res.statusText).toBe("Not Found");
  });

  it("passes an AbortSignal to fetch", async () => {
    const fake = vi.fn(async () => new Response("ok"));
    await fetchTextWithTimeout(
      "https://x.test/a",
      {},
      1000,
      fake as unknown as typeof fetch
    );
    const init = (fake.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects with a timeout message naming the URL when headers never arrive", async () => {
    vi.useFakeTimers();
    const p = fetchTextWithTimeout("https://x.test/slow", {}, 5000, hanging);
    const assertion = expect(p).rejects.toThrow(
      /timed out after 5s fetching https:\/\/x\.test\/slow/
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("times out when the body stalls after headers were received", async () => {
    vi.useFakeTimers();
    const p = fetchTextWithTimeout(
      "https://x.test/stall",
      {},
      5000,
      stalledBody
    );
    const assertion = expect(p).rejects.toThrow(
      /timed out after 5s fetching https:\/\/x\.test\/stall/
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("does not mask non-timeout errors", async () => {
    const fake = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    await expect(
      fetchTextWithTimeout("https://x.test/a", {}, 1000, fake)
    ).rejects.toThrow("boom");
  });
});

describe("fetchBytesWithTimeout", () => {
  it("returns the body as a Buffer", async () => {
    const fake = vi.fn(
      async () => new Response(new Uint8Array([1, 2, 3]))
    ) as unknown as typeof fetch;
    const res = await fetchBytesWithTimeout("https://x.test/b", {}, 1000, fake);
    expect(res.ok).toBe(true);
    expect(Buffer.isBuffer(res.body)).toBe(true);
    expect([...res.body]).toEqual([1, 2, 3]);
  });

  it("times out when the body stalls after headers were received", async () => {
    vi.useFakeTimers();
    const p = fetchBytesWithTimeout(
      "https://x.test/stall",
      {},
      5000,
      stalledBody
    );
    const assertion = expect(p).rejects.toThrow(
      /timed out after 5s fetching https:\/\/x\.test\/stall/
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });
});

describe("parseTimeoutMs", () => {
  it("falls back to the default for missing or invalid values", () => {
    expect(parseTimeoutMs({})).toBe(30000);
    expect(parseTimeoutMs({ DOCS_SYNC_FETCH_TIMEOUT_MS: "abc" })).toBe(30000);
    expect(parseTimeoutMs({ DOCS_SYNC_FETCH_TIMEOUT_MS: "0" })).toBe(30000);
    expect(parseTimeoutMs({ DOCS_SYNC_FETCH_TIMEOUT_MS: "-5" })).toBe(30000);
    expect(parseTimeoutMs({ DOCS_SYNC_FETCH_TIMEOUT_MS: "1.5" })).toBe(30000);
  });

  it("accepts a positive integer", () => {
    expect(parseTimeoutMs({ DOCS_SYNC_FETCH_TIMEOUT_MS: "1500" })).toBe(1500);
  });
});
