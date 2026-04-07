// lib/purchases.native.js
// IMPORTANT: do NOT import "react-native-purchases" at top-level.
// Expo Go will crash just by evaluating it.

import { NativeModules } from "react-native";

let _cached = null;

function getRealModule() {
  // If native module isn't installed, don't crash   throw a normal JS error.
  if (!NativeModules?.RNPurchases) {
    throw new Error("RevenueCat native module missing (Expo Go / no dev build).");
  }

  if (_cached) return _cached;

  // Lazy-require only when native module exists
  // eslint-disable-next-line global-require
  const mod = require("react-native-purchases");
  _cached = {
    Purchases: mod?.default ?? mod,
    LOG_LEVEL: mod?.LOG_LEVEL ?? { VERBOSE: "VERBOSE" },
  };
  return _cached;
}

const PurchasesProxy = {
  setLogLevel: (...args) => getRealModule().Purchases.setLogLevel?.(...args),
  configure: (...args) => getRealModule().Purchases.configure?.(...args),
  addCustomerInfoUpdateListener: (...args) =>
    getRealModule().Purchases.addCustomerInfoUpdateListener?.(...args),
  getCustomerInfo: (...args) => getRealModule().Purchases.getCustomerInfo?.(...args),
  logIn: (...args) => getRealModule().Purchases.logIn?.(...args),
  logOut: (...args) => getRealModule().Purchases.logOut?.(...args),
  getOfferings: (...args) => getRealModule().Purchases.getOfferings?.(...args),
  purchasePackage: (...args) => getRealModule().Purchases.purchasePackage?.(...args),
  restorePurchases: (...args) => getRealModule().Purchases.restorePurchases?.(...args),
};

export const LOG_LEVEL = { VERBOSE: "VERBOSE" };
export default PurchasesProxy;
