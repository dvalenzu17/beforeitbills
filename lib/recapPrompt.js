// lib/recapPrompt.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sublytics:recapPrompt:v1';

function monthKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function lastDayOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export async function shouldAutoOpenRecap({ recap, now = new Date() }) {
  const mk = monthKey(now);

  // only prompt near month-end (30th or last day if month shorter)
  const threshold = Math.min(30, lastDayOfMonth(now));
  if (now.getDate() < threshold) return false;

  const completedAt = recap?.months?.[mk]?.completedAt;
  if (completedAt) return false;

  const raw = await AsyncStorage.getItem(KEY);
  const state = raw ? JSON.parse(raw) : {};
  if (state?.lastPromptedMonth === mk) return false;

  return true;
}

export async function markRecapPrompted(now = new Date()) {
  const mk = monthKey(now);
  await AsyncStorage.setItem(KEY, JSON.stringify({ lastPromptedMonth: mk }));
}
