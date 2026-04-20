import * as Sentry from "@sentry/react-native";

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  // ignore missing or placeholder DSNs
  if (!dsn || dsn.includes("YOUR_SENTRY_DSN")) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Run Sentry in JS-only mode. The Sentry Cocoa pod declares
    // IPHONEOS_DEPLOYMENT_TARGET=11.0 and its native initNativeSDK() void
    // TurboModule call throws an NSException on iOS 26. That exception is
    // converted to a JS error and delivered via RuntimeScheduler to the Hermes
    // thread, where Sentry's own Map-based event pipeline triggers a Hades GC
    // write-barrier bug (CompressedPointer::getNonNull crash). Disabling the
    // native SDK eliminates the throw entirely. JS error/breadcrumb capture
    // still works; only native crash symbolication is lost.
    enableNative: false,
  });
}

export { Sentry };
