// lib/notifications.js
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { cadenceToSuffix } from "./formatters";

export const ANDROID_TRIAL_CHANNEL_ID = "trial-reminders";
export const ANDROID_PRICE_CHANNEL_ID = "price-alerts";
export const ANDROID_NEWSUB_CHANNEL_ID = "new-subscriptions";

// Do NOT call setNotificationHandler at module-eval time.
// On iOS 26, any void TurboModule method that throws causes a Hermes GC race
// inside convertNSArrayToJSIArray → KERN_INVALID_ADDRESS crash.
// Call initNotificationHandler() explicitly from the app bootstrap instead.
let _handlerInstalled = false;
export function initNotificationHandler() {
  if (_handlerInstalled) return;
  _handlerInstalled = true;
  // Skip on iOS 26+ until expo-notifications ships a compatible release.
  const iosMajor = Platform.OS === "ios" ? parseInt(String(Platform.Version), 10) : 0;
  if (iosMajor >= 26) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {}
}

export async function ensureNotificationReady() {
  // Android channels (safe to call multiple times)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_TRIAL_CHANNEL_ID, {
      name: "Trial reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync(ANDROID_PRICE_CHANNEL_ID, {
      name: "Price alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 120, 200],
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync(ANDROID_NEWSUB_CHANNEL_ID, {
      name: "New subscriptions",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }

  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === "granted";
  }
  return true;
}

function formatCurrency(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return String(amount ?? "");
  const sym =
    currency === "USD" ? "$" :
    currency === "EUR" ? "€" :
    currency === "GBP" ? "£" :
    currency === "CAD" ? "CA$" :
    currency === "AUD" ? "A$" :
    `${currency || "USD"} `;
  return `${sym}${n.toFixed(2)}`;
}

function nextLocal9am(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * Schedules a reminder for "1 day before trial ends at 9am local".
 * If that time is in the past, schedules 5 minutes from now (so you can test).
 */
export async function scheduleTrialReminder({
  id, // stable id for your subscription/trial item
  brand,
  domain,
  trialEndsAt, // ISO string or Date
  amount,
  currency = "USD",
  daysBefore = 1,
}) {
  const ok = await ensureNotificationReady();
  if (!ok) return { ok: false, reason: "permissions_denied" };

  const end = new Date(trialEndsAt);
  if (Number.isNaN(end.getTime())) return { ok: false, reason: "bad_date" };

  const remind = new Date(end.getTime() - daysBefore * 24 * 60 * 60 * 1000);
  const remindAt = nextLocal9am(remind);

  const now = new Date();
  const triggerDate = remindAt > now ? remindAt : new Date(now.getTime() + 5 * 60 * 1000);

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${brand} trial ending soon`,
      body: `Your trial ends ${end.toISOString().slice(0, 10)}. Cancel before you get charged${
        amount ? ` (~${formatCurrency(amount, currency)})` : ""
      }.`,
      sound: "default",
      data: {
        type: "trial_end",
        brand,
        domain,
        trialEndsAt: end.toISOString(),
        subId: id || null,
      },
    },
    trigger:
      Platform.OS === "android"
        ? { date: triggerDate, channelId: ANDROID_TRIAL_CHANNEL_ID }
        : { date: triggerDate },
  });

  return { ok: true, notificationId, triggerDate: triggerDate.toISOString() };
}

export async function cancelTrialReminder(notificationId) {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Fires an immediate “price changed” notification.
 * Tap → Brand page w/ highlight card.
 */
export async function schedulePriceChangeNotification({
  brand,
  domain,
  oldAmount,
  newAmount,
  currency = "USD",
  effectiveDate, // YYYY-MM-DD (optional)
}) {
  const ok = await ensureNotificationReady();
  if (!ok) return { ok: false, reason: "permissions_denied" };

  const title = `${brand || "Subscription"} price changed`;
  const body = `${formatCurrency(oldAmount, currency)} → ${formatCurrency(newAmount, currency)}`;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: {
        type: "price_change",
        brand: brand || "",
        domain: domain || "",
        old: oldAmount,
        new: newAmount,
        currency,
        effective: effectiveDate || "",
      },
    },
    trigger:
      Platform.OS === "android"
        ? { channelId: ANDROID_PRICE_CHANNEL_ID }
        : null, // immediate
  });

  return { ok: true, notificationId };
}

// Internal: ensure the new-subscription channel exists without prompting for
// permission. These alerts fire automatically after a scan, so we must never
// trigger a permission request here - only notify if already granted.
async function ensureNewSubChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ANDROID_NEWSUB_CHANNEL_ID, {
      name: "New subscriptions",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      sound: "default",
    });
  }
}

/**
 * Fires an immediate "new potential subscription detected" notification.
 * Tap → email review screen to confirm or dismiss the candidate.
 * Does NOT request permission (fires after a scan) - skips silently if not granted.
 */
export async function scheduleNewSubscriptionNotification({
  merchant,
  amount,
  currency = "USD",
  cadence,
  domain,
}) {
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") return { ok: false, reason: "permissions_denied" };

  await ensureNewSubChannel();

  const name = merchant || "Subscription";
  const amtStr = amount != null ? formatCurrency(amount, currency) : "";
  const priceStr = amtStr ? `${amtStr}${cadenceToSuffix(cadence)}` : "";

  const title = `New subscription detected: ${name}`;
  const body = priceStr
    ? `Looks like ${priceStr}. Tap to confirm or dismiss.`
    : `Tap to confirm or dismiss this potential subscription.`;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: "default",
      data: {
        app: "sublytics",
        kind: "new_subscription",
        type: "new_subscription",
        merchant: name,
        amount: amount ?? null,
        currency,
        cadence: cadence ?? null,
        domain: domain ?? null,
      },
    },
    trigger:
      Platform.OS === "android"
        ? { channelId: ANDROID_NEWSUB_CHANNEL_ID }
        : null, // immediate
  });

  return { ok: true, notificationId };
}

/**
 * Fires a single summary notification when a scan turns up several new
 * potential subscriptions at once (avoids a burst of individual alerts).
 */
export async function scheduleNewSubscriptionsSummary(count) {
  if (!count || count < 1) return { ok: false, reason: "nothing" };

  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") return { ok: false, reason: "permissions_denied" };

  await ensureNewSubChannel();

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${count} new potential subscriptions`,
      body: `We spotted ${count} new charges that look like subscriptions. Tap to review.`,
      sound: "default",
      data: { app: "sublytics", kind: "new_subscription", type: "new_subscription" },
    },
    trigger:
      Platform.OS === "android"
        ? { channelId: ANDROID_NEWSUB_CHANNEL_ID }
        : null, // immediate
  });

  return { ok: true, notificationId };
}