import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, parseTimeoutMs } from "./fetch-with-timeout";

// A fetch that never resolves but rejects when its signal aborts.
const hanging = vi.fn(
  (_url: string, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("aborted", "AbortError"))
      );
    })
) as unknown as typeof fetch;

afterEach(() => {
  vi.useRealTimers();
});

describe("fetchWithTimeout", () => {
  it("resolves when the fetch resolves", async () => {
    const res = new Response("ok");
    const fake = vi.fn(async () => res) as unknown as typeof fetch;
    await expect(
      fetchWithTimeout("https://x.test/a", {}, 1000, fake)
    ).resolves.toBe(res);
  });

  it("passes an AbortSignal to fetch", async () => {
    const fake = vi.fn(async () => new Response("ok"));
    await fetchWithTimeout(
      "https://x.test/a",
      {},
      1000,
      fake as unknown as typeof fetch
    );
    const init = (fake.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("rejects with a timeout message naming the URL", async () => {
    vi.useFakeTimers();
    const p = fetchWithTimeout("https://x.test/slow", {}, 5000, hanging);
    const assertion = expect(p).rejects.toThrow(
      /timed out after 5s fetching https:\/\/x\.test\/slow/
    );
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
  });

  it("does not mask non-timeout errors", async () => {
    const fake = vi.fn(async () => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    await expect(
      fetchWithTimeout("https://x.test/a", {}, 1000, fake)
    ).rejects.toThrow("boom");
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
