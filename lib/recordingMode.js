// lib/recordingMode.js
//
// Recording Mode — zero backend impact, purely additive.
// When active, every screen reads from this store instead of real data.
// Generates a fresh randomised US persona on each activation.

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "bib:recording:v1";

// ─── Data pools ──────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  "James", "Olivia", "Liam", "Emma", "Noah", "Ava", "William", "Sophia",
  "Benjamin", "Isabella", "Lucas", "Mia", "Henry", "Charlotte", "Alexander",
  "Amelia", "Mason", "Harper", "Ethan", "Evelyn", "Daniel", "Abigail",
  "Logan", "Emily", "Jackson", "Elizabeth", "Sebastian", "Camila", "Jack",
  "Luna", "Aiden", "Sofia", "Owen", "Avery", "Samuel", "Ella", "Ryan",
  "Scarlett", "Nathan", "Victoria", "Carter", "Madison", "Caleb", "Layla",
  "Luke", "Penelope", "Isaac", "Riley", "Hunter", "Zoey",
];

const LAST_NAMES = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
  "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
  "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
];

// Realistic US subscription pool with real pricing tiers
const SUBSCRIPTION_POOL = [
  { name: "Netflix",          domain: "netflix.com",         amounts: [6.99, 15.49, 22.99], category: "Streaming",      cadence: "monthly"  },
  { name: "Spotify",          domain: "spotify.com",         amounts: [9.99, 14.99],         category: "Music",          cadence: "monthly"  },
  { name: "Apple TV+",        domain: "tv.apple.com",        amounts: [9.99],                category: "Streaming",      cadence: "monthly"  },
  { name: "Disney+",          domain: "disneyplus.com",      amounts: [7.99, 13.99],         category: "Streaming",      cadence: "monthly"  },
  { name: "Hulu",             domain: "hulu.com",            amounts: [7.99, 17.99],         category: "Streaming",      cadence: "monthly"  },
  { name: "Max",              domain: "max.com",             amounts: [9.99, 15.99, 19.99],  category: "Streaming",      cadence: "monthly"  },
  { name: "Amazon Prime",     domain: "amazon.com",          amounts: [14.99],               category: "Shopping",       cadence: "monthly"  },
  { name: "YouTube Premium",  domain: "youtube.com",         amounts: [13.99, 22.99],        category: "Streaming",      cadence: "monthly"  },
  { name: "Peacock",          domain: "peacocktv.com",       amounts: [5.99, 11.99],         category: "Streaming",      cadence: "monthly"  },
  { name: "Paramount+",       domain: "paramountplus.com",   amounts: [5.99, 11.99],         category: "Streaming",      cadence: "monthly"  },
  { name: "iCloud+",          domain: "icloud.com",          amounts: [0.99, 2.99, 9.99],    category: "Storage",        cadence: "monthly"  },
  { name: "Google One",       domain: "one.google.com",      amounts: [1.99, 2.99, 9.99],    category: "Storage",        cadence: "monthly"  },
  { name: "Dropbox",          domain: "dropbox.com",         amounts: [9.99, 16.58],         category: "Productivity",   cadence: "monthly"  },
  { name: "Adobe Creative",   domain: "adobe.com",           amounts: [54.99, 29.99],        category: "Productivity",   cadence: "monthly"  },
  { name: "Microsoft 365",    domain: "microsoft.com",       amounts: [6.99, 9.99, 99.99],   category: "Productivity",   cadence: "monthly"  },
  { name: "Notion",           domain: "notion.so",           amounts: [8.00, 15.00],         category: "Productivity",   cadence: "monthly"  },
  { name: "Duolingo Plus",    domain: "duolingo.com",        amounts: [6.99, 83.99],         category: "Education",      cadence: "monthly"  },
  { name: "Calm",             domain: "calm.com",            amounts: [14.99, 69.99],        category: "Wellness",       cadence: "monthly"  },
  { name: "Headspace",        domain: "headspace.com",       amounts: [12.99, 69.99],        category: "Wellness",       cadence: "monthly"  },
  { name: "Peloton",          domain: "onepeloton.com",      amounts: [44.00],               category: "Fitness",        cadence: "monthly"  },
  { name: "ClassPass",        domain: "classpass.com",       amounts: [19.00, 49.00, 79.00], category: "Fitness",        cadence: "monthly"  },
  { name: "Noom",             domain: "noom.com",            amounts: [59.00, 199.00],       category: "Health",         cadence: "monthly"  },
  { name: "NordVPN",          domain: "nordvpn.com",         amounts: [3.99, 5.99],          category: "Security",       cadence: "monthly"  },
  { name: "1Password",        domain: "1password.com",       amounts: [2.99, 4.99],          category: "Security",       cadence: "monthly"  },
  { name: "Grammarly",        domain: "grammarly.com",       amounts: [12.00, 30.00],        category: "Productivity",   cadence: "monthly"  },
  { name: "ChatGPT Plus",     domain: "openai.com",          amounts: [20.00],               category: "AI",             cadence: "monthly"  },
  { name: "GitHub Copilot",   domain: "github.com",          amounts: [10.00, 19.00],        category: "Developer",      cadence: "monthly"  },
  { name: "Starz",            domain: "starz.com",           amounts: [8.99],                category: "Streaming",      cadence: "monthly"  },
  { name: "ESPN+",            domain: "espnplus.com",        amounts: [9.99],                category: "Sports",         cadence: "monthly"  },
  { name: "Audible",          domain: "audible.com",         amounts: [7.95, 14.95, 22.95],  category: "Books",          cadence: "monthly"  },
];

