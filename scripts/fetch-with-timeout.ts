/**
 * fetch() with a deadline for the prebuild sync scripts, so a stalled remote
 * fails the step quickly instead of hanging the build until the job timeout.
 * Override the default with DOCS_SYNC_FETCH_TIMEOUT_MS (positive integer, ms).
 */
export type SyncEnv = Record<string, string | undefined>;

const FALLBACK_TIMEOUT_MS = 30000;

export function parseTimeoutMs(env: SyncEnv = process.env): number {
  const raw = env.DOCS_SYNC_FETCH_TIMEOUT_MS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return FALLBACK_TIMEOUT_MS;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : FALLBACK_TIMEOUT_MS;
}

export const DEFAULT_SYNC_FETCH_TIMEOUT_MS = parseTimeoutMs();

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_SYNC_FETCH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      throw new Error(
        `timed out after ${timeoutMs / 1000}s fetching ${url}`,
        { cause: error }
      );
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
