// app/auth/app-callback.js
// Handles Supabase PKCE callbacks for app authentication (OAuth + magic links).

import { useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { useStore } from "../../lib/store";
import { useAuthState } from "../../lib/authState";

export default function AppAuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const setUser = useStore((s) => s.setUser);
  const setAuthReady = useAuthState((s) => s.setReady);

  useEffect(() => {
    (async () => {
      try {
        await WebBrowser.dismissBrowser();
      } catch {}

      try {
        if (!SUPABASE_CONFIGURED || !supabase) {
          // No Supabase — gate will handle routing
          return;
        }

        const code = typeof params?.code === "string" ? params.code : null;
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          // Update store immediately so gate routes without waiting for onAuthStateChange
          const u = data?.session?.user ?? null;
          setUser(u);
          setAuthReady(true);
          // Gate in _layout.js handles navigation
        }
      } catch (e) {
        if (__DEV__) console.warn("[AppAuthCallback] failed:", e?.message || String(e));
        // Gate will redirect to sign-in since user will be null
      }
    })();
  }, [params]);

  return <View />;
}