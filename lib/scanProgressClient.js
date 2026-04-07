// lib/scanProgressClient.js
import Constants from "expo-constants";

const BACKEND_URL =
  Constants?.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getProgress(scanJobId) {
  if (!BACKEND_URL) throw new Error("Missing EXPO_PUBLIC_BACKEND_URL");
  const url = `${BACKEND_URL.replace(/\/$/, "")}/scan/progress?scanJobId=${encodeURIComponent(scanJobId)}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Progress fetch failed (${res.status}): ${txt || "unknown"}`);
  }
  return res.json();
}

/**
 * Polls progress until done/error/timeout
 * expected response shape (flexible):
 * {
 *   phase: "starting"|"scanning"|"extracting"|"done"|"error",
 *   scanned: number,
 *   estimatedTotal?: number|null,
 *   found?: number,
 *   message?: string,
 *   done?: boolean,
 * }
 */
export async function pollScanProgress({ scanJobId, onTick, intervalMs = 900, timeoutMs = 10 * 60_000 }) {
  const started = Date.now();

  while (true) {
    if (Date.now() - started > timeoutMs) {
      onTick?.({ phase: "error", message: "Scan timed out. Try again.", scanJobId });
      return;
    }

    const p = await getProgress(scanJobId);

    // normalize
    const normalized = {
      scanJobId,
      phase: p.phase || (p.done ? "done" : "scanning"),
      scanned: Number(p.scanned || 0),
      estimatedTotal: p.estimatedTotal ?? p.total ?? null,
      found: Number(p.found || p.candidates || 0),
      message: p.message || "",
      done: !!p.done || p.phase === "done",
      error: p.error || null,
      ts: Date.now(),
    };

    onTick?.(normalized);

    if (normalized.phase === "done" || normalized.done) return;
    if (normalized.phase === "error" || normalized.error) return;

    await sleep(intervalMs);
  }
}
