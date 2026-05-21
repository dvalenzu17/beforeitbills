// Dynamic require so a missing RNSentry native module (Expo Go, web) doesn't
// crash the app before any ErrorBoundary exists. Falls back to no-ops.
let _sentry;
try {
  _sentry = require("@sentry/react-native");
} catch {
  _sentry = {
    init: () => {},
    captureException: () => {},
    captureMessage: () => {},
    wrap: (c) => c,
    setUser: () => {},
    addBreadcrumb: () => {},
    withScope: () => {},
    configureScope: () => {},
  };
}

export const Sentry = _sentry;

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  // ignore missing or placeholder DSNs
  if (!dsn || dsn.includes("YOUR_SENTRY_DSN")) return;

  // Wrap in try/catch: initSentry() is called at module evaluation time before
  // any ErrorBoundary exists. If Sentry.init() throws (e.g. @sentry/core 10.x
  // interacting badly with RN 0.83 ErrorUtils API), the throw propagates
  // straight to RCTFatal and crashes the app with no report.
  try {
    Sentry.init({
      dsn,
      // JS-only mode: Sentry Cocoa pod (IPHONEOS_DEPLOYMENT_TARGET=11.0) throws
      // an NSException on iOS 26 during initNativeSDK(). enableNative: false
      // prevents that TurboModule void call entirely.
      enableNative: false,
      // Tracing disabled: stallTrackingIntegration runs a 50ms setInterval that
      // iterates statsByRootSpan (a Map) on the Hermes JS thread while Hades GC
      // workers run concurrently - this triggers a DictPropertyMap write-barrier
      // bug (CompressedPointer::getNonNull crash). tracesSampleRate:0 prevents
      // any root span from being created so the Map is always empty and the loop
      // is a no-op.
      tracesSampleRate: 0,
    });
  } catch (e) {
    // Sentry failed to initialise - app continues without crash reporting.
    // eslint-disable-next-line no-console
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn('[sentry] init failed:', e?.message);
  }
}
