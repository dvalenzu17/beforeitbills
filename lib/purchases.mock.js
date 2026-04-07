// lib/purchases.mock.js
// Expo Go safe stub. Keeps app running without native module.
export const LOG_LEVEL = { VERBOSE: "VERBOSE" };

const noop = async () => ({});

const PurchasesMock = {
  setLogLevel: () => {},
  configure: () => {},
  addCustomerInfoUpdateListener: () => {},
  getCustomerInfo: async () => ({ entitlements: { active: {} } }),
  logIn: async () => ({ customerInfo: { entitlements: { active: {} } } }),
  logOut: async () => {},
  getOfferings: async () => ({ current: { availablePackages: [] } }),
  purchasePackage: async () => {
    const err = new Error("Purchases not available in Expo Go. Build a dev client / APK.");
    throw err;
  },
  restorePurchases: async () => ({ entitlements: { active: {} } }),
};

export default PurchasesMock;
