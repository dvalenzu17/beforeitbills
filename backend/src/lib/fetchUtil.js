/**
 * fetch wrapper with a hard timeout and automatic JSON parsing.
 * Returns { ok, status, json } — never throws on HTTP-level errors,
 * only on network failures or timeout.
 */
export async function fetchJson(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const json = await resp.json().catch(() => ({}));
    return { ok: resp.ok, status: resp.status, json };
  } finally {
    clearTimeout(timer);
  }
}
