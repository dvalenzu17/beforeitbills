// lib/scan/useScanProgress.js
import { useEffect, useMemo, useState } from "react";
import { generateDemoData } from "../demo/generateDemoData";
import { scanBus } from "./bus";
import { useRecordingStore } from "../recordingMode";

export function useScanProgress(scanId) {
  const [state, setState] = useState({
    pct: 0,
    scanned: 0,
    receipts: 0,
    subs: 0,
    phase: "idle",
    done: false,
    error: null,
    demoData: null,
  });

  const isDemo = scanId?.startsWith("demo");
  const isRecording = scanId?.startsWith("recording");

  useEffect(() => {
    if (!scanId) return;

    // ── RECORDING MODE ────────────────────────────────────────────────────
    if (isRecording) {
      const persona = useRecordingStore.getState().persona;
      if (!persona) return;

      const { subs, emailsScanned, receiptsFound } = persona;
      const total = subs.length;
      const scanDurationMs = 3500 + Math.random() * 2000; // 3.5–5.5 s
      const tickMs = scanDurationMs / total;

      let i = 0;
      let emailTick = 0;

      setState((s) => ({ ...s, phase: "scanning" }));

      const interval = setInterval(() => {
        i++;
        emailTick = Math.min(
          emailsScanned,
          emailTick + Math.ceil(emailsScanned / total) + Math.floor(Math.random() * 15)
        );
        const receiptsSoFar = Math.min(receiptsFound, Math.ceil((i / total) * receiptsFound));

        setState((s) => ({
          ...s,
          pct: Math.min(100, Math.round((i / total) * 100)),
          scanned: emailTick,
          receipts: receiptsSoFar,
          subs: i,
        }));

        if (i >= total) {
          clearInterval(interval);
          setState((s) => ({
            ...s,
            pct: 100,
            scanned: emailsScanned,
            receipts: receiptsFound,
            subs: total,
            done: true,
            phase: "done",
          }));
        }
      }, tickMs + Math.random() * (tickMs * 0.3));

      return () => clearInterval(interval);
    }

    // ✅ DEMO MODE (does NOT affect real scans)
    if (isDemo) {
      const data = generateDemoData();

      let i = 0;
      const total = data.subscriptions.length;

      setState((s) => ({
        ...s,
        phase: "scanning",
        demoData: data, // 👈 store full dataset
      }));

      const interval = setInterval(() => {
        i++;

        setState((s) => ({
          ...s,
          pct: Math.min(100, Math.floor((i / total) * 100)),
          scanned: s.scanned + Math.floor(Math.random() * 20),
          receipts: s.receipts + Math.floor(Math.random() * 5),
          subs: i,
        }));

        if (i >= total) {
          clearInterval(interval);
          setState((s) => ({
            ...s,
            done: true,
            phase: "done",
          }));
        }
      }, 350 + Math.random() * 200); // 👈 natural variation

      return () => clearInterval(interval);
    }

    // ✅ REAL SCAN (UNCHANGED)
    const onProgress = (p) => {
      if (p.scanId !== scanId) return;
      setState((s) => ({
        ...s,
        pct: p.pct ?? s.pct,
        scanned: p.scanned ?? s.scanned,
        receipts: p.receipts ?? s.receipts,
        subs: p.subs ?? s.subs,
        phase: p.phase || "scanning",
      }));
    };

    const onDone = (p) => {
      if (p.scanId !== scanId) return;
      setState((s) => ({ ...s, done: true, phase: "done" }));
    };

    const onError = (p) => {
      if (p.scanId !== scanId) return;
      setState((s) => ({
        ...s,
        error: p.message || "Scan error",
        phase: "error",
      }));
    };

    scanBus.on("scan:progress", onProgress);
    scanBus.on("scan:done", onDone);
    scanBus.on("scan:error", onError);

    return () => {
      scanBus.off("scan:progress", onProgress);
      scanBus.off("scan:done", onDone);
      scanBus.off("scan:error", onError);
    };
  }, [scanId]);

  return useMemo(() => state, [state]);
}