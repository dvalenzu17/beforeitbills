// lib/streak.js
// Tracks consecutive-day app opens. Pure AsyncStorage - no server needed.
// Call tickStreak() on each app_opened event; it's idempotent within a day.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sublytics:streak:v1';

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayStr() {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function loadStreak() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { current: 0, best: 0, lastDate: null };
  } catch {
    return { current: 0, best: 0, lastDate: null };
  }
}

/**
 * Tick the streak for today. Returns the updated streak object.
 * Safe to call multiple times per day - no-ops after the first tick.
 */
export async function tickStreak() {
  const state = await loadStreak();
  const today = todayStr();
  const yesterday = yesterdayStr();

  // Already ticked today - idempotent
  if (state.lastDate === today) return state;

  const next =
    state.lastDate === yesterday
      ? { current: (state.current || 0) + 1, best: Math.max((state.best || 0), (state.current || 0) + 1), lastDate: today }
      : { current: 1, best: Math.max(state.best || 0, 1), lastDate: today };

  try { await AsyncStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

/** Milestones in days. Returns the next one above `current`. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

export function nextMilestone(current) {
  return STREAK_MILESTONES.find((m) => m > current) ?? 100;
}
