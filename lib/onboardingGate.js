// lib/onboardingGate.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase, SUPABASE_CONFIGURED } from "./supabase";

const KEY = "onboarding_done_v1";

/**
 * Check if the current user has completed onboarding.
 * Source of truth is Supabase user_metadata (works across devices).
 * AsyncStorage is a fast local cache to avoid blocking the boot path.
 */
export async function isOnboardingDone(user) {
  // If we have the user object already (from getSession), check metadata directly
  if (user?.user_metadata?.onboarding_done) {
    // Warm the local cache while we're here
    AsyncStorage.setItem(KEY, "1").catch(() => {});
    return true;
  }

  // Fall back to local cache
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "1") return true;
  } catch {}

  return false;
}

/**
 * Mark onboarding as done for the current user.
 * Writes to both Supabase user_metadata (cross-device) and AsyncStorage (speed).
 */
export async function setOnboardingDone(done = true) {
  // Local cache — instant
  try {
    await AsyncStorage.setItem(KEY, done ? "1" : "0");
  } catch {}

  // Supabase — persists across devices/reinstalls
  if (SUPABASE_CONFIGURED && supabase) {
    try {
      await supabase.auth.updateUser({ data: { onboarding_done: done } });
    } catch (e) {
      console.warn("[onboarding] failed to persist to Supabase:", e?.message);
    }
  }
}