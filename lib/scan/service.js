// lib/scan/service.js
import { scanBus } from "./bus";
import Constants from "expo-constants";

const BACKEND_URL =
  Constants?.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "";

const EMAIL_IMPORT_URL =
  Constants?.expoConfig?.extra?.EXPO_PUBLIC_EMAIL_IMPORT_API_URL ||
  process.env.EXPO_PUBLIC_EMAIL_IMPORT_API_URL ||
  "";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- MOCK TRANSPORT (dev) ---
function startMockScan({ range, promos, limit }) {
  const scanId = `mock_${Date.now()}`;
  let pct = 0;
  let scanned = 0;
  let receipts = 0;
  let subs = 0;

  const hardLimit = Number.isFinite(Number(limit)) ? Math.max(0, Number(limit)) : null;

  const timer = setInterval(() => {
    const step = 57;

    if (hardLimit != null && scanned >= hardLimit) {
      pct = 100;
      scanBus.emit("scan:progress", { scanId, pct, scanned, receipts, subs, phase: "done" });
      clearInterval(timer);
      scanBus.emit("scan:done", { scanId });
      return;
    }

    scanned += step;
    if (hardLimit != null && scanned > hardLimit) scanned = hardLimit;

    receipts += Math.random() > 0.7 ? 2 : 1;
    subs += Math.random() > 0.82 ? 1 : 0;

    if (hardLimit != null && hardLimit > 0) {
      pct = Math.min(100, Math.round((scanned / hardLimit) * 100));
    } else {
      pct = Math.min(100, pct + 3);
    }

    scanBus.emit("scan:progress", { scanId, pct, scanned, receipts, subs, phase: "scanning" });

    if (pct >= 100) {
      clearInterval(timer);
      scanBus.emit("scan:done", { scanId });
    }
  }, 450);

  return scanId;
}

// --- BACKEND TRANSPORT ---
// The Render email-import backend exposes POST /scan (synchronous — no polling).
// We emit progress events while waiting so the UI doesn't stall.
async function startBackendScan({ range, promos, limit, accessToken }) {
  const baseUrl = EMAIL_IMPORT_URL || BACKEND_URL;
  if (!baseUrl) throw new Error("Missing EXPO_PUBLIC_EMAIL_IMPORT_API_URL");

  const scanId = `backend_${Date.now()}`;

  // Emit an immediate progress event so the scanning screen shows activity
  scanBus.emit("scan:progress", { scanId, pct: 5, scanned: 0, receipts: 0, subs: 0, phase: "scanning" });

  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  // Emit incremental fake progress while the synchronous scan runs
  // (the backend takes 10-30s for a real inbox)
  let fakePct = 5;
  const progressTimer = setInterval(() => {
    fakePct = Math.min(90, fakePct + Math.random() * 8 + 2);
    scanBus.emit("scan:progress", {
      scanId,
      pct: Math.round(fakePct),
      scanned: Math.round(fakePct * 5),
      receipts: Math.round(fakePct * 0.8),
      subs: Math.round(fakePct * 0.1),
      phase: "scanning",
    });
  }, 1200);

  try {
    const daysBack = range === "1y" ? 365 : range === "6m" ? 180 : range === "3m" ? 90 : 180;

    const res = await fetch(`${baseUrl}/scan`, {
      method: "POST",
      headers,
      body: JSON.stringify({ daysBack, promos: !!promos }),
    });

    clearInterval(progressTimer);

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { const j = await res.json(); detail = j?.error || detail; } catch {}
      throw new Error(`scan failed: ${detail}`);
    }

    const data = await res.json();

    // Emit final progress and done
    scanBus.emit("scan:progress", {
      scanId,
      pct: 100,
      scanned: data?.meta?.scannedMessages ?? 0,
      receipts: data?.meta?.detectedCharges ?? 0,
      subs: data?.detectedSubscriptions ?? 0,
      phase: "done",
    });

    scanBus.emit("scan:done", { scanId, result: data });
    return scanId;

  } catch (e) {
    clearInterval(progressTimer);
    throw e;
  }
}

// --- PUBLIC API ---
export async function startScan({ range, promos, transport = "mock", limit, accessToken }) {
  if (transport === "backend") {
    const scanId = await startBackendScan({ range, promos, limit, accessToken });
    return scanId;
  }

  return startMockScan({ range, promos, limit });
}