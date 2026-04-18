import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

const MUTE_KEY = "@sublytics_notifications_muted_v1"; // handled-per-cycle
const PAUSE_KEY = "@sublytics_notifications_paused_items_v1"; // paused-per-item
const CATEGORY_ID = "SUBLYTICS_REMINDER_V2";
const ANDROID_CHANNEL_ID = "renewals-v2";
const BRAND_COLOR = "#7DD3FC";

// ---- utils ----
function fmtTimeOfDay(s) {
  const v = String(s || "").trim();
  const m = v.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return m ? v : "09:00";
}

function parseDateFlexible(s) {
  if (!s) return null;
  if (s instanceof Date) return isNaN(s) ? null : s;
  if (typeof s !== "string") return null;
  const str = s.trim();

  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt) ? null : dt;
  }

  const us = str.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (us) {
    const m = Number(us[1]);
    const d = Number(us[2]);
    const y = Number(us[3]);
    const dt = new Date(y, m - 1, d);
    return isNaN(dt) ? null : dt;
  }

  const dt = new Date(str);
  return isNaN(dt) ? null : dt;
}

function atTime(date, timeOfDay) {
  const safe = fmtTimeOfDay(timeOfDay);
  const [hh, mm] = safe.split(":").map((x) => Number(x));
  const d = new Date(date);
  d.setHours(hh);
  d.setMinutes(mm);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}

function fmtDate(d) {
  if (!(d instanceof Date) || isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDateFriendly(d) {
  if (!(d instanceof Date) || isNaN(d)) return "";
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function fmtAmt(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "";
  const sym =
    currency === "USD" ? "$" :
    currency === "EUR" ? "€" :
    currency === "GBP" ? "£" :
    currency === "CAD" ? "CA$" :
    `${currency || "USD"} `;
  return `${sym}${n.toFixed(2)}`;
}

function buildRenewalCopy(name, windowDays, date, amount, currency) {
  const dateStr = fmtDateFriendly(date);
  const amtStr = fmtAmt(amount, currency);

  let when;
  if (windowDays <= 0)  when = "today";
  else if (windowDays === 1) when = "tomorrow";
  else when = `in ${windowDays} days`;

  const title = `${name} — renewing ${when}`;
  const parts = [];
  if (amtStr) parts.push(amtStr);
  if (dateStr) parts.push(dateStr);
  const body = parts.join(" · ");

  return { title, body };
}

function buildBillCopy(name, windowDays, date, amount, currency) {
  const dateStr = fmtDateFriendly(date);
  const amtStr = fmtAmt(amount, currency);

  let when;
  if (windowDays <= 0)  when = "today";
  else if (windowDays === 1) when = "tomorrow";
  else when = `in ${windowDays} days`;

  const title = `${name} — due ${when}`;
  const parts = [];
  if (amtStr) parts.push(amtStr);
  if (dateStr) parts.push(dateStr);
  const body = parts.join(" · ");

  return { title, body };
}

function timeToMinutes(hhmm) {
  const safe = fmtTimeOfDay(hhmm);
  const [hh, mm] = safe.split(":").map((x) => Number(x));
  return hh * 60 + mm;
}

function dateMinutes(d) {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Quiet hours logic supports overnight windows:
 * - start < end (e.g. 22:00 -> 23:00) normal window
 * - start > end (e.g. 22:00 -> 07:00) wraps midnight
 */
function isInQuietHours(date, start, end) {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const m = dateMinutes(date);

  if (s === e) return false; // treat same as disabled
  if (s < e) return m >= s && m < e; // same-day window
  return m >= s || m < e; // overnight window
}

function nextAllowedTime(date, quietStart, quietEnd) {
  // move to end of quiet window
  const endMins = timeToMinutes(quietEnd);
  const out = new Date(date);

  // Set time to quietEnd today
  out.setHours(Math.floor(endMins / 60));
  out.setMinutes(endMins % 60);
  out.setSeconds(0);
  out.setMilliseconds(0);

  // If still in quiet hours (overnight case where end is next morning but our "today" might be wrong),
  // bump by 1 day and set to end again.
  if (isInQuietHours(out, quietStart, quietEnd)) {
    out.setDate(out.getDate() + 1);
    out.setHours(Math.floor(endMins / 60));
    out.setMinutes(endMins % 60);
    out.setSeconds(0);
    out.setMilliseconds(0);
  }

  // If we accidentally moved backwards (rare), bump one day.
  if (out <= date) {
    out.setDate(out.getDate() + 1);
  }

  return out;
}

function applyQuietHours(when, quietEnabled, quietStart, quietEnd) {
  if (!quietEnabled) return when;
  const s = fmtTimeOfDay(quietStart);
  const e = fmtTimeOfDay(quietEnd);
  if (s === e) return when;
  if (!isInQuietHours(when, s, e)) return when;
  return nextAllowedTime(when, s, e);
}

// ---- permissions / channels / categories ----
export async function ensureNotificationPerms() {
  const perms = await Notifications.getPermissionsAsync();
  if (perms.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== "granted") throw new Error("Notifications not allowed");
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Renewals & Bills",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: BRAND_COLOR,
      sound: "default",
    });
  }
}

export async function ensureNotificationCategory() {
  try {
    await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
      { identifier: "VIEW_DETAILS", buttonTitle: "View", options: { opensAppToForeground: true } },
      { identifier: "SNOOZE_1D", buttonTitle: "Snooze 1 day", options: { opensAppToForeground: false } },
      { identifier: "MARK_HANDLED", buttonTitle: "Done", options: { opensAppToForeground: false } },
    ]);
  } catch {}
}

