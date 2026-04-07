// lib/api.js
import { supabase } from "@/lib/supabase";

// put your Render URL in app env, e.g. EXPO_PUBLIC_IMPORT_API_URL
const BASE_URL = process.env.EXPO_PUBLIC_IMPORT_API_URL;

if (!BASE_URL) {
  console.warn("[api] Missing EXPO_PUBLIC_IMPORT_API_URL");
}

async function getAccessToken() {
  const { data } = await supabase?.auth?.getSession?.();
  return data?.session?.access_token ?? null;
}

export async function apiPost(path, body) {
  const token = await getAccessToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.message || json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}
