/**
 * fetch() with a deadline for the prebuild sync scripts, so a stalled remote
 * fails the step quickly instead of hanging the build until the job timeout.
 * The deadline covers the whole exchange, including reading the body, so a
 * remote that sends headers and then stalls mid-body is bounded too.
 * Override the default with DOCS_SYNC_FETCH_TIMEOUT_MS (positive integer, ms).
 */
import type { SyncEnv } from "./run-sync-step";

const FALLBACK_TIMEOUT_MS = 30000;

export function parseTimeoutMs(env: SyncEnv = process.env): number {
  const raw = env.DOCS_SYNC_FETCH_TIMEOUT_MS?.trim();
  if (!raw || !/^\d+$/.test(raw)) return FALLBACK_TIMEOUT_MS;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : FALLBACK_TIMEOUT_MS;
}

export const DEFAULT_SYNC_FETCH_TIMEOUT_MS = parseTimeoutMs();

export interface TimedResponse<T> {
  ok: boolean;
  status: number;
  statusText: string;
  body: T;
}

async function fetchWithDeadline<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
  read: (response: Response) => Promise<T>
): Promise<TimedResponse<T>> {
  const controller = new AbortController();
  let timedOut = false;
  // Raced against both the fetch and the body read: the body stream of a
  // fetch stub may ignore the abort signal, and the deadline must hold anyway.
  const { promise: deadline, reject: expire } = Promise.withResolvers<never>();
  deadline.catch(() => {});
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
    expire(controller.signal.reason);
  }, timeoutMs);
  let response: Response | undefined;
  try {
    response = await Promise.race([
      fetchImpl(url, { ...init, signal: controller.signal }),
      deadline,
    ]);
    const body = await Promise.race([read(response), deadline]);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      body,
    };
  } catch (error) {
    if (timedOut) {
      response?.body?.cancel().catch(() => {});
      throw new Error(`timed out after ${timeoutMs / 1000}s fetching ${url}`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function fetchTextWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_SYNC_FETCH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<TimedResponse<string>> {
  return fetchWithDeadline(url, init, timeoutMs, fetchImpl, r => r.text());
}

export function fetchBytesWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_SYNC_FETCH_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch
): Promise<TimedResponse<Buffer>> {
  return fetchWithDeadline(url, init, timeoutMs, fetchImpl, async r =>
    Buffer.from(await r.arrayBuffer())
  );
}
