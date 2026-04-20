import * as Sentry from "@sentry/react-native";

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  // ignore missing or placeholder DSNs
  if (!dsn || dsn.includes("YOUR_SENTRY_DSN")) return;

  Sentry.init({
    dsn,
    // JS-only mode: Sentry Cocoa pod (IPHONEOS_DEPLOYMENT_TARGET=11.0) throws
    // an NSException on iOS 26 during initNativeSDK(). enableNative: false
    // prevents that TurboModule void call entirely.
    enableNative: false,
    // Tracing disabled: stallTrackingIntegration runs a 50ms setInterval that
    // iterates statsByRootSpan (a Map) on the Hermes JS thread while Hades GC
    // workers run concurrently — this triggers a DictPropertyMap write-barrier
    // bug (CompressedPointer::getNonNull crash). tracesSampleRate:0 prevents
    // any root span from being created so the Map is always empty and the loop
    // is a no-op. Re-enable once on a Hermes version tested against iOS 26.
    tracesSampleRate: 0,
  });
}

export { Sentry };
