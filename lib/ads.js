// lib/ads.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "sublytics_ads_state_v1";

// “Demure” rules:
// - never show more than 1 ad card per screen
// - never show interstitials
// - cap frequency (e.g., 1 ad per 3 app opens)
const DEFAULTS = {
  enabled: true,
  showEveryNLaunches: 3,
  launchCount: 0,
  lastShownAt: null,
};

const HOUSE_ADS = [
  {
    id: "house_1",
    label: "Sponsored",
    title: "Save money faster",
    body: "Try marking your top 3 subscriptions as “must-keep”. Everything else is optional.",
    cta: "Got it",
  },
  {
    id: "house_2",
    label: "Tip",
    title: "Cancel center = cheat code",
    body: "When you cancel something, mark it canceled here so reminders stop automatically.",
    cta: "Nice",
  },
];

async function readState() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULTS, ...(parsed || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

async function writeState(next) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export async function trackLaunch() {
  const s = await readState();
  const next = { ...s, launchCount: (s.launchCount || 0) + 1 };
  await writeState(next);
  return next;
}

export async function shouldShowAd({ isPro }) {
  if (isPro) return false;

  const s = await readState();
  if (!s.enabled) return false;

  const n = Number(s.showEveryNLaunches || DEFAULTS.showEveryNLaunches);
  const count = Number(s.launchCount || 0);

  // show on Nth launch boundary
  if (n <= 1) return true;
  return count % n === 0;
}

export function pickHouseAd(seed = 0) {
  const idx = Math.abs(Number(seed) || 0) % HOUSE_ADS.length;
  return HOUSE_ADS[idx];
}

export async function markAdShown() {
  const s = await readState();
  const next = { ...s, lastShownAt: new Date().toISOString() };
  await writeState(next);
  return next;
}

export async function setAdsEnabled(enabled) {
  const s = await readState();
  const next = { ...s, enabled: Boolean(enabled) };
  await writeState(next);
  return next;
}
