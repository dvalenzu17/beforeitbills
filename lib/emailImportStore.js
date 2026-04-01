import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
    // Backend v1 returned `renewalAmount`, current backend returns `amount` — handle both
    amount: s.amount ?? s.renewalAmount ?? null,
    currency: s.currency ?? "USD",
    renewalDate: s.renewalDate ?? s.renewal_date ?? null,
    billingInterval: s.billingInterval ?? s.billing_interval ?? s.cadence ?? "monthly",
    confidence: s.confidence ?? 0,
    isActive: s.isActive ?? s.is_active ?? true,
    // Treat everything as suggested unless explicitly marked confirmed
    isSuggested: s.isSuggested !== false,
    source: s.source ?? "gmail",
    // Evidence fields — preserved for the brand page
    senderDomain: s.senderDomain ?? s.sender_domain ?? null,
    rawSubject: s.rawSubject ?? s.raw_subject ?? null,
    rawFrom: s.rawFrom ?? s.raw_from ?? null,
  };
}

function buildCandidates(subscriptions, handledFingerprints) {
  return subscriptions
    // All scan results are candidates — isSuggested is now always true from normaliseSub
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
      set({ ...defaultState, ...data, isLoading: false, error: null, scanProgress: null, hasHydrated: true });
    } else {
      set({ hasHydrated: true });
    }
  },

  // Called after login to restore Gmail connection state from backend.
  // The local store is wiped on sign-out, but tokens persist in the DB.
  restoreConnectionState: async () => {
    if (get().connectedProvider) return;

    try {
      const { supabase } = await import("./supabase");
      const { BACKEND_URL } = await import("./secrets");
      if (!BACKEND_URL) return;

      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;

      // GET /subscriptions returns stored candidates — if any exist, connection was established
      const res = await fetch(`${BACKEND_URL}/subscriptions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json().catch(() => null);
        const hasData = (json?.subscriptions?.length ?? 0) > 0;
        if (hasData) {
          const next = { connectedProvider: "gmail", connectedEmail: null };
          set(next);
          await savePersisted({ ...get(), ...next });
        }
      }
    } catch {
      // Non-fatal
    }
  },

  setConnectedProvider: ({ provider, email }) => {
    const next = { connectedProvider: provider, connectedEmail: email ?? null };
    set(next);
    savePersisted({ ...get(), ...next });
  },

  clearError: () => set({ error: null }),

  // -----------------------------------------------------------------------
  // VERIFY — IMAP only, called from verify.js before scan
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
  // SCAN — routes to Gmail or IMAP based on provider
  // -----------------------------------------------------------------------

  runScan: async (opts = {}) => {
    const provider = opts.provider ?? get().connectedProvider ?? "gmail";
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

      // Use subscriptions from scan response directly — avoids a second round-trip.
      // Fall back to GET /subscriptions only if the scan didn't return them (e.g. queue mode).
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
    // Don't set didFastPass until scan succeeds — otherwise a failed scan
    // blocks all future auto-scans until the user manually reconnects
    try {
      const result = await get().runScan({ provider: "gmail" });
      set({ didFastPass: true });
      await savePersisted({ ...get(), didFastPass: true });
      return result;
    } catch (err) {
      // didFastPass stays false — user can retry by tapping "Scan inbox"
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

  // Hard reset — called on sign-out to clear previous user's email state
  reset: async () => {
    const next = { ...defaultState, hasHydrated: true };
    set(next);
    await savePersisted(next);
  },

  disconnect: async () => {
    const next = { ...defaultState, scanLog: get().scanLog, hasHydrated: true };
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
    invalid_credentials: "Wrong email or password. Make sure you're using an app password.",
    app_password_required: "This account requires an app-specific password, not your main password.",
    rate_limited: "Too many login attempts. Wait a few minutes and try again.",
    connection_failed: "Could not connect to the mail server. Check your internet connection.",
    unsupported_provider: "This email provider is not supported yet.",
    missing_credentials: "Email and password are required.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}