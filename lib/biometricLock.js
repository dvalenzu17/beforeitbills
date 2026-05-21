// lib/biometricLock.js
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { create } from "zustand";

const ENABLED_KEY = "bib.biometricLock.v1";

export const useBiometricLock = create((set, get) => ({
  enabled: false,
  locked: false, // resolved to true only after hydrate() if enabled

  hydrate: async () => {
    try {
      const v = await SecureStore.getItemAsync(ENABLED_KEY);
      const on = v === "1";
      set({ enabled: on, locked: on });
    } catch (e) {
      if (__DEV__) console.warn("[biometricLock] hydrate error:", e?.message);
      set({ enabled: false, locked: false });
    }
  },

  setEnabled: async (on) => {
    set({ enabled: !!on, locked: false });
    try {
      if (on) await SecureStore.setItemAsync(ENABLED_KEY, "1");
      else await SecureStore.deleteItemAsync(ENABLED_KEY);
    } catch (e) {
      if (__DEV__) console.warn("[biometricLock] setEnabled error:", e?.message);
    }
  },

  lock: () => {
    if (get().enabled) set({ locked: true });
  },

  unlock: () => set({ locked: false }),

  authenticate: async () => {
    try {
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!enrolled) {
        // No biometrics enrolled - unlock without auth to avoid locking user out
        set({ locked: false });
        return true;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock BeforeItBills",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        set({ locked: false });
        return true;
      }
      return false;
    } catch (e) {
      if (__DEV__) console.warn("[biometricLock] authenticate error:", e?.message);
      // On error, fail open to avoid permanently locking user out
      set({ locked: false });
      return true;
    }
  },
}));

/** Returns true if the device supports biometric auth */
export async function hasBiometricHardware() {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return enrolled;
  } catch {
    return false;
  }
}