const BILL_POOL = [
  { name: "Electricity",  iconKey: "electricity", amounts: [85, 110, 145, 175, 210] },
  { name: "Internet",     iconKey: "wifi",        amounts: [49.99, 59.99, 79.99]    },
  { name: "Phone",        iconKey: "phone",       amounts: [45, 65, 85]             },
  { name: "Rent",         iconKey: "home",        amounts: [1200, 1500, 1800, 2200] },
  { name: "Car Insurance",iconKey: "car_insurance",amounts: [89, 112, 145]          },
  { name: "Gas",          iconKey: "gas",         amounts: [38, 55, 72]             },
  { name: "Water",        iconKey: "water",       amounts: [28, 42, 65]             },
  { name: "Gym",          iconKey: "fitness",     amounts: [24.99, 39.99, 54.99]    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isoDate(daysFromNow) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clampDay(n) {
  return Math.max(1, Math.min(28, Math.floor(n)));
}

// ─── Persona generator ───────────────────────────────────────────────────────

export function generatePersona() {
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const name = `${first} ${last}`;

  // 4–9 subscriptions, never duplicate merchant
  const subCount = 4 + Math.floor(Math.random() * 6);
  const chosenSubs = shuffle(SUBSCRIPTION_POOL).slice(0, subCount);

  const subs = chosenSubs.map((tpl, i) => ({
    id: `rec_sub_${i}_${Math.random().toString(36).slice(2, 8)}`,
    kind: "subscription",
    title: tpl.name,
    merchant: tpl.name,
    domain: tpl.domain,
    amount: pick(tpl.amounts),
    effectiveAmount: pick(tpl.amounts),
    currency: "USD",
    cadence: tpl.cadence,
    category: tpl.category,
    nextRenewal: isoDate(1 + Math.floor(Math.random() * 29)),
    nextDate: isoDate(1 + Math.floor(Math.random() * 29)),
    active: true,
    tags: [],
  }));

  // 2–4 bills
  const billCount = 2 + Math.floor(Math.random() * 3);
  const chosenBills = shuffle(BILL_POOL).slice(0, billCount);

  const bills = chosenBills.map((tpl, i) => ({
    id: `rec_bill_${i}_${Math.random().toString(36).slice(2, 8)}`,
    kind: "bill",
    title: tpl.name,
    name: tpl.name,
    merchant: tpl.name,
    domain: "",
    amount: pick(tpl.amounts),
    effectiveAmount: pick(tpl.amounts),
    currency: "USD",
    cadence: "monthly",
    dueDay: clampDay(1 + Math.floor(Math.random() * 27)),
    nextDate: isoDate(1 + Math.floor(Math.random() * 28)),
    iconKey: tpl.iconKey,
    category: "Bills",
    active: true,
    tags: [],
  }));

  const monthlyBurn = subs.reduce((acc, s) => acc + s.effectiveAmount, 0)
    + bills.filter(b => b.name !== "Rent").reduce((acc, b) => acc + b.effectiveAmount, 0);

  // Fake scan stats proportional to subscription count
  const emailsScanned = 800 + Math.floor(Math.random() * 1400);
  const receiptsFound = subCount * 3 + Math.floor(Math.random() * 20);

  return {
    name,
    firstName: first,
    subs,
    bills,
    recurring: [...subs, ...bills],
    monthlyBurn: parseFloat(monthlyBurn.toFixed(2)),
    emailsScanned,
    receiptsFound,
    generatedAt: Date.now(),
  };
}

// ─── Hooks for content production ────────────────────────────────────────────

export const RECORDING_HOOKS = [
  "found $143/month I forgot about",
  "I swear I never signed up for this",
  "this app just exposed me",
  "why am I still paying for this??",
  "this is actually embarrassing",
  "I thought I had like 2 subscriptions…",
  "this adds up FAST",
  "no wonder I'm broke",
  "I cancelled 5 things in 2 minutes",
  "this should be illegal",
];

// ─── Store ───────────────────────────────────────────────────────────────────

export const useRecordingStore = create((set, get) => ({
  active: false,
  persona: null,
  personaHistory: [],       // last 3 personas before current
  monthlyBurnOverride: null, // null = use persona's real total
  forcePro: false,
  _hydrated: false,

  hydrate: async () => {
    if (get()._hydrated) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        set({
          active: saved.active ?? false,
          persona: saved.persona ?? null,
          personaHistory: saved.personaHistory ?? [],
          monthlyBurnOverride: saved.monthlyBurnOverride ?? null,
          forcePro: saved.forcePro ?? false,
          _hydrated: true,
        });
        return;
      }
    } catch {}
    set({ _hydrated: true });
  },

  _persist: () => {
    const { active, persona, personaHistory, monthlyBurnOverride, forcePro } = get();
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
      active, persona, personaHistory, monthlyBurnOverride, forcePro,
    })).catch(() => {});
  },

  enable: () => {
    const persona = generatePersona();
    set({ active: true, persona, monthlyBurnOverride: null });
    get()._persist();
  },

  disable: () => {
    set({ active: false, persona: null, monthlyBurnOverride: null, forcePro: false });
    get()._persist();
  },

  regenerate: () => {
    const prev = get().persona;
    const history = prev
      ? [prev, ...get().personaHistory].slice(0, 3)
      : get().personaHistory;
    const persona = generatePersona();
    set({ persona, personaHistory: history, monthlyBurnOverride: null });
    get()._persist();
  },

  restorePersona: (persona) => {
    const prev = get().persona;
    const history = prev
      ? [prev, ...get().personaHistory.filter((p) => p.generatedAt !== persona.generatedAt)].slice(0, 3)
      : get().personaHistory;
    set({ persona, personaHistory: history, monthlyBurnOverride: null });
    get()._persist();
  },

  setMonthlyBurnOverride: (value) => {
    // value: number or null
    set({ monthlyBurnOverride: value == null ? null : Number(value) });
    get()._persist();
  },

  setForcePro: (value) => {
    set({ forcePro: !!value });
    get()._persist();
  },
}));

