// lib/purchasesStore.js
import { create } from "zustand";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { getPurchasesModule } from "./purchases";

function getConfig() {
  const extra = Constants?.expoConfig?.extra || Constants?.manifest?.extra || {};

  // Read from process.env first (EAS secrets / EXPO_PUBLIC_ vars), then fall
  // back to app.config.js extra block. app.config.js must forward the env var:
  //   revenuecatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
  const iosKey =
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ||
    extra?.revenuecatIosApiKey ||
    extra?.EXPO_PUBLIC_REVENUECAT_IOS_KEY ||
    '';

  const androidKey =
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ||
    extra?.revenuecatAndroidApiKey ||
    extra?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ||
    '';

  return {
    androidKey,
    iosKey,
    debug: !!extra?.revenuecatDebug,
    entitlement: extra?.revenuecatEntitlementId ?? 'pro',
  };
}

function isProActive(customerInfo) {
  const { entitlement } = getConfig();
  const active = customerInfo?.entitlements?.active ?? {};
  return !!active?.[entitlement];
}

export const usePurchasesStore = create((set, get) => ({
  ready: false,
  loading: false,
  error: null,

  isPro: false,
  customerInfo: null,
  offerings: null,

  _rc: null, // { Purchases, LOG_LEVEL, isNative }

  _ensure: async () => {
    const cur = get()._rc;
    if (cur) return cur;
    const mod = await getPurchasesModule();
    set({ _rc: mod });
    return mod;
  },

  init: async () => {
    try {
      const { androidKey, iosKey, debug } = getConfig();
      const { Purchases, LOG_LEVEL, isNative, error } = await get()._ensure();

      const apiKey = Platform.OS === "android" ? androidKey : iosKey;

      // Expo Go / missing module / missing key => don't crash
      if (!isNative || !apiKey) {
        set({ ready: true, error: error ?? null, isPro: false, customerInfo: null });
        return;
      }

      if (debug && Purchases?.setLogLevel) Purchases.setLogLevel(LOG_LEVEL.VERBOSE);

      Purchases.configure({ apiKey });

      Purchases.addCustomerInfoUpdateListener((info) => {
        set({ customerInfo: info, isPro: isProActive(info) });
      });

      const info = await Purchases.getCustomerInfo();
      set({ ready: true, customerInfo: info, isPro: isProActive(info) });
    } catch (e) {
      set({ ready: true, error: e?.message ?? String(e) });
    }
  },

  login: async (appUserId) => {
    try {
      const { Purchases, isNative } = await get()._ensure();
      if (!isNative || !appUserId) return;
      const { customerInfo } = await Purchases.logIn(String(appUserId));
      set({ customerInfo, isPro: isProActive(customerInfo) });
    } catch (e) {
      set({ error: e?.message ?? String(e) });
    }
  },

  logout: async () => {
    try {
      const { Purchases, isNative } = await get()._ensure();
      if (!isNative) {
        set({ customerInfo: null, isPro: false });
        return;
      }
      await Purchases.logOut();
      const info = await Purchases.getCustomerInfo();
      set({ customerInfo: info, isPro: isProActive(info) });
    } catch (e) {
      set({ error: e?.message ?? String(e) });
    }
  },

  loadOfferings: async () => {
    set({ loading: true, error: null });
    try {
      const { Purchases, isNative } = await get()._ensure();
      if (!isNative) {
        const empty = { current: { availablePackages: [] } };
        set({ offerings: empty, loading: false });
        return empty;
      }
      const offerings = await Purchases.getOfferings();
      set({ offerings, loading: false });
      return offerings;
    } catch (e) {
      set({ loading: false, error: e?.message ?? String(e) });
      return null;
    }
  },

  purchasePackage: async (pkg) => {
    if (!pkg) return { ok: false, error: "Missing package" };
    set({ loading: true, error: null });
    try {
      const { Purchases, isNative } = await get()._ensure();
      if (!isNative) {
        set({ loading: false });
        return { ok: false, error: "Purchases require an APK/dev build (not Expo Go)." };
      }
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      set({ customerInfo, isPro: isProActive(customerInfo), loading: false });
      return { ok: true };
    } catch (e) {
      const msg = e?.message ?? String(e);
      set({ loading: false, error: msg });
      return { ok: false, error: msg };
    }
  },

  restore: async () => {
    set({ loading: true, error: null });
    try {
      const { Purchases, isNative } = await get()._ensure();
      if (!isNative) {
        set({ loading: false });
        return { ok: true };
      }
      const info = await Purchases.restorePurchases();
      set({ customerInfo: info, isPro: isProActive(info), loading: false });
      return { ok: true };
    } catch (e) {
      const msg = e?.message ?? String(e);
      set({ loading: false, error: msg });
      return { ok: false, error: msg };
    }
  },
}));