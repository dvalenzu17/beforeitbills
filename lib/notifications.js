// lib/notifications.js
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

export const ANDROID_TRIAL_CHANNEL_ID = "trial-reminders";
export const ANDROID_PRICE_CHANNEL_ID = "price-alerts";

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
  }

  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    return req.status === "granted";
  }
  return true;
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
        amount ? ` (~${currency} ${amount})` : ""
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
  const body = `From ${oldAmount} ${currency} → ${newAmount} ${currency}`;

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