// ─── Derived helpers (called by screens, not hooks — safe outside React) ──────

/**
 * Convert a persona's subs into the same shape that emailImportStore.candidates uses.
 * Screens that read candidates call this instead of the real store when recording.
 */
export function personaToCandidates(persona) {
  if (!persona) return [];
  return persona.subs.map((s) => ({
    fingerprint: s.title,          // matches merchant — used as key
    merchant: s.title,
    amount: s.amount,
    currency: s.currency,
    nextDateGuess: s.nextRenewal,
    cadenceGuess: s.cadence,
    confidence: 0.92 + Math.random() * 0.07, // 0.92–0.99
    source: "email",
    domain: s.domain,
  }));
}

/**
 * Fake scan log entry for the Activity screen.
 */
export function personaToScanLog(persona) {
  if (!persona) return [];
  const ago = new Date(persona.generatedAt - 1000 * 60 * 7); // 7 min ago
  return [{
    at: ago.toISOString(),
    provider: "gmail",
    mode: "fast",
    scanned: persona.emailsScanned,
    found: persona.subs.length,
    daysBack: 365,
  }];
}

// ─── Convenience hook ─────────────────────────────────────────────────────────

export function useRecordingMode() {
  const active = useRecordingStore((s) => s.active);
  const persona = useRecordingStore((s) => s.persona);
  const enable = useRecordingStore((s) => s.enable);
  const disable = useRecordingStore((s) => s.disable);
  const regenerate = useRecordingStore((s) => s.regenerate);
  const hydrate = useRecordingStore((s) => s.hydrate);
  return { active, persona, enable, disable, regenerate, hydrate };
}