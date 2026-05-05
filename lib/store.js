// lib/store.js
import { create } from 'zustand';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { toISODate, monthKey, clamp, computeBillNextDue } from './dateMath';
import { schedulePriceChangeNotification } from './notifications';
import { updateWidgetData } from './widgetBridge';
import { scheduleAll } from './notificationsEngine';

import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

const SUBS_KEY = 'sublytics:subs:v1';
const CARDS_KEY = 'sublytics:cards:v1';
const MAIL_KEY = 'sublytics:mail:v1';
const PROFILE_KEY = 'sublytics:profile:v1';
const NOTIF_KEY = 'sublytics:notifications:v1';
const BILLS_KEY = 'sublytics:bills:v1';
const RECAP_KEY = 'sublytics:recap:v1';
const SAVINGS_KEY = 'sublytics:savings:v1';

// Sync v1 keys
const SYNC_META_KEY = 'sublytics:syncMeta:v1';
const PENDING_DELETES_KEY = 'sublytics:subs:pendingDeletes:v1';
const SORT_ORDER_KEY = 'sublytics:sortOrder:v1';

// ✅ price-change dedupe
const PRICE_CHANGE_STATE_KEY = 'sublytics:priceChangeState:v1';

// Dev-only pro bypass (support both "17042025" and "@17042025")
const DEV_PRO_USERNAME = 'username1';
function isDevProUsername(username) {
  const u = String(username || '').trim();
  const naked = u.startsWith('@') ? u.slice(1) : u;
  return naked === DEV_PRO_USERNAME;
}


