import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { BACKEND_URL, GOOGLE_OAUTH_WEB_CLIENT_ID } from "./config";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const useProxy = Constants.appOwnership === "expo";

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

export async function connectGmail() {
  if (!GOOGLE_OAUTH_WEB_CLIENT_ID) {
    throw new Error("Missing EXPO_PUBLIC_GOOGLE_OAUTH_WEB_CLIENT_ID");
  }
  const useProxy = false;

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "sublytics",
    path: "oauth2redirect/google",
  });
  

  console.log("REDIRECT URI:", redirectUri);

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_OAUTH_WEB_CLIENT_ID,
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
    useProxy,
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
      codeVerifier: request.codeVerifier,
      redirectUri,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "Backend exchange failed");
  return { ok: true, ...json };
}

export async function scanGmail() {
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
