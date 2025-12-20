// lib/store.js
import { create } from 'zustand';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

const CARDS_KEY = 'sublytics:cards:v1';
const MAIL_KEY = 'sublytics:mail:v1';

async function safeGetJSON(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function safeSetJSON(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op
  }
}

export const useStore = create((set, get) => ({
  subs: [],
  user: null,
  currency: 'USD',

  // Local-only: cards + mail connection state (until you wire DB tables)
  cards: [],
  mail: {
    provider: 'google',
    connected: false,
    lastScanAt: null,
    suggestions: [],
  },

  setUser: (user) => set({ user }),
  setCurrency: (currency) => set({ currency }),

  // --- Subscriptions (Supabase) ---
  fetchSubs: async () => {
    const { data, error } = await supabase.from('subscriptions').select('*');
    if (!error) set({ subs: data || [] });
  },

  addSub: async (sub) => {
    const newSub = { id: uuid(), ...sub };
    const { error } = await supabase.from('subscriptions').insert([newSub]);
    if (!error) set({ subs: [...get().subs, newSub] });
    return { error };
  },

  updateSub: async (id, patch) => {
    const { subs } = get();
    const next = subs.map((s) => (String(s.id) === String(id) ? { ...s, ...patch } : s));

    const { error } = await supabase
      .from('subscriptions')
      .update(patch)
      .eq('id', id);

    if (!error) set({ subs: next });
    return { error };
  },

  deleteSub: async (id) => {
    const { error } = await supabase
      .from('subscriptions')
      .delete()
      .eq('id', id);

    if (!error) set({ subs: get().subs.filter((s) => String(s.id) !== String(id)) });
    return { error };
  },

  // --- Cards (local) ---
  loadCards: async () => {
    const cards = await safeGetJSON(CARDS_KEY, []);
    set({ cards: Array.isArray(cards) ? cards : [] });
  },

  addCard: async (card) => {
    const next = [...get().cards, { id: uuid(), ...card }];
    set({ cards: next });
    await safeSetJSON(CARDS_KEY, next);
  },

  updateCard: async (id, patch) => {
    const next = get().cards.map((c) => (String(c.id) === String(id) ? { ...c, ...patch } : c));
    set({ cards: next });
    await safeSetJSON(CARDS_KEY, next);
  },

  deleteCard: async (id) => {
    const next = get().cards.filter((c) => String(c.id) !== String(id));
    set({ cards: next });
    await safeSetJSON(CARDS_KEY, next);
  },

  // --- Mail (local placeholder) ---
  loadMail: async () => {
    const mail = await safeGetJSON(MAIL_KEY, null);
    if (mail) set({ mail: { ...get().mail, ...mail } });
  },

  setMail: async (patch) => {
    const next = { ...get().mail, ...patch };
    set({ mail: next });
    await safeSetJSON(MAIL_KEY, next);
  },
}));
