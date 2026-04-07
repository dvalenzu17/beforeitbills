// lib/authState.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export const AUTH_BYPASS_KEY = "sublytics:authBypass:v1";

export const useAuthState = create((set, get) => ({
  authReady: false,
  authBypass: false,

  hydrate: async () => {
    try {
      const v = await AsyncStorage.getItem(AUTH_BYPASS_KEY);
      set({ authBypass: v === "1" });
    } catch {
      set({ authBypass: false });
    }
  },

  setReady: (ready) => set({ authReady: !!ready }),

  setBypass: async (enabled) => {
    const on = !!enabled;
    set({ authBypass: on });
    try {
      if (on) await AsyncStorage.setItem(AUTH_BYPASS_KEY, "1");
      else await AsyncStorage.removeItem(AUTH_BYPASS_KEY);
    } catch {
      // ignore
    }
  },

  clearBypass: async () => {
    set({ authBypass: false });
    try {
      await AsyncStorage.removeItem(AUTH_BYPASS_KEY);
    } catch {
      // ignore
    }
  },
}));
