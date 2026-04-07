import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Expo Go cannot load native purchase modules.
 * So we only require them dynamically when NOT in Expo Go.
 */
export function canUseNativePurchases() {
  // appOwnership: "expo" means Expo Go
  const ownership = Constants?.appOwnership;
  if (ownership === "expo") return false;
  if (Platform.OS === "web") return false;
  return true;
}

function safeRequirePurchases() {
  try {
    // IMPORTANT: dynamic require so Metro doesn't execute it in Expo Go
    // If the package isn't installed, this will throw and we fall back.
    // eslint-disable-next-line global-require
    return require("react-native-purchases");
  } catch (e) {
    return null;
  }
}

export async function configurePurchases({ apiKey, appUserID }) {
  if (!canUseNativePurchases()) return { ok: false, reason: "expo_go" };
  const Purchases = safeRequirePurchases();
  if (!Purchases) return { ok: false, reason: "missing_module" };

  try {
    Purchases.configure({ apiKey, appUserID });
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "configure_failed", error: String(e?.message || e) };
  }
}

export async function getOfferings() {
  if (!canUseNativePurchases()) return { ok: true, offerings: null, packages: [] };
  const Purchases = safeRequirePurchases();
  if (!Purchases) return { ok: true, offerings: null, packages: [] };

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings?.current;
    const packages = current?.availablePackages || [];
    return { ok: true, offerings, packages };
  } catch (e) {
    return { ok: false, reason: "offerings_failed", error: String(e?.message || e), offerings: null, packages: [] };
  }
}

export async function purchasePackage(rcPackage) {
  if (!canUseNativePurchases()) return { ok: false, reason: "expo_go" };
  const Purchases = safeRequirePurchases();
  if (!Purchases) return { ok: false, reason: "missing_module" };

  try {
    const res = await Purchases.purchasePackage(rcPackage);
    return { ok: true, res };
  } catch (e) {
    return { ok: false, reason: "purchase_failed", error: String(e?.message || e) };
  }
}

export async function restorePurchasesNative() {
  if (!canUseNativePurchases()) return { ok: false, reason: "expo_go" };
  const Purchases = safeRequirePurchases();
  if (!Purchases) return { ok: false, reason: "missing_module" };

  try {
    const info = await Purchases.restorePurchases();
    return { ok: true, info };
  } catch (e) {
    return { ok: false, reason: "restore_failed", error: String(e?.message || e) };
  }
}

export async function getCustomerInfo() {
  if (!canUseNativePurchases()) return { ok: true, info: null };
  const Purchases = safeRequirePurchases();
  if (!Purchases) return { ok: true, info: null };

  try {
    const info = await Purchases.getCustomerInfo();
    return { ok: true, info };
  } catch (e) {
    return { ok: false, reason: "info_failed", error: String(e?.message || e), info: null };
  }
}
