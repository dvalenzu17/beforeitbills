// lib/onboardingStore.js
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useStore } from "./store";
import { buildDemoRecurring } from "./demoData";

const KEY = "sublytics:onboarding:v2";

const defaultState = {
  demoMode: false,
  demoIds: [],
  dismissed: false,
  hasHydrated: false,
  steps: {
    addedFirst: false,
    remindersOn: false,
    reviewedUpcoming: false,
  },
};

async function safeGet() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function safeSet(state) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {}
}

async function addViaStore(item) {
  const s = useStore.getState();

  if (typeof s.addRecurring === "function") return await s.addRecurring(item);

  if (item?.kind === "bill") {
    if (typeof s.addBill === "function") {
      return await s.addBill({
        name: item?.title || item?.name || "Bill",
        merchant: item?.merchant || item?.title || item?.name || "Bill",
        amount: Number(item?.amount || 0),
        currency: (item?.currency || "USD").toUpperCase().slice(0, 3),
        dueDay: Number(item?.dueDay || 1),
        variable: !!item?.variable,
        autopay: !!item?.autopay,
        category: item?.category || "Bills",
        shared: !!item?.shared,
        sharedCount: item?.shared ? Number(item?.sharedCount || 1) : 1,
        tags: item?.tags || [],
      });
    }
  } else {
    if (typeof s.addSub === "function") {
      return await s.addSub({
        merchant: item?.merchant || item?.title || "Subscription",
        amount: Number(item?.amount || 0),
        currency: (item?.currency || "USD").toUpperCase().slice(0, 3),
        cadence: item?.cadence || "monthly",
        nextRenewal: item?.nextRenewal || item?.nextDate || null,
        category: item?.category ?? null,
        shared: !!item?.shared,
        sharedCount: item?.shared ? Number(item?.sharedCount || 1) : 1,
        tags: item?.tags || [],
      });
    }
  }

  const keys = Object.keys(s || {}).sort().slice(0, 40).join(", ");
  throw new Error(`Demo data failed: no add function found on store. Keys: ${keys}`);
}

export const useOnboardingStore = create((set, get) => ({
  ...defaultState,

  hydrate: async () => {
    const saved = await safeGet();
    if (saved) set({ ...defaultState, ...saved, hasHydrated: true });
    else set({ ...defaultState, hasHydrated: true });
  },
  dismissChecklist: async () => {
    const state = get();
    const next = { ...state, dismissed: true };
    set(next);
    await safeSet(next);
  },

  resetChecklist: async () => {
    const next = { ...defaultState };
    set(next);
    await safeSet(next);
  },

  markStep: async (key, done = true) => {
    const state = get();
    const next = { ...state, steps: { ...state.steps, [key]: !!done } };
    set(next);
    await safeSet(next);
  },

  // auto-complete based on real app state
  syncFromAppState: async ({ hasAnyRecurring, remindersEnabled } = {}) => {
    const state = get();
    const nextSteps = { ...state.steps };

    if (hasAnyRecurring) nextSteps.addedFirst = true;
    if (remindersEnabled) nextSteps.remindersOn = true;

    const next = { ...state, steps: nextSteps };
    set(next);
    await safeSet(next);
  },

  isChecklistDone: () => {
    const s = get().steps;
    return !!(s.addedFirst && s.remindersOn && s.reviewedUpcoming);
  },

  enableDemo: async () => {
    const state = get();
    if (state.demoMode) return { ok: true, added: 0 };

    const optimistic = { ...state, demoMode: true };
    set(optimistic);
    await safeSet(optimistic);

    try {
      const s = useStore.getState();
      const subs = Array.isArray(s.subs) ? s.subs : [];
      const bills = Array.isArray(s.bills) ? s.bills : [];

      const existingKeys = new Set(
        [
          ...subs.map((x) => String(x.merchant || "").toLowerCase()),
          ...bills.map((x) => String(x.name || x.merchant || "").toLowerCase()),
        ].filter(Boolean)
      );

      const demo = buildDemoRecurring();
      const created = [];
      let added = 0;

      for (const item of demo) {
        const key = String(item.merchant || item.title || item.name || "").toLowerCase();
        if (key && existingKeys.has(key)) continue;

        const res = await addViaStore(item);
        const id = res?.id || res?.item?.id || res?.local_id || res?.localId || null;
        if (id) created.push({ kind: item.kind, id });
        added += 1;
      }

      const next = {
        ...get(),
        demoMode: true,
        demoIds: created,
        steps: { ...get().steps, addedFirst: true },
      };
      set(next);
      await safeSet(next);

      return { ok: true, added };
    } catch (e) {
      const revert = { ...get(), demoMode: false, demoIds: [] };
      set(revert);
      await safeSet(revert);
      throw e;
    }
  },

  disableDemo: async () => {
    const s = useStore.getState();
    const del = s.deleteRecurring;

    const state = get();
    if (!state.demoMode) return { ok: true, removed: 0 };

    let removed = 0;

    if (typeof del === "function" && Array.isArray(state.demoIds)) {
      for (const x of state.demoIds) {
        try {
          await del(x.kind, x.id);
          removed += 1;
        } catch {}
      }
    }

    const next = { ...state, demoMode: false, demoIds: [] };
    set(next);
    await safeSet(next);

    return { ok: true, removed };
  },
}));
