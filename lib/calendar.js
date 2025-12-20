// lib/calendar.js
// Renewal stepping and ICS export

import { normalizeCadence, stepByCadence } from "./utils";

/** Compute the next renewal date from an anchor + cadence, ensuring it's in the future */
export function computeNextRenewal(anchorDate, cadence) {
  if (!anchorDate) return null;
  const c = normalizeCadence(cadence);
  let d = new Date(anchorDate);
  const today = new Date();
  // Step forward until > today (max 100 steps safety)
  let guard = 0;
  while (d <= today && guard < 100) {
    d = stepByCadence(d, c);
    guard++;
  }
  return d;
}

/** Build a list of future renewals within horizonDays */
export function projectRenewals(anchorDate, cadence, horizonDays = 365) {
  const list = [];
  if (!anchorDate) return list;
  const c = normalizeCadence(cadence);
  let d = new Date(anchorDate);
  const now = new Date();
  const end = new Date(now.getTime() + horizonDays * 86400000);
  let guard = 0;
  while (d <= end && guard < 100) {
    if (d > now) list.push(new Date(d));
    d = stepByCadence(d, c);
    guard++;
  }
  return list;
}

/** Generate a minimal ICS file text for an array of events */
export function generateICS(events) {
  // events: [{ title, description, start: Date, durationMinutes }]
  function toICSDate(dt) {
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const hh = String(dt.getUTCHours()).padStart(2, "0");
    const mi = String(dt.getUTCMinutes()).padStart(2, "0");
    const ss = String(dt.getUTCSeconds()).padStart(2, "0");
    return `${yyyy}${mm}${dd}T${hh}${mi}${ss}Z`;
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SubTracker//MVP//EN"
  ];

  events.forEach((e, idx) => {
    const start = e.start instanceof Date ? e.start : new Date(e.start);
    const end = new Date(start.getTime() + (e.durationMinutes || 30) * 60000);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${cryptoLikeUID(idx)}@subtracker`);
    lines.push(`DTSTAMP:${toICSDate(new Date())}`);
    lines.push(`DTSTART:${toICSDate(start)}`);
    lines.push(`DTEND:${toICSDate(end)}`);
    lines.push(`SUMMARY:${escapeICS(e.title || "Subscription Renewal")}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeICS(e.description)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function escapeICS(text) {
  return String(text).replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
}

function cryptoLikeUID(seed) {
  // Simple UID for MVP
  const rnd = Math.random().toString(36).slice(2);
  return `${Date.now()}-${seed}-${rnd}`;
}
