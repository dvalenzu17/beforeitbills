// lib/purchases.js
import { Platform } from "react-native";
import Constants from "expo-constants";

export async function getPurchasesModule() {
  // Web or Expo Go — never native
  if (Platform.OS === "web" || Constants?.appOwnership === "expo") {
    const mock = await import("./purchases.mock");
    return { Purchases: mock.default, LOG_LEVEL: mock.LOG_LEVEL, isNative: false };
  }

  // For real device builds (TestFlight, production, dev client) attempt to load
  // the native module directly. This handles both old and new architecture without
  // relying on NativeModules / TurboModuleRegistry name resolution.
  try {
    // eslint-disable-next-line global-require
    const mod = require("react-native-purchases");
    const Purchases = mod?.default ?? mod;
    const LOG_LEVEL = mod?.LOG_LEVEL ?? { VERBOSE: "VERBOSE" };

    if (typeof Purchases?.configure !== "function") {
      throw new Error("react-native-purchases loaded but configure is missing");
    }

    if (__DEV__) console.log("[purchases] native RC module loaded successfully");
    return { Purchases, LOG_LEVEL, isNative: true };
  } catch (e) {
    if (__DEV__) console.warn("[purchases] native module unavailable, using mock:", e?.message);
  }

  const mock = await import("./purchases.mock");
  return { Purchases: mock.default, LOG_LEVEL: mock.LOG_LEVEL, isNative: false, error: "native module unavailable" };
}
