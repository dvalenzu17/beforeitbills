// lib/purchases.js
import { NativeModules } from "react-native";

export async function getPurchasesModule() {
  // Only treat as native-capable if the actual native module exists
  const hasNative = !!NativeModules?.RNPurchases;

  if (!hasNative) {
    const mock = await import("./purchases.mock");
    return { Purchases: mock.default, LOG_LEVEL: mock.LOG_LEVEL, isNative: false };
  }

  // Native exists => safe to use lazy proxy (still no crash on import)
  const mod = await import("./purchases.native");
  return { Purchases: mod.default, LOG_LEVEL: mod.LOG_LEVEL, isNative: true };
}
