// lib/analytics.js
// PostHog analytics — real-time event tracking for growth visibility.
// Replaces the local AsyncStorage ring buffer with actual cloud analytics.
// PostHog is free up to 1M events/month, GDPR-friendly, YC-backed.
//
// Setup: npm install posthog-react-native
// Then wrap your app root with <PostHogProvider apiKey={...}>
// See lib/posthog.js for the provider setup.

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Sentry } from "./sentry";

// We load PostHog lazily so Metro doesn't break if the package isn't installed yet
let _posthog = null;
async function getPostHog() {
  if (_posthog) return _posthog;
  try {
    const { PostHog } = await import("posthog-react-native");
    const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
    if (!key) {
      if (__DEV__) console.warn("[analytics] EXPO_PUBLIC_POSTHOG_KEY not set — events are local-only");
      return null;
    }
    _posthog = new PostHog(key, {
      host: "https://us.i.posthog.com",
      persistence: "memory",
    });
    return _posthog;
  } catch {
    if (__DEV__) console.warn("[analytics] posthog-react-native not installed — events are local-only");
    return null;
  }
}

// ── Core events we care about for YC metrics ────────────────────────────────
//
// Activation funnel:
//   signed_up → onboarding_completed → gmail_connected → first_scan_done
//   → subscription_found → subscription_added
//
// Engagement:
//   app_opened, manual_add, scan_started, scan_completed
//   recap_opened, recap_shared, paywall_seen, paywall_converted
//
// Retention:
//   app_opened (daily) — PostHog auto-builds retention from this

export async function track(name, props = {}) {
  try {
    const evt = { name, props, at: new Date().toISOString() };

    // Sentry breadcrumb — unchanged
    Sentry?.addBreadcrumb?.({
      category: "event",
      message: name,
      data: props,
      level: "info",
    });

    // PostHog
    const ph = await getPostHog();
    if (ph) {
      ph.capture(name, {
        ...props,
        $timestamp: evt.at,
      });
    }

    // Local ring buffer fallback (keep for offline / debug)
    const KEY = "sublytics:events:v1";
    const MAX = 200;
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    arr.push(evt);
    const trimmed = arr.slice(Math.max(0, arr.length - MAX));
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // never block UX
  }
}

export async function identify(userId, traits = {}) {
  try {
    const ph = await getPostHog();
    if (ph && userId) {
      ph.identify(userId, traits);
    }
  } catch {}
}

export async function reset() {
  try {
    const ph = await getPostHog();
    if (ph) ph.reset();
  } catch {}
}