// lib/auth/googleGmailOAuth.js
// Uses expo-auth-session with PKCE to request Gmail read-only access,
// then sends the code to the backend /oauth/google/exchange endpoint.

import { Platform } from "react-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../supabase";
import { BACKEND_URL } from "../secrets";

WebBrowser.maybeCompleteAuthSession();

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

// Set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in EAS secrets.
// Full form: 577544...t.apps.googleusercontent.com
const IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
  "577544895857-igb9t8cbphcfao6idjjot8u81h3nbp4t.apps.googleusercontent.com";

const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";

// On Android, use the Android OAuth client + its reversed-client redirect when
// configured; otherwise fall back to the iOS client so iOS behavior is unchanged.
// The backend /oauth/google/exchange is client-agnostic (PKCE, no secret), so it
// accepts whichever client/redirect we send here.
const CLIENT_ID =
  Platform.OS === "android" && ANDROID_CLIENT_ID ? ANDROID_CLIENT_ID : IOS_CLIENT_ID;

const CLIENT_ID_SHORT = CLIENT_ID.replace(".apps.googleusercontent.com", "");
const REDIRECT_URI = `com.googleusercontent.apps.${CLIENT_ID_SHORT}:/`;

export async function connectGoogleGmail() {
  // Requires a valid Supabase session - user must be signed in
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;
  if (!accessToken) throw new Error("not_authenticated");

  const discovery = {
    authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenEndpoint: "https://oauth2.googleapis.com/token",
  };

  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,           // platform-aware (Android vs iOS client)
    scopes: [GMAIL_SCOPE],
    redirectUri: REDIRECT_URI,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  });

  const result = await request.promptAsync(discovery);

  if (result.type !== "success" || !result.params?.code) {
    return { ok: false, cancelled: result.type === "cancel" };
  }

  const { code } = result.params;
  const codeVerifier = request.codeVerifier;

  if (!BACKEND_URL) {
    throw new Error("BACKEND_URL is not configured. Set EXPO_PUBLIC_BACKEND_URL.");
  }

  let res, json;
  try {
    res = await fetch(`${BACKEND_URL}/oauth/google/exchange`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        code,
        codeVerifier,
        redirectUri: REDIRECT_URI,
        clientId: CLIENT_ID,       // platform-aware (Android vs iOS client)
      }),
    });
    json = await res.json();
  } catch (netErr) {
    throw new Error(`Network error reaching backend: ${netErr?.message}`);
  }

  if (!res.ok) {
    const detail = json?.error || `HTTP ${res.status}`;
    throw new Error(`Backend exchange failed: ${detail}`);
  }

  return { ok: true, email: json?.email ?? null };
}