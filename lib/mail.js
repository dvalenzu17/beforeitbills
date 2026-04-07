/*import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { Platform } from "react-native";

import {
  BACKEND_URL,
  GOOGLE_OAUTH_IOS_CLIENT_ID,
  GOOGLE_OAUTH_ANDROID_CLIENT_ID,
} from "./config";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
};

const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
];

async function getSupabaseJwt() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

function assertNotExpoGo() {
  // OAuth redirects + custom schemes are consistently flaky in Expo Go.
  // Dev build / EAS build is the only sane path for prod-ready OAuth.
  if (Constants.appOwnership === "expo") {
    throw new Error(
      "Gmail sync requires a Dev Build (EAS). Expo Go cannot reliably handle native OAuth redirects."
    );
  }
}

function googleSchemeFromClientId(clientId) {
  if (!clientId) throw new Error("Missing Google OAuth client ID");
  const suffix = ".apps.googleusercontent.com";
  const idx = clientId.indexOf(suffix);
  if (idx === -1) {
    throw new Error(
      "Invalid Google client ID format (expected *.apps.googleusercontent.com)"
    );
  }
  const prefix = clientId.slice(0, idx);
  // Google installed-app scheme must contain a dot (reverse DNS style)
  return `com.googleusercontent.apps.${prefix}`;
}

function getPlatformClientId() {
  if (Platform.OS === "ios") return GOOGLE_OAUTH_IOS_CLIENT_ID;
  if (Platform.OS === "android") return GOOGLE_OAUTH_ANDROID_CLIENT_ID;
  throw new Error(`Unsupported platform: ${Platform.OS}`);
}

function buildRedirectUri(clientId) {
  // Google native-app format is scheme:/path (single slash)
  const scheme = googleSchemeFromClientId(clientId);
  return `${scheme}:/oauth2redirect/google`;
}

function assertBackendConfigured() {
  if (!BACKEND_URL) {
    throw new Error(
      "Missing EXPO_PUBLIC_BACKEND_URL (required on device / production builds)."
    );
  }
}

export async function connectGmail() {
  assertNotExpoGo();
  assertBackendConfigured();

  const clientId = getPlatformClientId();
  if (!clientId) {
    throw new Error(
      `Missing Google OAuth client ID for ${Platform.OS}. Set EXPO_PUBLIC_GOOGLE_OAUTH_${Platform.OS.toUpperCase()}_CLIENT_ID.`
    );
  }

  const redirectUri = buildRedirectUri(clientId);
  if (__DEV__) console.log("GOOGLE REDIRECT URI:", redirectUri);

  const request = new AuthSession.AuthRequest({
    clientId,
    scopes: SCOPES,
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    },
  });

  const authUrl = await request.makeAuthUrlAsync(discovery);

  const result = await request.promptAsync(discovery, {
    url: authUrl,
    useProxy: false,
    preferEphemeralSession: true,
  });

  if (result.type !== "success") {
    return { ok: false, cancelled: true };
  }

  const code = result.params?.code;
  if (!code) throw new Error("No auth code returned");

  const jwt = await getSupabaseJwt();
  const res = await fetch(`${BACKEND_URL}/oauth/google/exchange`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({
      code,
      codeVerifier: request.codeVerifier || null,
      redirectUri,
      clientId,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Backend exchange failed");
  return { ok: true, ...json };
}

export async function scanGmail() {
  assertBackendConfigured();
  const jwt = await getSupabaseJwt();
  const res = await fetch(`${BACKEND_URL}/mail/google/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Scan failed");
  return { ok: true, ...json };
}
*/