async function loadPriceChangeState() {
  try {
    const raw = await AsyncStorage.getItem(PRICE_CHANGE_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function savePriceChangeState(state) {
  try {
    await AsyncStorage.setItem(PRICE_CHANGE_STATE_KEY, JSON.stringify(state || {}));
  } catch {
    // no-op
  }
}

function moneyNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function nowISO() {
  return new Date().toISOString();
}

function asTime(x) {
  if (!x) return 0;
  const t = Date.parse(String(x));
  return Number.isFinite(t) ? t : 0;
}

/**
 * ✅ Shared model (minimal YC-grade):
 * - shared: boolean
 * - sharedCount: total people (>=1)
 * - sharedByMe: true => I’m primary payer; false => I owe someone
 * - counterpartyName: optional string (if sharedByMe === false)
 * - splitMethod: 'equal' | 'custom'
 * - myShareAmount: number|null (when splitMethod === 'custom')
 */
function normalizeSharedFields(item) {
  const shared = !!item?.shared;

  const sharedCountRaw = item?.sharedCount ?? item?.sharedPeople ?? item?.sharedWith ?? 1;
  const sharedCount = shared ? (Number(sharedCountRaw) || 1) : 1;

  const sharedByMe = item?.sharedByMe ?? item?.shared_by_me ?? true;

  const counterpartyName =
    (item?.counterpartyName ?? item?.counterparty_name ?? item?.payToName ?? item?.pay_to_name ?? '')
      .toString()
      .trim() || null;

  const myShareAmount = moneyNum(item?.myShareAmount ?? item?.my_share_amount);

  const splitMethodRaw = item?.splitMethod ?? item?.split_method;
  const splitMethod =
    !shared ? 'equal' :
    (splitMethodRaw === 'custom' || splitMethodRaw === 'equal')
      ? splitMethodRaw
      : (myShareAmount != null ? 'custom' : 'equal');

  return {
    shared,
    sharedCount,
    sharedByMe,
    counterpartyName,
    splitMethod,
    myShareAmount: shared && splitMethod === 'custom' ? myShareAmount : null,
  };
}

function shareDivisor(item) {
  if (!item?.shared) return 1;
  const n = Number(item?.sharedCount ?? item?.sharedPeople ?? item?.sharedWith ?? 1);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function effectiveShareAmount(item) {
  const amt = Number(item?.amount || 0) || 0;
  const { shared, splitMethod, myShareAmount } = normalizeSharedFields(item);
  if (!shared) return amt;
  if (splitMethod === 'custom' && myShareAmount != null) return myShareAmount;
  return amt / shareDivisor(item);
}

function payNote(item) {
  const { shared, sharedByMe, counterpartyName } = normalizeSharedFields(item);
  if (!shared) return '';
  if (sharedByMe) return 'you pay';
  return counterpartyName ? `pay ${counterpartyName}` : 'pay someone';
}

function monthlyFactor(cadence) {
  return cadence === 'yearly' ? 1 / 12 :
    cadence === 'quarterly' ? 1 / 3 :
    cadence === 'weekly' ? 4.345 : 1;
}

function displayMerchantLabel(raw) {
  const s = String(raw || "").trim();
  const m = s.toLowerCase();

  const generic = new Set([
    "",
    "subscription",
    "subscriptions",
    "payment",
    "invoice",
    "receipt",
    "billing",
    "plan",
    "apple",
    "unknown",
    "unknown merchant",
  ]);

  if (generic.has(m)) return "Unknown subscription";
  return s;
}

function randomUsername() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `username${n}`;
}

function recommendationFromRecap(answer, sub) {
  if (!answer) return null;
  const usage = clamp(answer.usageDays ?? 0, 0, 31);
  const missIt = clamp(answer.missIt ?? 3, 1, 5);
  const satisfaction = clamp(answer.satisfaction ?? 3, 1, 5);
  const pricePain = clamp(answer.pricePain ?? 3, 1, 5);
  const hasAlt = !!answer.hasAlt;

  const usageScore = usage / 31;
  const loveScore = (missIt + satisfaction) / 10;
  const painScore = 1 - (pricePain - 1) / 4;
  const altPenalty = hasAlt ? 0.15 : 0;

  const valueScore = clamp(
    (usageScore * 0.45) + (loveScore * 0.4) + (painScore * 0.15) - altPenalty,
    0,
    1
  );

  let decision = 'Keep';
  if (valueScore < 0.35) decision = 'Cancel';
  else if (valueScore < 0.55) decision = 'Downgrade/Pause';

  const estMonthly = effectiveShareAmount(sub) * monthlyFactor(sub?.cadence);

  const why = [
    usage <= 1 ? 'barely used' : usage >= 12 ? 'used often' : 'used sometimes',
    pricePain >= 4 ? 'feels pricey' : pricePain <= 2 ? 'price feels fine' : 'price is meh',
    hasAlt ? 'you have alternatives' : null,
  ].filter(Boolean).join(' · ');

  return {
    decision,
    valueScore,
    why,
    estMonthly: Number.isFinite(estMonthly) ? estMonthly : 0
  };
}

/**
 * DB mapping for YOUR subscriptions table:
 * - identity is `id uuid` (we use the same UUID locally + remotely)
 * - table has dupes: next_renewal(date) AND nextRenewal(text)
 * - table has dupes: shared_by_me(bool) AND sharedByMe(bool)
 *
 * NOTE: We intentionally do NOT write new shared fields (splitMethod/myShare/counterpartyName/active)
 * to Supabase unless you add columns. This keeps sync stable.
 */
function mapLocalToDb(userId, sub) {
  const nextDate = sub?.nextRenewal ? toISODate(sub.nextRenewal) : null;
  const createdAt = sub?.createdAt ?? null;
  const updatedAt = sub?.updatedAt ?? null;

  return {
    id:               String(sub.id),
    user_id:          userId,
    merchant:         sub.merchant,
    // Real schema columns: renewal_amount, billing_interval, renewal_date
    renewal_amount:   sub.amount,
    currency:         (sub.currency || 'USD').toUpperCase().slice(0, 3),
    billing_interval: sub.cadence || 'monthly',
    renewal_date:     nextDate,
    confidence:       sub.confidence ?? null,
    is_active:        sub.active !== false,
    is_suggested:     sub.isSuggested ?? false,
    source:           sub.source ?? 'manual',
    created_at:       createdAt,
    updated_at:       updatedAt,
  };
}

function mapDbToLocal(row) {
  // Real schema: renewal_date, renewal_amount, billing_interval, is_active, is_suggested
  const nextRenewal =
    row.renewal_date ??
    row.next_renewal ??
    row.nextRenewal ??
    null;

  return {
    id:           row.id,
    merchant:     row.merchant ?? '',
    amount:       Number(row.renewal_amount ?? row.amount ?? 0),
    currency:     row.currency ?? 'USD',
    cadence:      row.billing_interval ?? row.cadence ?? 'monthly',
    nextRenewal,
    confidence:   row.confidence ?? null,
    active:       row.is_active !== false,
    isSuggested:  !!row.is_suggested,
    source:       row.source ?? 'manual',

    // local-only fields — defaults until user edits
    category:         null,
    shared:           false,
    sharedByMe:       true,
    sharedCount:      1,
    splitMethod:      'equal',
    myShareAmount:    null,
    counterpartyName: null,
    is_trial:         false,
    trial_end:        null,

    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

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

async function getUserSafe() {
  try {
    if (!supabase?.auth?.getUser) return null;
    const { data } = await supabase.auth.getUser();
    return data?.user ?? null;
  } catch {
    return null;
  }
}

/**
 * Merge local + remote subscription lists using Last-Write-Wins on `updatedAt`.
 *
 * Also detects conflicts: cases where the remote version wins but the local
 * version was edited after the last successful sync (meaning the user made
 * changes on this device that are about to be silently overwritten).
 *
 * Returns { merged, conflicts } where `conflicts` is an array of
 * { id, local, remote } objects for the caller to surface to the user.
 */
function mergeSubsLWW(localList, remoteList, lastSyncedAt) {
  const localById = new Map();
  const remoteById = new Map();

  for (const s of Array.isArray(localList) ? localList : []) {
    if (!s?.id) continue;
    localById.set(String(s.id), s);
  }
  for (const r of Array.isArray(remoteList) ? remoteList : []) {
    const id = String(r?.id ?? '');
    if (!id) continue;
    remoteById.set(id, r);
  }

  const allIds = new Set([...localById.keys(), ...remoteById.keys()]);
  const out = [];
  const conflicts = [];
  const syncT = asTime(lastSyncedAt);

  for (const id of allIds) {
    const l = localById.get(id);
    const r = remoteById.get(id);

    if (l && !r) { out.push(l); continue; }
    if (!l && r) { out.push(r); continue; }

    const lt = asTime(l?.updatedAt || l?.createdAt);
    const rt = asTime(r?.updatedAt || r?.createdAt);

    if (rt > lt) {
      // Remote wins — detect whether this silently overwrites a local edit
      const localEditedAfterSync = syncT > 0 && lt > syncT;
      const hasMeaningfulDiff =
        l?.amount !== r?.amount ||
        (l?.merchant || '') !== (r?.merchant || '') ||
        (l?.cadence || '') !== (r?.cadence || '');

      if (localEditedAfterSync && hasMeaningfulDiff) {
        conflicts.push({ id, local: l, remote: r });
      }
      out.push(r);
    } else {
      out.push(l);
    }
  }

  const sorted = out.sort((a, b) => {
    const at = a?.nextRenewal ? asTime(`${a.nextRenewal}T00:00:00Z`) : 0;
    const bt = b?.nextRenewal ? asTime(`${b.nextRenewal}T00:00:00Z`) : 0;
    return at - bt;
  });

  return { merged: sorted, conflicts };
}

export const useStore = create((set, get) => ({
  subs: [],
  bills: [],
  user: null,
  currency: 'USD',
  conflicts: [], // pending cross-device merge conflicts awaiting user resolution
  sortOrder: [], // user-defined drag order: array of "kind-id" strings

  // Entitlements
  pro: false,

  // Sync v1 meta
  syncMeta: {
    lastSyncedAt: null,
    lastSyncOk: null,
    lastSyncError: null,
    lastSyncSource: null,
  },

  profile: {
    username: null,
    name: null,
    avatarUri: null,
  },

  notificationSettings: {
    renewalsEnabled: true,
    daysBefore: [7, 3, 1],
    timeOfDay: '09:00',
  },

  savings: {
    totalSaved: 0,   // sum of all monthly-equivalent amounts cancelled
    entries: [],     // [{ id, name, amount, currency, cadence, monthlyAmount, savedAt }]
  },

  cards: [],
  mail: {
    provider: 'google',
    connected: false,
    lastScanAt: null,
    suggestions: [],
  },

  recap: {
    currentMonth: monthKey(),
    months: {},
  },

  streak: { current: 0, best: 0, lastDate: null },

  setUser: (user) => set({ user }),
  setCurrency: (currency) => set({ currency }),

  // Call on sign-out to prevent previous user's data being visible on shared devices
  resetUserData: async () => {
    set({
      user: null,
      subs: [],
      bills: [],
      cards: [],
      pro: false,
      profile: { username: null, name: null, avatarUri: null },
      syncMeta: { lastSyncedAt: null, lastSyncOk: null, lastSyncError: null, lastSyncSource: null },
      mail: { provider: 'google', connected: false, lastScanAt: null, suggestions: [] },
    });
    // Clear persisted user data from AsyncStorage
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      // Keep profile key — restored from user_metadata on next login
      // Wiping it causes randomUsername() to fire on every sign-out/in cycle
      await AsyncStorage.multiRemove([
        'sublytics:subs:v1',
        'sublytics:bills:v1',
        'sublytics:cards:v1',
        'sublytics:mail:v1',
        'sublytics:syncMeta:v1',
        'sublytics:subs:pendingDeletes:v1',
        'sublytics:priceChangeState:v1',
      ]);
    } catch {}
  },

  setPro: async (value) => {
    const v = !!value;
    set({ pro: v });
  },

  // --- Sync meta ---
  loadSyncMeta: async () => {
    const meta = await safeGetJSON(SYNC_META_KEY, null);
    if (meta && typeof meta === 'object') {
      set({ syncMeta: { ...get().syncMeta, ...meta } });
    }
  },

  _setSyncMeta: async (patch) => {
    const next = { ...get().syncMeta, ...patch };
    set({ syncMeta: next });
    await safeSetJSON(SYNC_META_KEY, next);
  },

  _loadPendingDeletes: async () => {
    const list = await safeGetJSON(PENDING_DELETES_KEY, []);
    return Array.isArray(list) ? list.map(String) : [];
  },

  _savePendingDeletes: async (list) => {
    const uniq = Array.from(new Set((Array.isArray(list) ? list : []).map(String)));
    await safeSetJSON(PENDING_DELETES_KEY, uniq);
    return uniq;
  },

  // --- Profile ---
  loadProfile: async () => {
    // Priority: user_metadata (Supabase, cross-device) > AsyncStorage (local cache) > random
    const user = get().user;
    const meta = user?.user_metadata || {};

    const stored = await safeGetJSON(PROFILE_KEY, null);

    // avatarUrl (https://) is the cross-device Storage URL
    // avatarUri (file:///) is a legacy local path — ignore if it's a local path
    const storedAvatar = meta?.avatarUrl || meta?.avatarUri || stored?.avatarUri || null;
    const isLocalPath = storedAvatar && (
      storedAvatar.startsWith('file://') ||
      storedAvatar.startsWith('/var/') ||
      storedAvatar.startsWith('/data/')
    );

    const next = {
      username: meta?.username || stored?.username || randomUsername(),
      name: meta?.name || stored?.name || null,
      avatarUri: isLocalPath ? null : storedAvatar,
    };
    const pro = isDevProUsername(next.username);
    set({ profile: next, pro });
    await safeSetJSON(PROFILE_KEY, next);
  },

  updateProfile: async (patch) => {
    const next = { ...get().profile, ...patch };
    const pro = isDevProUsername(next.username);
    set({ profile: next, pro });
    await safeSetJSON(PROFILE_KEY, next);

    // Sync to Supabase user_metadata so it survives reinstalls and device switches
    const meta = {};
    if (typeof patch?.name === "string") meta.name = patch.name;
    if (typeof patch?.username === "string") meta.username = patch.username;
    if (typeof patch?.avatarUri !== "undefined") {
      const val = patch.avatarUri ?? null;
      // Only persist to user_metadata if it's a remote URL — local paths
      // (file:///, /var/...) are device-specific and useless after reinstall
      if (!val || val.startsWith('http')) {
        meta.avatarUrl = val;
      }
    }

    if (Object.keys(meta).length) {
      try {
        if (supabase?.auth?.updateUser) {
          await supabase.auth.updateUser({ data: meta });
          const refreshed = await supabase.auth.getUser();
          set({ user: refreshed?.data?.user ?? get().user });
        }
      } catch {
        // no-op (local-first)
      }
    }
  },

  loadNotificationSettings: async () => {
    const stored = await safeGetJSON(NOTIF_KEY, null);
    if (stored) set({ notificationSettings: { ...get().notificationSettings, ...stored } });
  },

  updateNotificationSettings: async (patch) => {
    const next = { ...get().notificationSettings, ...patch };
    set({ notificationSettings: next });
    await safeSetJSON(NOTIF_KEY, next);
  },

  // --- Sort order (drag to reorder) ---
  loadSortOrder: async () => {
    const stored = await safeGetJSON(SORT_ORDER_KEY, []);
    if (Array.isArray(stored)) set({ sortOrder: stored });
  },

  setSortOrder: async (order) => {
    if (!Array.isArray(order)) return;
    set({ sortOrder: order });
    try {
      await AsyncStorage.setItem(SORT_ORDER_KEY, JSON.stringify(order));
    } catch (e) {
      if (__DEV__) console.warn('[store] setSortOrder persist failed:', e?.message);
    }
  },

  // --- Savings tracker ---
  loadSavings: async () => {
    const stored = await safeGetJSON(SAVINGS_KEY, null);
    if (stored) set({ savings: stored });
  },

  // --- Streak tracker ---
  loadStreak: async () => {
    try {
      const { tickStreak } = await import('./streak');
      const s = await tickStreak();
      set({ streak: s });
    } catch {}
  },

  // --- Conflict resolution ---

  /**
   * Resolve a sync conflict by choosing which version wins.
   * choice: 'local' — restore the local (this device) version and push to cloud
   *         'remote' — accept the remote version (already applied in merged list)
   */
  resolveConflict: async (id, choice) => {
    const conflict = get().conflicts.find((c) => String(c.id) === String(id));
    if (!conflict) return;

    if (choice === 'local') {
      // Restore local version into subs and push back to cloud so it wins
      const winner = { ...conflict.local, updatedAt: nowISO() };
      const next = get().subs.map((s) => String(s.id) === String(id) ? winner : s);
      set({ subs: next });
      await safeSetJSON(SUBS_KEY, next);

      const user = await getUserSafe();
      if (user) {
        try {
          await supabase
            .from('subscriptions')
            .upsert([mapLocalToDb(user.id, winner)], { onConflict: 'id' });
        } catch (e) {
          if (__DEV__) console.warn('[store] conflict re-upsert failed:', e?.message);
        }
      }
    }
    // For 'remote': the merged list already has the remote version — nothing more to do

    set({ conflicts: get().conflicts.filter((c) => String(c.id) !== String(id)) });
  },

  /** Skip a conflict for this session — it will reappear on the next sync if unresolved. */
  dismissConflict: (id) => {
    set({ conflicts: get().conflicts.filter((c) => String(c.id) !== String(id)) });
  },

  recordSaving: async ({ id, name, amount, currency, cadence }) => {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return null;

    // Normalise to monthly equivalent
    const monthly =
      cadence === 'yearly'    ? n / 12 :
      cadence === 'quarterly' ? n / 3  :
      cadence === 'weekly'    ? (n * 52) / 12 :
      n; // monthly or unknown → treat as monthly

    const entry = {
      id: String(id || ''),
      name: String(name || ''),
      amount: n,
      currency: String(currency || 'USD').toUpperCase(),
      cadence: cadence || 'monthly',
      monthlyAmount: Math.round(monthly * 100) / 100,
      savedAt: new Date().toISOString(),
    };

    const prev = get().savings;
    const next = {
      totalSaved: Math.round((prev.totalSaved + entry.monthlyAmount) * 100) / 100,
      entries: [entry, ...prev.entries],
    };
    set({ savings: next });
    await safeSetJSON(SAVINGS_KEY, next);
    return entry;
  },

  // --- Bills (local-first) ---
  loadBills: async () => {
    const bills = await safeGetJSON(BILLS_KEY, []);
    const now = new Date();

    const normalized = Array.isArray(bills) ? bills.map((b) => {
      const sharedFields = normalizeSharedFields(b);

      const base = {
        id: b.id || uuid(),
        name: b.name || b.merchant || 'Bill',
        merchant: b.merchant || b.name || 'Bill',
        amount: Number(b.amount || 0),
        currency: (b.currency || 'USD').toUpperCase().slice(0, 3),
        dueDay: clamp(b.dueDay ?? 1, 1, 31),
        category: b.category ?? 'Bills',
        variable: !!b.variable,
        autopay: !!b.autopay,
        nextDue: b.nextDue || computeBillNextDue(b, now),
        notes: b.notes || '',

        // ✅ lifecycle
        active: b.active !== false,

        // ✅ shared (new)
        ...sharedFields,
      };

      // keep due day in sync with nextDue for display/compute
      if (base?.nextDue) {
        const d = new Date(`${String(base.nextDue).slice(0, 10)}T00:00:00`);
        if (!Number.isNaN(d.getTime())) base.dueDay = clamp(d.getDate(), 1, 31);
      }

      return base;
    }) : [];

    set({ bills: normalized });
    await safeSetJSON(BILLS_KEY, normalized);
  },

  addBill: async (bill) => {
    const now = new Date();
    const sharedFields = normalizeSharedFields(bill);

    const b = {
      id: uuid(),
      name: bill?.name || bill?.merchant || 'Bill',
      merchant: bill?.merchant || bill?.name || 'Bill',
      amount: Number(bill?.amount || 0),
      currency: (bill?.currency || 'USD').toUpperCase().slice(0, 3),
      dueDay: clamp(bill?.dueDay ?? 1, 1, 31),
      category: bill?.category ?? 'Bills',
      variable: !!bill?.variable,
      autopay: !!bill?.autopay,
      nextDue: bill?.nextDue || computeBillNextDue(bill, now),
      notes: bill?.notes || '',
      iconKey: bill?.iconKey ?? 'bill',

      active: bill?.active !== false,

      ...sharedFields,
    };

    if (b?.nextDue) {
      const d = new Date(`${String(b.nextDue).slice(0, 10)}T00:00:00`);
      if (!Number.isNaN(d.getTime())) b.dueDay = clamp(d.getDate(), 1, 31);
    }

    const next = [...get().bills, b];
    set({ bills: next });
    await safeSetJSON(BILLS_KEY, next);
    return b;
  },

  updateBill: async (id, patch) => {
    const now = new Date();

    const prev = (get().bills || []).find((b) => String(b.id) === String(id)) || null;

    const next = get().bills.map((b) => {
      if (String(b.id) !== String(id)) return b;

      const merged = { ...b, ...patch };

      // ✅ lifecycle
      merged.active = merged.active !== false;

      // ✅ shared model normalized
      const sharedFields = normalizeSharedFields(merged);
      merged.shared = sharedFields.shared;
      merged.sharedCount = sharedFields.sharedCount;
      merged.sharedByMe = sharedFields.sharedByMe;
      merged.counterpartyName = sharedFields.counterpartyName;
      merged.splitMethod = sharedFields.splitMethod;
      merged.myShareAmount = sharedFields.myShareAmount;

      // ✅ date normalization
      if (patch?.nextDue != null) {
        merged.nextDue = patch.nextDue;
      } else if (patch?.dueDay != null) {
        merged.dueDay = clamp(merged.dueDay ?? 1, 1, 31);
        merged.nextDue = computeBillNextDue(merged, now);
      } else if (!merged.nextDue) {
        merged.nextDue = computeBillNextDue(merged, now);
      }

      // keep dueDay aligned if nextDue exists
      if (merged?.nextDue) {
        const d = new Date(`${String(merged.nextDue).slice(0, 10)}T00:00:00`);
        if (!Number.isNaN(d.getTime())) merged.dueDay = clamp(d.getDate(), 1, 31);
      }

      return merged;
    });

    set({ bills: next });
    await safeSetJSON(BILLS_KEY, next);

    // When deactivating a bill, record saving (best-effort)
    let savedEntry = null;
    if (patch.active === false && prev?.amount) {
      savedEntry = await get().recordSaving({
        id: prev.id,
        name: prev.name || prev.merchant || '',
        amount: prev.amount,
        currency: prev.currency || 'USD',
        cadence: 'monthly',
      }).catch(() => null);
    }

    return { savedEntry };
  },

  deleteBill: async (id) => {
    const next = get().bills.filter((b) => String(b.id) !== String(id));
    set({ bills: next });
    await safeSetJSON(BILLS_KEY, next);
  },

  // ✅ used by add-recurring.js (single entrypoint)
  addRecurring: async (payload) => {
    const kind = payload?.kind === 'bill' ? 'bill' : 'subscription';

    if (kind === 'bill') {
      return get().addBill({
        active: payload?.active ?? true,
        name: payload?.name || payload?.title || payload?.merchant,
        merchant: payload?.merchant || payload?.name || payload?.title,
        amount: payload?.amount,
        currency: payload?.currency,
        dueDay: payload?.dueDay,
        nextDue: payload?.nextDue,
        variable: payload?.variable,
        autopay: payload?.autopay,
        notes: payload?.notes || '',

        shared: payload?.shared,
        sharedCount: payload?.sharedCount,
        sharedByMe: payload?.sharedByMe,
        counterpartyName: payload?.counterpartyName,
        splitMethod: payload?.splitMethod,
        myShareAmount: payload?.myShareAmount,
      });
    }

    return get().addSub({
      active: payload?.active ?? true,
      merchant: payload?.merchant || payload?.title,
      amount: payload?.amount,
      currency: payload?.currency,
      cadence: payload?.cadence,
      nextRenewal: payload?.nextRenewal,
      category: payload?.category,

      shared: payload?.shared,
      sharedCount: payload?.sharedCount,
      sharedByMe: payload?.sharedByMe,
      counterpartyName: payload?.counterpartyName,
      splitMethod: payload?.splitMethod,
      myShareAmount: payload?.myShareAmount,

      is_trial: payload?.is_trial ?? payload?.trial ?? false,
      trial_end: payload?.trial_end ?? payload?.trialEnd ?? null,
    });
  },

  // --- Monthly recap (unchanged logic) ---
  loadRecap: async () => {
    const stored = await safeGetJSON(RECAP_KEY, { currentMonth: monthKey(), months: {} });
    const mk = monthKey();
    const months = stored?.months && typeof stored.months === 'object' ? stored.months : {};
    if (!months[mk]) months[mk] = { completedAt: null, answers: {} };
    const next = { currentMonth: mk, months };
    set({ recap: next });
    await safeSetJSON(RECAP_KEY, next);
  },

  saveRecapAnswer: async (subId, patch) => {
    const mk = monthKey();
    const recap = get().recap || { currentMonth: mk, months: {} };
    const months = { ...(recap.months || {}) };
    const month = months[mk] || { completedAt: null, answers: {} };
    const answers = { ...(month.answers || {}) };
    answers[String(subId)] = { ...(answers[String(subId)] || {}), ...patch, updatedAt: new Date().toISOString() };
    months[mk] = { ...month, answers };
    const next = { currentMonth: mk, months };
    set({ recap: next });
    await safeSetJSON(RECAP_KEY, next);
  },

  completeRecap: async () => {
    const mk = monthKey();
    const recap = get().recap;
    const months = { ...(recap?.months || {}) };
    const month = months[mk] || { completedAt: null, answers: {} };
    months[mk] = { ...month, completedAt: new Date().toISOString() };
    const next = { currentMonth: mk, months };
    set({ recap: next });
    await safeSetJSON(RECAP_KEY, next);
  },

  getRecapRecommendations: () => {
    const mk = monthKey();
    const recap = get().recap;
    const answers = recap?.months?.[mk]?.answers || {};
    const out = [];
    for (const s of get().subs) {
      const ans = answers[String(s.id)];
      const rec = recommendationFromRecap(ans, s);
      if (!rec) continue;
      out.push({ sub: s, ...rec });
    }
    return out.sort((a, b) => a.valueScore - b.valueScore);
  },

  getActionFeed: () => {
    const mk = monthKey();
    const recap = get().recap;
    const completed = !!recap?.months?.[mk]?.completedAt;
    const actions = [];

    if (!completed) {
      actions.push({
        kind: 'recap',
        title: 'Monthly recap is due',
        detail: '2 minutes. Big savings energy.',
        href: '/(tabs)/insights?recap=1',
        priority: 0,
      });
    }

    const recs = get().getRecapRecommendations?.() || [];
    for (const r of recs) {
      if (r.decision === 'Keep') continue;
      actions.push({
        kind: 'recommendation',
        title: `${r.decision}: ${r.sub.merchant}`,
        detail: `${r.why} · score ${(r.valueScore * 100).toFixed(0)}%`,
        href: `/recurring/subscription/${r.sub.id}`,
        priority: r.decision === 'Cancel' ? 1 : 2,
      });
    }

    const now = new Date();
    const upcoming = [];

    for (const s of get().subs) {
      if (!s.nextRenewal) continue;
      const d = new Date(`${s.nextRenewal}T00:00:00`);
      const days = Math.round((d - now) / (1000 * 60 * 60 * 24));
      if (Number.isFinite(days) && days >= 0 && days <= 7) {
        const amt = effectiveShareAmount(s);
        const note = payNote(s);
        upcoming.push({
          kind: 'renewal',
          title: `Renews in ${days}d: ${s.merchant}`,
          detail: `${s.nextRenewal} · ${(s.currency || 'USD')} ${amt.toFixed(2)}${note ? ` · ${note}` : ''}`,
          href: `/recurring/subscription/${s.id}`,
          priority: 3
        });
      }
    }

    for (const b of get().bills) {
      const due = b.nextDue || computeBillNextDue(b, now);
      const d = new Date(`${due}T00:00:00`);
      const days = Math.round((d - now) / (1000 * 60 * 60 * 24));
      if (Number.isFinite(days) && days >= 0 && days <= 7) {
        const amt = effectiveShareAmount(b);
        const note = payNote(b);
        upcoming.push({
          kind: 'bill',
          title: `Bill due in ${days}d: ${b.name}`,
          detail: `${due} · ${(b.currency || 'USD')} ${amt.toFixed(2)}${note ? ` · ${note}` : ''}`,
          href: `/recurring/bill/${b.id}`,
          priority: 3
        });
      }
    }

    actions.push(...upcoming);
    return actions.sort((a, b) => a.priority - b.priority).slice(0, 8);
  },

  // --- Recurring list ---
  getRecurring: () => {
    const subs = Array.isArray(get().subs) ? get().subs : [];
    const bills = Array.isArray(get().bills) ? get().bills : [];

    const safeNum = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const safeStr = (v) => String(v ?? "").trim();
    const safeCurrency = (v) => (safeStr(v).toUpperCase() || "USD").slice(0, 3);

    const cleanMerchant = (raw) => displayMerchantLabel(raw);

    const subItems = subs.map((x) => {
      const rawMerchant = x?.merchant ?? x?.merchant_name ?? x?.merchantName ?? x?.name ?? x?.title ?? x?.vendor ?? "";
      const merchant = cleanMerchant(rawMerchant);
      const amount = safeNum(x?.amount ?? x?.price ?? x?.cost ?? x?.renewal_price ?? x?.renewalPrice ?? 0);

      const nextDate =
        x?.nextRenewal ?? x?.next_renewal ?? x?.next_renewal_at ?? x?.nextDate ?? x?.renewalDate ?? x?.renewal_date ?? null;

      const cadence = x?.cadence ?? x?.interval ?? x?.billingInterval ?? "monthly";
      const currency = safeCurrency(x?.currency);

      const sharedFields = normalizeSharedFields(x);
      const eff = effectiveShareAmount(x);

      return {
        kind: "subscription",
        id: x?.id,
        title: merchant,
        amount,
        effectiveAmount: eff,
        currency,
        cadence,
        nextDate,
        shared: sharedFields.shared,
        sharedCount: sharedFields.sharedCount,
        sharedByMe: sharedFields.sharedByMe,
        counterpartyName: sharedFields.counterpartyName,
        splitMethod: sharedFields.splitMethod,
        myShareAmount: sharedFields.myShareAmount,
        payNote: payNote(x),
        active: x?.active !== false,
        needsConfirmMerchant: merchant === "Unknown subscription",
        raw: x,
      };
    });

    const billItems = bills.map((x) => {
      const name = safeStr(x?.name ?? x?.merchant ?? x?.title ?? "Bill");
      const amount = safeNum(x?.amount ?? x?.price ?? 0);

      const nextDate = x?.nextDue ?? x?.next_due ?? x?.dueDate ?? x?.due_date ?? null;
      const currency = safeCurrency(x?.currency);

      const sharedFields = normalizeSharedFields(x);
      const eff = effectiveShareAmount(x);

      return {
        kind: "bill",
        id: x?.id,
        title: name,
        amount,
        effectiveAmount: eff,
        currency,
        cadence: "monthly",
        nextDate,
        shared: sharedFields.shared,
        sharedCount: sharedFields.sharedCount,
        sharedByMe: sharedFields.sharedByMe,
        counterpartyName: sharedFields.counterpartyName,
        splitMethod: sharedFields.splitMethod,
        myShareAmount: sharedFields.myShareAmount,
        payNote: payNote(x),
        active: x?.active !== false,
        needsConfirmMerchant: false,
        iconKey: x?.iconKey ?? 'bill',
        raw: x,
      };
    });

    return [...subItems, ...billItems]
      .filter((x) => !!x.nextDate)
      .sort(
        (a, b) =>
          new Date(`${a.nextDate}T00:00:00`).getTime() -
          new Date(`${b.nextDate}T00:00:00`).getTime()
      );
  },

  // --- Subscriptions (local-first + Supabase sync) ---
  loadSubsLocal: async () => {
    const subs = await safeGetJSON(SUBS_KEY, []);
    const list = Array.isArray(subs) ? subs : [];
    // ensure new defaults exist
    const hydrated = list.map((s) => {
      const sharedFields = normalizeSharedFields(s);
      return {
        ...s,
        active: s?.active !== false,
        ...sharedFields,
      };
    });
    set({ subs: hydrated });
    await safeSetJSON(SUBS_KEY, hydrated);
    updateWidgetData(hydrated, get().currency).catch(() => {});
  },

  syncNow: async ({ source = 'manual' } = {}) => {
    const user = get().user ?? (await getUserSafe());
    if (!user) {
      await get()._setSyncMeta({
        lastSyncOk: false,
        lastSyncError: 'Sign in to sync across devices.',
        lastSyncSource: source,
      });
      return { ok: false, needsSignIn: true };
    }

    const localRaw = await safeGetJSON(SUBS_KEY, []);
    const localList = Array.isArray(localRaw) ? localRaw : [];

    let pendingDeletes = await get()._loadPendingDeletes();

    // 1) Apply pending deletes to cloud first
    if (pendingDeletes.length) {
      try {
        const del = await supabase
          .from('subscriptions')
          .delete()
          .eq('user_id', user.id)
          .in('id', pendingDeletes);

        if (!del?.error) {
          pendingDeletes = await get()._savePendingDeletes([]);
        }
      } catch {
        // keep them
      }
    }

    // 2) Ensure timestamps exist for LWW
    const stampedLocal = localList.map((s) => {
      const createdAt = s?.createdAt ?? nowISO();
      const updatedAt = s?.updatedAt ?? createdAt;
      return { ...s, createdAt, updatedAt };
    });

    // 3) Upsert local → cloud by PK id
    const rows = stampedLocal.map((s) => mapLocalToDb(user.id, s));

    try {
      const up = await supabase
        .from('subscriptions')
        .upsert(rows, { onConflict: 'id' });

      if (up?.error) throw up.error;
    } catch (e) {
      await get()._setSyncMeta({
        lastSyncedAt: nowISO(),
        lastSyncOk: false,
        lastSyncError: e?.message || String(e),
        lastSyncSource: source,
      });

      set({ subs: stampedLocal });
      await safeSetJSON(SUBS_KEY, stampedLocal);
      return { ok: false, error: e?.message || String(e) };
    }

    // 4) Fetch cloud and merge LWW
    let cloudRows = [];
    try {
      const res = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id);

      if (res?.error) throw res.error;
      cloudRows = Array.isArray(res?.data) ? res.data : [];
    } catch (e) {
      await get()._setSyncMeta({
        lastSyncedAt: nowISO(),
        lastSyncOk: false,
        lastSyncError: e?.message || String(e),
        lastSyncSource: source,
      });

      set({ subs: stampedLocal });
      await safeSetJSON(SUBS_KEY, stampedLocal);
      return { ok: false, error: e?.message || String(e) };
    }

    const remoteMapped = cloudRows.map(mapDbToLocal);
    const lastSyncedAt = get().syncMeta.lastSyncedAt;
    const { merged, conflicts: newConflicts } = mergeSubsLWW(stampedLocal, remoteMapped, lastSyncedAt);

    // Surface new conflicts, deduplicating against any already pending
    if (newConflicts.length > 0) {
      const existingIds = new Set(get().conflicts.map((c) => c.id));
      const fresh = newConflicts.filter((c) => !existingIds.has(c.id));
      if (fresh.length > 0) {
        set({ conflicts: [...get().conflicts, ...fresh] });
      }
    }

    // hydrate new fields after merge
    const hydrated = merged.map((s) => {
      const sharedFields = normalizeSharedFields(s);
      return {
        ...s,
        active: s?.active !== false,
        ...sharedFields,
      };
    });

    set({ subs: hydrated });
    await safeSetJSON(SUBS_KEY, hydrated);

    await get()._setSyncMeta({
      lastSyncedAt: nowISO(),
      lastSyncOk: true,
      lastSyncError: null,
      lastSyncSource: source,
    });

    // Push fresh data to home-screen widgets (best-effort, non-blocking)
    updateWidgetData(hydrated, get().currency).catch(() => {});

    // Re-schedule renewal notifications with fresh data (best-effort)
    const notifSettings = get().notificationSettings;
    scheduleAll({
      subs: hydrated,
      bills: get().bills ?? [],
      enabled: notifSettings.renewalsEnabled,
      daysBefore: notifSettings.daysBefore,
      timeOfDay: notifSettings.timeOfDay,
      quietEnabled: notifSettings.quietEnabled ?? false,
      quietStart: notifSettings.quietStart ?? "22:00",
      quietEnd: notifSettings.quietEnd ?? "07:00",
    }).catch(() => {});

    return { ok: true, synced: hydrated.length };
  },

  fetchSubs: async () => {
    const user = get().user ?? (await getUserSafe());
    if (!user) {
      await get().loadSubsLocal();
      return { localOnly: true };
    }

    try {
      await get().syncNow({ source: 'auto' });
      return { localOnly: false };
    } catch {
      await get().loadSubsLocal();
      return { localOnly: true };
    }
  },

  addSub: async (sub) => {
    const user = get().user ?? (await getUserSafe());
    const id = uuid();
    const ts = nowISO();

    const sharedFields = normalizeSharedFields(sub);

    const local = {
      id,
      ...sub,

      // lifecycle
      active: sub?.active !== false,

      // shared normalized
      ...sharedFields,

      createdAt: ts,
      updatedAt: ts,
    };

    const next = [...get().subs, local];
    set({ subs: next });
    await safeSetJSON(SUBS_KEY, next);

    if (!user) {
      return { error: null, localOnly: true, needsSignIn: true, synced: false, id, item: local };
    }

    let err = null;
    try {
      const ins = await supabase.from('subscriptions').insert([mapLocalToDb(user.id, local)]);
      err = ins.error || null;
    } catch (e) {
      err = e;
    }

    return {
      error: null,
      localOnly: !!err,
      needsSignIn: false,
      synced: !err,
      syncError: err ? (err?.message || String(err)) : null,
      id,
      item: local,
    };
  },

  updateSub: async (id, patch) => {
    const ts = nowISO();

    // ✅ capture prev before merge (for price-change detection)
    const prev = (get().subs || []).find((s) => String(s.id) === String(id)) || null;

    const next = get().subs.map((s) => {
      if (String(s.id) !== String(id)) return s;

      const merged = { ...s, ...patch };
      merged.updatedAt = ts;
      if (!merged.createdAt) merged.createdAt = ts;

      // lifecycle
      merged.active = merged.active !== false;

      // shared normalized
      const sharedFields = normalizeSharedFields(merged);
      merged.shared = sharedFields.shared;
      merged.sharedCount = sharedFields.sharedCount;
      merged.sharedByMe = sharedFields.sharedByMe;
      merged.counterpartyName = sharedFields.counterpartyName;
      merged.splitMethod = sharedFields.splitMethod;
      merged.myShareAmount = sharedFields.myShareAmount;

      return merged;
    });

    // ✅ Price change detection → local notif (never blocks update)
    try {
      const after = next.find((s) => String(s.id) === String(id)) || null;
      const oldA = moneyNum(prev?.amount);
      const newA = moneyNum(after?.amount);

      if (oldA != null && newA != null && Math.abs(newA - oldA) >= 0.01) {
        const state = await loadPriceChangeState();
        const k = String(id);
        const lastNew = moneyNum(state?.[k]?.lastNewAmount);

        if (lastNew == null || Math.abs(lastNew - newA) >= 0.01) {
          state[k] = { lastNewAmount: newA, at: ts };
          await savePriceChangeState(state);

          await schedulePriceChangeNotification({
            brand: after?.merchant || prev?.merchant || "Subscription",
            domain: after?.domain || prev?.domain || "",
            oldAmount: oldA,
            newAmount: newA,
            currency: after?.currency || prev?.currency || "USD",
            effectiveDate: ts.slice(0, 10),
          });
        }
      }
    } catch {
      // no-op
    }

    const user = get().user ?? (await getUserSafe());

    set({ subs: next });
    await safeSetJSON(SUBS_KEY, next);

    if (!user) {
      return { error: null, localOnly: true, needsSignIn: true, synced: false };
    }

    // Write to BOTH duplicate columns so nothing in DB stays stale
    const nextDate = patch.nextRenewal ? toISODate(patch.nextRenewal) : undefined;
    const sharedByMe = patch.sharedByMe ?? undefined;

    const dbPatch = {
      merchant: patch.merchant,
      amount: patch.amount,
      currency: patch.currency,
      cadence: patch.cadence,

      next_renewal: nextDate,
      nextRenewal: nextDate,

      category: patch.category,
      shared: patch.shared,
      status: patch.status ?? undefined,
      active: patch.active !== undefined ? patch.active : undefined,

      shared_by_me: sharedByMe,
      sharedByMe: sharedByMe,

      is_trial: patch.is_trial ?? patch.trial ?? undefined,
      trial_end: patch.trial_end ?? patch.trialEnd ?? undefined,

      updated_at: ts,
    };
    Object.keys(dbPatch).forEach((k) => dbPatch[k] === undefined && delete dbPatch[k]);

    let err = null;
    try {
      const upd = await supabase
        .from('subscriptions')
        .update(dbPatch)
        .eq('user_id', user.id)
        .eq('id', id);

      err = upd.error || null;
    } catch (e) {
      err = e;
    }

    // When deactivating, record saving (best-effort)
    let savedEntry = null;
    if (patch.active === false && prev?.amount) {
      savedEntry = await get().recordSaving({
        id: prev.id,
        name: prev.merchant || prev.title || '',
        amount: prev.amount,
        currency: prev.currency || 'USD',
        cadence: prev.cadence || 'monthly',
      }).catch(() => null);
    }

    return {
      error: null,
      localOnly: !!err,
      needsSignIn: false,
      synced: !err,
      syncError: err ? (err?.message || String(err)) : null,
      savedEntry,
    };
  },

  deleteRecurring: async (kind, id) => {
    const k = String(kind || "").toLowerCase();
    if (!id) return { ok: false, error: "Missing id" };

    if (k === "bill") {
      const res = await get().deleteBill?.(id);
      return { ok: true, res };
    }

    const res = await get().deleteSub?.(id);
    return { ok: true, res };
  },

  deleteSub: async (id) => {
    const user = get().user ?? (await getUserSafe());

    const next = get().subs.filter((s) => String(s.id) !== String(id));
    set({ subs: next });
    await safeSetJSON(SUBS_KEY, next);

    if (!user) {
      const pending = await get()._loadPendingDeletes();
      await get()._savePendingDeletes([...pending, String(id)]);
      return { error: null, localOnly: true, needsSignIn: true, synced: false };
    }

    let err = null;
    try {
      const del = await supabase
        .from('subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('id', id);

      err = del.error || null;
    } catch (e) {
      err = e;
    }

    if (err) {
      const pending = await get()._loadPendingDeletes();
      await get()._savePendingDeletes([...pending, String(id)]);
    }

    return {
      error: null,
      localOnly: !!err,
      needsSignIn: false,
      synced: !err,
      syncError: err ? (err?.message || String(err)) : null,
    };
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