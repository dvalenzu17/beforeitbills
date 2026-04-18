import * as Sentry from "@sentry/react-native";

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  // ignore missing or placeholder DSNs
  if (!dsn || dsn.includes("YOUR_SENTRY_DSN")) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    // Disable Sentry's native NSException/crash handler — it installs an
    // NSUncaughtExceptionHandler that races with React Native's TurboModule
    // @try/@catch in RCTTurboModule.mm, causing a use-after-free (PAC failure)
    // when both attempt to access the same NSException object on iOS 26.
    enableNativeCrashHandling: false,
  });
}

export { Sentry };
