// lib/config.js
// Set these in EAS / local env as EXPO_PUBLIC_*
// For production builds, you MUST set EXPO_PUBLIC_BACKEND_URL.

const DEV_FALLBACK_BACKEND = typeof __DEV__ !== 'undefined' && __DEV__ ? 'http://localhost:8787' : '';

export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || DEV_FALLBACK_BACKEND;

// Single canonical name for the Google OAuth iOS client ID.
// Any old EXPO_PUBLIC_GOOGLE_OAUTH_IOS_CLIENT_ID references should be
// migrated to this name in EAS secrets.
// Fallback uses the client ID already embedded in app.config.js iosUrlScheme -
// not a secret (it's in the compiled app binary and the URL scheme).
const GOOGLE_IOS_CLIENT_ID_FALLBACK = '577544895857-igb9t8cbphcfao6idjjot8u81h3nbp4t.apps.googleusercontent.com';

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_OAUTH_IOS_CLIENT_ID || // legacy fallback
  GOOGLE_IOS_CLIENT_ID_FALLBACK;

export const GOOGLE_ANDROID_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_OAUTH_ANDROID_CLIENT_ID || // legacy fallback
  '';

export const TERMS_URL   = process.env.EXPO_PUBLIC_TERMS_URL   || "";
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || "";