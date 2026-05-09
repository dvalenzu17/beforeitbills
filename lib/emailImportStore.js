import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import {
  runGmailScan,
  runImapScan,
  verifyImapCredentials as apiVerifyCredentials,
  getSubscriptions as apiFetchSubscriptions,
  IMAP_PROVIDERS,
} from "./emailImportClient";

const STORAGE_KEY = "beforeitbills:store:v3";
const MAX_SCAN_LOG = 20;

const defaultState = {
  // Multi-account: source of truth
  connectedAccounts: [], // [{ id, provider, email, connectedAt, lastScanAt }]
  // Legacy single-account fields - kept for backward compat, derived from connectedAccounts[0]
  connectedProvider: null,
  connectedEmail: null,
  candidates: [],
  handledFingerprints: [],
  subscriptions: [],
  lastScanAt: null,
  lastStats: null,
  scanLog: [],
  scanProgress: null,
  isLoading: false,
  error: null,
  didFastPass: false,
  hasHydrated: false,
};

function toTitleCase(s) {
  if (!s) return s;
  return String(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

async function loadPersisted() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function savePersisted(state) {
  try {
    const payload = {
      connectedAccounts: state.connectedAccounts || [],
      connectedProvider: state.connectedProvider,
      connectedEmail: state.connectedEmail,
      candidates: state.candidates,
      handledFingerprints: state.handledFingerprints,
      subscriptions: state.subscriptions,
      lastScanAt: state.lastScanAt,
      lastStats: state.lastStats,
      scanLog: state.scanLog,
      didFastPass: state.didFastPass,
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("PERSIST ERROR:", err.message);
  }
}

function cleanMerchantName(s) {
  if (!s) return s;
  // Strip common email prefixes left over from From header parsing
  let clean = String(s)
    .replace(/^(e-mail\.|email\.|www\.|billing\.|noreply@|no-reply@|support@|payments@|hello@|team@|info@)/i, "")
    .replace(/\.(com|net|io|org|co|app|co\.[a-z]{2})$/i, "")
    .trim();
  return toTitleCase(clean) || s;
}

function normaliseSub(s) {
  return {
    id: s.id,
    merchant: cleanMerchantName(toTitleCase(s.merchant)),
    // Backend v1 returned `renewalAmount`, current backend returns `amount` - handle both
    amount: s.amount ?? s.renewalAmount ?? null,
    currency: s.currency ?? "USD",
    renewalDate: s.renewalDate ?? s.renewal_date ?? null,
    billingInterval: s.billingInterval ?? s.billing_interval ?? s.cadence ?? "monthly",
    confidence: s.confidence ?? 0,
    isActive: s.isActive ?? s.is_active ?? true,
    // Treat everything as suggested unless explicitly marked confirmed
    isSuggested: s.isSuggested !== false,
    source: s.source ?? "gmail",
    // Evidence fields - preserved for the brand page
    senderDomain: s.senderDomain ?? s.sender_domain ?? null,
    rawSubject: s.rawSubject ?? s.raw_subject ?? null,
    rawFrom: s.rawFrom ?? s.raw_from ?? null,
  };
}

function buildCandidates(subscriptions, handledFingerprints) {
  return subscriptions
    // All scan results are candidates - isSuggested is now always true from normaliseSub
    .filter((s) => s.isSuggested !== false)
    .filter((s) => !handledFingerprints.includes(s.merchant))
    .map((s) => ({
      fingerprint: s.merchant,
      merchant: s.merchant,
      amount: s.amount,
      currency: s.currency,
      nextDateGuess: s.renewalDate,
      cadenceGuess: s.billingInterval ?? "monthly",
      confidence: s.confidence,
      source: s.source,
      domain: s.senderDomain ?? null,
      rawSubject: s.rawSubject ?? null,
      rawFrom: s.rawFrom ?? null,
    }));
}

function appendScanLog(existing, entry) {
  return [entry, ...existing].slice(0, MAX_SCAN_LOG);
}

export const useEmailImportStore = create((set, get) => ({
  ...defaultState,

  hydrate: async () => {
    const data = await loadPersisted();
    if (data) {
      // Migrate legacy single-account → connectedAccounts array
      let connectedAccounts = data.connectedAccounts || [];
      if (connectedAccounts.length === 0 && data.connectedProvider) {
        connectedAccounts = [{
          id: `${data.connectedProvider}:${data.connectedEmail || "legacy"}`,
          provider: data.connectedProvider,
          email: data.connectedEmail ?? null,
          connectedAt: new Date().toISOString(),
          lastScanAt: data.lastScanAt ?? null,
        }];
      }
      set({ ...defaultState, ...data, connectedAccounts, isLoading: false, error: null, scanProgress: null, hasHydrated: true });
    } else {
      set({ hasHydrated: true });
    }
  },

  // Called after login to restore Gmail connection state from backend.
  // The local store is wiped on sign-out, but tokens persist in the DB.
  restoreConnectionState: async () => {
    if (get().connectedAccounts.length > 0 || get().connectedProvider) return;

    try {
      const { supabase } = await import("./supabase");
      const { BACKEND_URL } = await import("./secrets");
      if (!BACKEND_URL) return;

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      // GET /subscriptions returns stored candidates - if any exist, connection was established
      const res = await fetch(`${BACKEND_URL}/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const hasData = (json?.subscriptions?.length ?? 0) > 0;
        if (hasData) {
          const account = { id: "gmail:primary", provider: "gmail", email: null, connectedAt: new Date().toISOString(), lastScanAt: null };
          const connectedAccounts = [account];
          const next = { connectedAccounts, connectedProvider: "gmail", connectedEmail: null };
          set(next);
          await savePersisted({ ...get(), ...next });
        }
      }
    } catch {
      // Non-fatal
    }
  },

  // -----------------------------------------------------------------------
  // MULTI-ACCOUNT
  // -----------------------------------------------------------------------

  addAccount: async ({ provider, email }) => {
    const id = `${provider}:${email || String(Date.now())}`;
    const accounts = get().connectedAccounts;
    // Deduplicate - if same id already connected, skip
    if (accounts?.some((a) => a.id === id) ?? false) return;
    const account = {
      id,
      provider,
      email: email ?? null,
      connectedAt: new Date().toISOString(),
      lastScanAt: null,
    };
    const connectedAccounts = [...accounts, account];
    // Keep legacy fields pointing to the most recently added account
    set({ connectedAccounts, connectedProvider: provider, connectedEmail: email ?? null });
    await savePersisted({ ...get(), connectedAccounts });
  },

  removeAccount: async (id) => {
    const connectedAccounts = get().connectedAccounts.filter((a) => a.id !== id);
    // Clean up stored IMAP credentials if any
    try { await SecureStore.deleteItemAsync(`bib:imap:${id}`); } catch {}
    // Sync legacy fields to the first remaining account
    const first = connectedAccounts[0];
    set({
      connectedAccounts,
      connectedProvider: first?.provider ?? null,
      connectedEmail: first?.email ?? null,
    });
    await savePersisted({ ...get(), connectedAccounts });
  },

  saveImapCredentials: async (id, user, pass) => {
    try {
      await SecureStore.setItemAsync(`bib:imap:${id}`, JSON.stringify({ user, pass }));
    } catch (err) {
      if (__DEV__) console.warn("[emailImportStore] SecureStore write failed:", err?.message);
    }
  },

  scanAccount: async (id, opts = {}) => {
    const account = get().connectedAccounts.find((a) => a.id === id);
    if (!account) throw new Error("Account not found");
    const { provider } = account;
    const isImap = IMAP_PROVIDERS.includes(provider);

    set({ isLoading: true, error: null, scanProgress: { status: "scanning" } });

    try {
      let scanResult;
      if (isImap) {
        let { user, pass } = opts;
        if (!user || !pass) {
          try {
            const raw = await SecureStore.getItemAsync(`bib:imap:${id}`);
            if (raw) { const c = JSON.parse(raw); user = c.user; pass = c.pass; }
          } catch (err) {
            if (__DEV__) console.warn("[emailImportStore] SecureStore read failed:", err?.message);
          }
        }
        scanResult = await runImapScan({ provider, user, pass, daysBack: opts.daysBack ?? 365 });
      } else {
        scanResult = await runGmailScan({ daysBack: opts.daysBack ?? 180 });
      }

      let result;
      if (scanResult?.subscriptions) {
        result = scanResult;
      } else {
        set({ scanProgress: { status: "fetching" } });
        result = await apiFetchSubscriptions();
      }

      const subscriptions = (result?.subscriptions ?? []).map(normaliseSub);
      const { handledFingerprints } = get();
      const candidates = buildCandidates(subscriptions, handledFingerprints);

      // Mark this account's lastScanAt
      const connectedAccounts = get().connectedAccounts.map((a) =>
        a.id === id ? { ...a, lastScanAt: new Date().toISOString() } : a
      );

      const logEntry = {
        at: new Date().toISOString(),
        provider,
        mode: isImap ? "imap" : "gmail",
        scanned: result?.meta?.scannedMessages ?? null,
        found: candidates.length,
        daysBack: opts.daysBack ?? (isImap ? 365 : 180),
      };

      const nextState = {
        subscriptions,
        candidates,
        connectedAccounts,
        lastScanAt: new Date().toISOString(),
        lastStats: result?.meta ?? null,
        scanLog: appendScanLog(get().scanLog, logEntry),
        isLoading: false,
        error: null,
        scanProgress: null,
      };

      set(nextState);
      await savePersisted({ ...get(), ...nextState });

      return subscriptions;
    } catch (err) {
      set({ isLoading: false, error: err.message ?? "Scan failed", scanProgress: null });
      throw err;
    }
  },

  // Scans all connected accounts sequentially. Partial failures are tolerated.
  scanAllAccounts: async (opts = {}) => {
    const accounts = get().connectedAccounts;
    if (accounts.length === 0) return [];
    const results = [];
    const errors = [];
    for (const account of accounts) {
      try {
        const r = await get().scanAccount(account.id, opts);
        results.push(...(r || []));
      } catch (err) {
        errors.push(err);
        if (__DEV__) console.warn(`[scanAllAccounts] ${account.id} failed:`, err?.message);
      }
    }
    if (errors.length === accounts.length) throw errors[0];
    return results;
  },

  // -----------------------------------------------------------------------
  // LEGACY SINGLE-ACCOUNT - kept for backward compat
  // -----------------------------------------------------------------------

  setConnectedProvider: ({ provider, email }) => {
    get().addAccount({ provider, email });
  },

  clearError: () => set({ error: null }),

  // -----------------------------------------------------------------------
  // VERIFY - IMAP only, called from verify.js before scan
  // -----------------------------------------------------------------------

  verifyCredentials: async ({ provider, user, pass }) => {
    set({ isLoading: true, error: null });
    try {
      await apiVerifyCredentials({ provider, user, pass });
      set({ isLoading: false });
    } catch (err) {
      const message = friendlyImapError(err.message);
      set({ isLoading: false, error: message });
      throw err;
    }
  },

  // -----------------------------------------------------------------------
  // SCAN - legacy entry point, routes to scanAccount using primary account
  // -----------------------------------------------------------------------

  runScan: async (opts = {}) => {
    const provider = opts.provider ?? get().connectedProvider ?? "gmail";

    // Route to scanAccount if we have a matching account in connectedAccounts
    const account = get().connectedAccounts.find((a) => a.provider === provider);
    if (account) {
      return get().scanAccount(account.id, opts);
    }

    // Fallback: legacy path for accounts not yet in connectedAccounts
    const isImap = IMAP_PROVIDERS.includes(provider);
    set({ isLoading: true, error: null, scanProgress: { status: "scanning" } });

    try {
      let scanResult;
      if (isImap) {
        const { user, pass, daysBack = 365 } = opts;
        scanResult = await runImapScan({ provider, user, pass, daysBack });
      } else {
        scanResult = await runGmailScan({ daysBack: opts.daysBack ?? 180 });
      }

      let result;
      if (scanResult?.subscriptions) {
        result = scanResult;
      } else {
        set({ scanProgress: { status: "fetching" } });
        result = await apiFetchSubscriptions();
      }
      const subscriptions = (result?.subscriptions ?? []).map(normaliseSub);
      const { handledFingerprints } = get();
      const candidates = buildCandidates(subscriptions, handledFingerprints);

      const logEntry = {
        at: new Date().toISOString(),
        provider,
        mode: isImap ? "imap" : "gmail",
        scanned: result?.meta?.scannedMessages ?? null,
        found: candidates.length,
        daysBack: opts.daysBack ?? 180,
      };

      const nextState = {
        subscriptions,
        candidates,
        lastScanAt: new Date().toISOString(),
        lastStats: result?.meta ?? null,
        scanLog: appendScanLog(get().scanLog, logEntry),
        isLoading: false,
        error: null,
        scanProgress: null,
      };

      set(nextState);
      await savePersisted({ ...get(), ...nextState });

      return subscriptions;
    } catch (err) {
      set({ isLoading: false, error: err.message ?? "Scan failed", scanProgress: null });
      throw err;
    }
  },

  // -----------------------------------------------------------------------
  // GMAIL ALIASES
  // -----------------------------------------------------------------------

  runGmailFastPass: async () => {
    if (get().didFastPass) return;
    // Don't set didFastPass until scan succeeds - otherwise a failed scan
    // blocks all future auto-scans until the user manually reconnects
    try {
      const result = await get().runScan({ provider: "gmail" });
      set({ didFastPass: true });
      await savePersisted({ ...get(), didFastPass: true });
      return result;
    } catch (err) {
      // didFastPass stays false - user can retry by tapping "Scan inbox"
      throw err;
    }
  },

  runGmailScan: async () => get().runScan({ provider: "gmail" }),

  // -----------------------------------------------------------------------
  // CANDIDATES
  // -----------------------------------------------------------------------

  markHandled: async (fingerprint) => {
    const prev = get().handledFingerprints;
    if (prev.includes(fingerprint)) return;
    const handledFingerprints = [...prev, fingerprint];
    const candidates = get().candidates.filter((c) => c.fingerprint !== fingerprint);
    const next = { handledFingerprints, candidates };
    set(next);
    await savePersisted({ ...get(), ...next });
  },

  restoreCandidate: async (candidate) => {
    const handledFingerprints = get().handledFingerprints.filter(
      (fp) => fp !== candidate.fingerprint
    );
    const candidates = [candidate, ...get().candidates];
    const next = { handledFingerprints, candidates };
    set(next);
    await savePersisted({ ...get(), ...next });
  },

  updateCandidate: async (fingerprint, patch) => {
    const candidates = get().candidates.map((c) =>
      c.fingerprint === fingerprint ? { ...c, ...patch } : c
    );
    set({ candidates });
    await savePersisted({ ...get(), candidates });
  },

  // -----------------------------------------------------------------------
  // DISCONNECT / CLEAR
  // -----------------------------------------------------------------------

  // Hard reset - called on sign-out to clear previous user's email state
  reset: async () => {
    const next = { ...defaultState, hasHydrated: true };
    set(next);
    await savePersisted(next);
  },

  disconnect: async () => {
    const next = {
      ...defaultState,
      scanLog: get().scanLog,
      hasHydrated: true,
    };
    set(next);
    await savePersisted(next);
  },

  resetFastPass: () => set({ didFastPass: false }),

  clearImported: async () => {
    const next = {
      candidates: [],
      handledFingerprints: [],
      subscriptions: [],
      lastStats: null,
    };
    set(next);
    await savePersisted({ ...get(), ...next });
  },
}));

function friendlyImapError(code) {
  const map = {
    invalid_credentials:   "Wrong email or app password. Double-check your credentials and try again.",
    app_password_required: "Use an app-specific password, not your account password. Check the link below for instructions.",
    rate_limited:          "Too many login attempts. Wait a few minutes and try again.",
    connection_failed:     "Could not reach the mail server. Check your internet connection and try again.",
    unsupported_provider:  "This email provider isn't supported yet.",
    missing_credentials:   "Email address and password are required.",
    imap_error:            "Could not connect. Double-check your email and app password.",
    imap_not_connected:    "No email account connected. Please connect an account first.",
    invalid_request:       "Invalid request. Check your settings and try again.",
    service_unavailable:   "The mail server is temporarily unavailable. Please try again in a few minutes.",
  };
  // Fallback: if the raw server message slips through, show a safe generic message
  return map[code] ?? "Could not connect. Check your email address and app password.";
}
