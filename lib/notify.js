import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false }),
});

export async function ensureNotificationPermission() {
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    const res = await Notifications.requestPermissionsAsync();
    status = res.status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.DEFAULT });
  }
  return status === 'granted';
}

// ---------- Renewals ----------
export async function scheduleRenewalNotifications(sub) {
  const ok = await ensureNotificationPermission().catch(() => false);
  if (!ok) return [];

  const ids = [];
  const when = new Date((sub.nextRenewal || '') + 'T09:00:00');
  if (isNaN(when)) return ids;
  const targets = [7, 1].map(days => {
    const t = new Date(when);
    t.setDate(t.getDate() - days);
    return t;
  });

  const snoozeUntil = sub.snoozeUntil ? new Date(sub.snoozeUntil + 'T00:00:00') : null;

  for (const trigger of targets) {
    if (trigger <= new Date()) continue;
    if (snoozeUntil && trigger < snoozeUntil) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Upcoming: ${sub.merchant}`,
        body: `${(sub.currency || 'USD')} ${Number(sub.amount).toFixed(2)} due ${sub.nextRenewal}`,
        data: { id: sub.id, type: 'renewal' },
      },
      trigger,
    });
    ids.push(id);
  }
  return ids;
}

// ---------- Trials ----------
export async function scheduleTrialNotifications(sub) {
  const ok = await ensureNotificationPermission().catch(() => false);
  if (!ok) return [];

  const ids = [];
  const end = sub?.trial?.end ? new Date(sub.trial.end + 'T09:00:00') : null;
  if (!end || isNaN(end)) return ids;

  const targets = [3, 1].map(days => {
    const t = new Date(end);
    t.setDate(t.getDate() - days);
    return t;
  });

  const snoozeUntil = sub.snoozeUntil ? new Date(sub.snoozeUntil + 'T00:00:00') : null;

  for (const trigger of targets) {
    if (trigger <= new Date()) continue;
    if (snoozeUntil && trigger < snoozeUntil) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Trial ending: ${sub.merchant}`,
        body: `Ends ${sub.trial.end}. Decide to cancel or convert.`,
        data: { id: sub.id, type: 'trial' },
      },
      trigger,
    });
    ids.push(id);
  }
  return ids;
}

// ---------- Cancel follow-up (confirm email arrived) ----------
export async function scheduleCancelFollowup(sub, hours = 24) {
  const ok = await ensureNotificationPermission().catch(() => false);
  if (!ok) return null;

  const when = new Date();
  when.setHours(when.getHours() + Math.max(1, hours));

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `Did ${sub.merchant} send a cancel email?`,
      body: 'If not, double-check your account some vendors require chat/phone.',
      data: { id: sub.id, type: 'cancel_followup' },
    },
    trigger: when,
  });
  return { id, whenISO: when.toISOString() };
}

export async function cancelScheduled(ids = []) {
  await Promise.all((ids || []).map(id => Notifications.cancelScheduledNotificationAsync(id)));
}
