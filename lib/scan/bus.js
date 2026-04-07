// lib/scan/bus.js
import mitt from "mitt";

// Events:
// "scan:progress"  payload: { scanId, pct, scanned, receipts, subs, phase? }
// "scan:done"      payload: { scanId }
// "scan:error"     payload: { scanId, message }

export const scanBus = mitt();
