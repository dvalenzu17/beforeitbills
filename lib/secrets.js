// lib/secrets.js
import Constants from "expo-constants";

const extra =
  Constants?.expoConfig?.extra ||
  Constants?.manifest?.extra ||
  {};

const fromEnv = (k) => (typeof process !== "undefined" ? process.env?.[k] : "") || "";

export const SUPABASE_URL =
  fromEnv("EXPO_PUBLIC_SUPABASE_URL") ||
  extra.EXPO_PUBLIC_SUPABASE_URL ||
  "";

export const SUPABASE_ANON_KEY =
  fromEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY") ||
  extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const BACKEND_URL =
  fromEnv("EXPO_PUBLIC_BACKEND_URL") ||
  extra.EXPO_PUBLIC_BACKEND_URL ||
  "";

export function assertSupabaseConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // No dev-y message. This is user-safe.
    throw new Error("Sign-in is unavailable right now.");
  }
}
