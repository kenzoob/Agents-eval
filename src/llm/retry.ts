const MAX_RETRIES = 6;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;
// Upper bound on any single wait, including server-dictated ones (Retry-After
// header or Google's JSON-body retryDelay). A daily quota error can report a
// retryDelay of several hours; honoring that literally would hang the process
// instead of failing. Capping it means we burn through MAX_RETRIES quickly
// and surface the real error instead of sleeping for most of a day.
const MAX_RETRY_WAIT_MS = 120_000;
const RETRYABLE_STATUSES = new Set([429, 503]);

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const dateMs = Date.parse(header);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
}

// Google's API (Gemini) does not set a Retry-After header; it embeds the
// cooldown in the JSON error body instead, e.g.
// [{"error":{"details":[{"@type":".../google.rpc.RetryInfo","retryDelay":"49s"}]}}]
function parseGoogleRetryDelayMs(bodyText: string): number | undefined {
  try {
    const parsed: unknown = JSON.parse(bodyText);
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of entries) {
      const details = (entry as { error?: { details?: unknown } })?.error?.details;
      if (!Array.isArray(details)) continue;
      for (const detail of details) {
        const retryDelay = (detail as { retryDelay?: unknown })?.retryDelay;
        if (typeof retryDelay === "string") {
          const match = retryDelay.match(/^(\d+(?:\.\d+)?)s$/);
          if (match) return Number(match[1]) * 1000;
        }
      }
    }
  } catch {
    // Not JSON, or not the expected shape — fall through to generic backoff.
  }
  return undefined;
}

function backoffDelayMs(attempt: number): number {
  const cap = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.random() * cap;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    if (!RETRYABLE_STATUSES.has(response.status) || attempt === MAX_RETRIES) return response;

    const headerDelayMs = parseRetryAfterMs(response.headers.get("retry-after"));
    const delayMs = headerDelayMs ?? parseGoogleRetryDelayMs(await response.text()) ?? backoffDelayMs(attempt);
    await sleep(Math.min(delayMs, MAX_RETRY_WAIT_MS));
  }
}
