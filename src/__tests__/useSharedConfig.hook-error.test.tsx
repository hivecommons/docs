// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { SharedConfig } from "../hooks/useSharedConfig";

/**
 * Coverage for the `.catch(err => setError(err))` arm of useSharedConfig.
 *
 * fetchConfig swallows per-URL network/HTTP failures and resolves to null,
 * so a plain outage never reaches this arm. It IS reachable when both
 * sources respond 200 but one payload has drifted from the SharedConfig
 * schema: mergeSharedConfigs reads `primary.relatedProjects.length`, which
 * throws a TypeError when the field is absent. That rejection propagates
 * out of fetchConfig (its inner catches only wrap the two fetches) and the
 * hook must surface it as `error` instead of hanging in `loading=true`.
 */

const LOCAL_URL = "/config/shared.json";
const PROD_URL = "https://docs.hivecommons.dev/config/shared.json";

function makeConfig(overrides: Partial<SharedConfig> = {}): SharedConfig {
  return {
    versions: {},
    projects: {},
    relatedProjects: [],
    editBaseUrls: {},
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

// A payload missing `relatedProjects` — the shape an older shared.json
// (pre relatedProjects) still served from production would have.
function schemaDriftedConfig(
  updatedAt: string
): Omit<SharedConfig, "relatedProjects"> {
  const { relatedProjects: _dropped, ...rest } = makeConfig({ updatedAt });
  void _dropped;
  return rest;
}

async function importFresh() {
  vi.resetModules();
  return await import("../hooks/useSharedConfig");
}

let fetchMock: ReturnType<typeof vi.fn>;
const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe("useSharedConfig — fetchConfig rejection (merge throws)", () => {
  it("surfaces the merge TypeError as `error` and flips loading off", async () => {
    // Local is newer, so it becomes `primary` in mergeSharedConfigs and its
    // missing relatedProjects triggers the throw.
    fetchMock.mockImplementation(async (url: string) => {
      if (url === LOCAL_URL)
        return ok(schemaDriftedConfig("2026-07-02T00:00:00.000Z"));
      if (url === PROD_URL)
        return ok(makeConfig({ updatedAt: "2026-07-01T00:00:00.000Z" }));
      throw new Error(`unexpected url ${url}`);
    });

    const mod = await importFresh();
    const { result } = renderHook(() => mod.useSharedConfig());

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(TypeError);
    expect(result.current.config).toBeNull();
  });

  it("does not setError after unmount when the rejection lands late", async () => {
    let resolveLocal!: (r: Response) => void;
    const localPromise = new Promise<Response>(res => {
      resolveLocal = res;
    });
    fetchMock.mockImplementation(async (url: string) => {
      if (url === LOCAL_URL) return localPromise;
      if (url === PROD_URL)
        return ok(makeConfig({ updatedAt: "2026-07-01T00:00:00.000Z" }));
      throw new Error(`unexpected url ${url}`);
    });

    const mod = await importFresh();
    const { result, unmount } = renderHook(() => mod.useSharedConfig());
    expect(result.current.loading).toBe(true);

    unmount();
    await act(async () => {
      resolveLocal(ok(schemaDriftedConfig("2026-07-02T00:00:00.000Z")));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Last pre-unmount snapshot: the mounted guard inside .catch must have
    // skipped both setError and setLoading.
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("clears the in-flight promise on rejection so a later mount can recover", async () => {
    let drifted = true;
    fetchMock.mockImplementation(async (url: string) => {
      if (url === LOCAL_URL)
        return ok(
          drifted
            ? schemaDriftedConfig("2026-07-02T00:00:00.000Z")
            : makeConfig({
                updatedAt: "2026-07-02T00:00:00.000Z",
                surveyUrl: "https://recovered.example",
              })
        );
      if (url === PROD_URL)
        return ok(makeConfig({ updatedAt: "2026-07-01T00:00:00.000Z" }));
      throw new Error(`unexpected url ${url}`);
    });

    const mod = await importFresh();

    const first = renderHook(() => mod.useSharedConfig());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.error).toBeInstanceOf(TypeError);

    // The failed promise was released by .finally; a second mount refetches
    // rather than re-awaiting the rejected promise.
    drifted = false;
    fetchMock.mockClear();
    const second = renderHook(() => mod.useSharedConfig());
    await waitFor(() => expect(second.result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(second.result.current.error).toBeNull();
    expect(second.result.current.config?.surveyUrl).toBe(
      "https://recovered.example"
    );
  });
});
