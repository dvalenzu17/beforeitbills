import { BACKEND_URL } from "./secrets";
import { supabase } from "./supabase";

export const EMAIL_PROVIDERS = {
  gmail: {
    label: "Gmail",
    notes: "Connects via IMAP with a Google App Password. Read-only access.",
    imap: { host: "imap.gmail.com", port: 993, secure: true },
  },
  yahoo: {
    label: "Yahoo Mail",
    notes: "Requires an app password from your Yahoo account security settings.",
    imap: {},
  },
  outlook: {
    label: "Outlook / Hotmail",
    notes: "Requires an app password if you have two-step verification enabled.",
    imap: {},
  },
  icloud: {
    label: "iCloud Mail",
    notes: "Requires an app-specific password from appleid.apple.com.",
    imap: {},
  },
  other: {
    label: "Other",
    notes: "Enter your IMAP server details manually.",
    imap: { host: "", port: 993, secure: true },
  },
};

export const IMAP_PROVIDERS = ["gmail", "yahoo", "outlook", "icloud", "other"];

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error("Auth session error");
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  return token;
}

async function request(path, options = {}) {
  if (!BACKEND_URL) {
    if (__DEV__) console.warn("[emailImportClient] EXPO_PUBLIC_BACKEND_URL is not set");
    throw new Error("Backend not configured. Set EXPO_PUBLIC_BACKEND_URL.");
  }
  const token = await getAccessToken();
  const { method = "GET", body } = options;

  const res = await fetch(`${BACKEND_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    // Surface the real error in all environments - it's not a security concern
    throw new Error(json?.error || `Request failed: ${res.status}`);
  }

  return json;
}

// Gmail scan - calls POST /scan on the backend
export async function runGmailScan({ daysBack = 180, force = false } = {}) {
  return request("/scan", { method: "POST", body: { daysBack, force } });
}

// IMAP scan - Yahoo, Outlook, iCloud, other
export async function runImapScan({ provider, user, pass, daysBack = 730 }) {
  return request("/scan/imap", {
    method: "POST",
    body: { provider, user, pass, daysBack },
  });
}

// Verify IMAP credentials before committing to a full scan
export async function verifyImapCredentials({ provider, user, pass }) {
  return request("/scan/imap/verify", {
    method: "POST",
    body: { provider, user, pass },
  });
}

// Fetch stored subscription candidates for this user
export async function getSubscriptions() {
  return request("/subscriptions", { method: "GET" });
}

// Fetch the subscription creep score for the current user
export async function getCreepScore() {
  return request("/creep-score", { method: "GET" });
}

// Fetch the guardian streak for the current user
export async function getGuardianStreak() {
  return request("/streak", { method: "GET" });
}

// Fetch the on-this-day data for the current user
export async function getOnThisDay() {
  return request("/on-this-day", { method: "GET" });
}

// Fetch notifications for the current user
export async function getNotifications({ tier, limit } = {}) {
  const params = new URLSearchParams();
  if (tier)  params.set("tier", tier);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return request(`/notifications${qs ? "?" + qs : ""}`, { method: "GET" });
}

// Mark a notification as read
export async function markNotificationRead(notifId) {
  return request(`/notifications/${notifId}/read`, { method: "PATCH" });
}