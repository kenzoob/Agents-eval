const MAX_RETRIES = 6;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;
const RETRYABLE_STATUSES = new Set([429, 503]);

function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (!Number.isNaN(seconds)) return seconds * 1000;
  const dateMs = Date.parse(header);
  return Number.isNaN(dateMs) ? undefined : Math.max(0, dateMs - Date.now());
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
    const delayMs = parseRetryAfterMs(response.headers.get("retry-after")) ?? backoffDelayMs(attempt);
    await sleep(delayMs);
  }
}
