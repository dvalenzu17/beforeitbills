import * as Sentry from "@sentry/react-native";

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

  // ignore missing or placeholder DSNs
  if (!dsn || dsn.includes("YOUR_SENTRY_DSN")) return;

  Sentry.init({
    dsn,
    tracesSampleRate: 0.1
  });
}

export { Sentry };