// ---- handled-per-cycle store ----
async function readMuted() {
  try {
    const raw = await AsyncStorage.getItem(MUTE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeMuted(next) {
  try {
    await AsyncStorage.setItem(MUTE_KEY, JSON.stringify(next));
  } catch {}
}

function muteKey({ kind, id, dateISO }) {
  return `${kind}:${id}:${dateISO}`;
}

export async function isMutedCycle({ kind, id, dateISO }) {
  const muted = await readMuted();
  return !!muted[muteKey({ kind, id, dateISO })];
}

export async function markHandledCycle({ kind, id, dateISO }) {
  const muted = await readMuted();
  muted[muteKey({ kind, id, dateISO })] = { at: new Date().toISOString() };
  await writeMuted(muted);
}

export async function unmarkHandledCycle({ kind, id, dateISO }) {
  const muted = await readMuted();
  delete muted[muteKey({ kind, id, dateISO })];
  await writeMuted(muted);
}

// ---- paused-per-item store ----
async function readPaused() {
  try {
    const raw = await AsyncStorage.getItem(PAUSE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writePaused(next) {
  try {
    await AsyncStorage.setItem(PAUSE_KEY, JSON.stringify(next));
  } catch {}
}

function pauseKey({ kind, id }) {
  return `${kind}:${id}`;
}

export async function isPausedItem({ kind, id }) {
  const paused = await readPaused();
  return !!paused[pauseKey({ kind, id })];
}

export async function setPausedItem({ kind, id }, paused) {
  const map = await readPaused();
  const k = pauseKey({ kind, id });
  if (paused) map[k] = { at: new Date().toISOString() };
  else delete map[k];
  await writePaused(map);
}

// ---- build upcoming reminders ----
export async function buildUpcoming({
  subs = [],
  bills = [],
  daysBefore = [7, 3, 1],
  timeOfDay = "09:00",
  quietEnabled = false,
  quietStart = "22:00",
  quietEnd = "07:00",
}) {
  const list = [];
  const safeTime = fmtTimeOfDay(timeOfDay);
  const now = new Date();

  for (const s of subs) {
    const base = parseDateFlexible(s.nextRenewal);
    if (!base) continue;

    const dateISO = fmtDate(base);
    const id = String(s.id ?? "");
    const name = s.merchant || "Subscription";
    const amount = s.amount ?? s.price ?? null;
    const currency = s.currency || "USD";
    const domain = s.domain || s.website || null;

    // per-item pause
    const paused = await isPausedItem({ kind: "renewal", id });
    if (paused) continue;

    for (const w of daysBefore) {
      const fire = new Date(base);
      fire.setDate(fire.getDate() - Number(w));
      let when = atTime(fire, safeTime);

      // quiet hours adjustment
      when = applyQuietHours(when, quietEnabled, quietStart, quietEnd);

      if (when <= now) continue;

      const muted = await isMutedCycle({ kind: "renewal", id, dateISO });
      if (muted) continue;

      list.push({ kind: "renewal", id, name, amount, currency, domain, when, window: Number(w), date: base, dateISO });
    }
  }

  for (const b of bills) {
    const base = parseDateFlexible(b.nextDue);
    if (!base) continue;

    const dateISO = fmtDate(base);
    const id = String(b.id ?? "");
    const name = b.name || "Bill";
    const amount = b.amount ?? null;
    const currency = b.currency || "USD";
    const domain = b.domain || null;

    const paused = await isPausedItem({ kind: "bill", id });
    if (paused) continue;

    for (const w of daysBefore) {
      const fire = new Date(base);
      fire.setDate(fire.getDate() - Number(w));
      let when = atTime(fire, safeTime);

      when = applyQuietHours(when, quietEnabled, quietStart, quietEnd);

      if (when <= now) continue;

      const muted = await isMutedCycle({ kind: "bill", id, dateISO });
      if (muted) continue;

      list.push({ kind: "bill", id, name, amount, currency, domain, when, window: Number(w), date: base, dateISO });
    }
  }

  return list.sort((a, b) => a.when - b.when);
}

// ---- scheduling ----
function isOurReminder(n) {
  const d = n?.content?.data;
  return d?.app === "sublytics" && ["renewal", "bill"].includes(d?.kind);
}

export async function clearScheduledSublyticsReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = (scheduled || []).filter(isOurReminder);
  await Promise.all(ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  return ours.length;
}

export async function scheduleAll({
  subs,
  bills,
  enabled,
  daysBefore,
  timeOfDay,
  quietEnabled = false,
  quietStart = "22:00",
  quietEnd = "07:00",
  cap = 80,
}) {
  await ensureNotificationPerms();
  await ensureNotificationCategory();

  await clearScheduledSublyticsReminders();

  if (!enabled) return { scheduled: 0 };

  const upcoming = await buildUpcoming({
    subs,
    bills,
    daysBefore,
    timeOfDay,
    quietEnabled,
    quietStart,
    quietEnd,
  });

  const toSchedule = upcoming.slice(0, cap);

  let count = 0;
  for (const x of toSchedule) {
    const { title, body } =
      x.kind === "renewal"
        ? buildRenewalCopy(x.name, x.window, x.date, x.amount, x.currency)
        : buildBillCopy(x.name, x.window, x.date, x.amount, x.currency);

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        categoryIdentifier: CATEGORY_ID,
        sound: "default",
        ...(Platform.OS === "android" && {
          android: {
            channelId: ANDROID_CHANNEL_ID,
            color: BRAND_COLOR,
            smallIcon: "ic_notification",
          },
        }),
        data: {
          app: "sublytics",
          kind: x.kind,
          id: x.id,
          dateISO: x.dateISO,
          window: x.window,
          name: x.name,
          amount: x.amount,
          currency: x.currency,
          domain: x.domain,
        },
      },
      trigger: x.when,
    });

    count += 1;
  }

  return { scheduled: count, preview: upcoming.slice(0, 8) };
}

// ---- runtime actions from notification buttons ----
export async function handleNotificationAction(response) {
  const actionId = response?.actionIdentifier;
  const data = response?.notification?.request?.content?.data;

  if (!data || data.app !== "sublytics") return { ok: false, reason: "not_ours" };

  const payload = {
    kind: String(data.kind || ""),
    id: String(data.id || ""),
    dateISO: String(data.dateISO || ""),
  };

  if (actionId === "VIEW_DETAILS" || actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    // Caller navigates — return the navigation target
    const screen = data.kind === "bill" ? `/bill/${data.id}` : `/sub/${data.id}`;
    return { ok: true, action: "view", screen };
  }

  if (actionId === "MARK_HANDLED") {
    await markHandledCycle(payload);
    return { ok: true, action: "handled" };
  }

  if (actionId === "SNOOZE_1D") {
    await markHandledCycle(payload);

    // one-off ping tomorrow at 09:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const when = atTime(tomorrow, "09:00");

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Snoozed reminder",
        body: `Quick nudge: ${data.name || "Item"} is coming up.`,
        data: { app: "sublytics", kind: "snooze", ref: payload },
      },
      trigger: when,
    });

    return { ok: true, action: "snooze" };
  }

  return { ok: false, reason: "unknown_action" };
}
