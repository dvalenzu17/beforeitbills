// app/callback.js
// OAuth deep-link landing route - hands off to Supabase session exchange.
import { useEffect } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase, SUPABASE_CONFIGURED } from "../lib/supabase";
import { useStore } from "../lib/store";
import { useAuthState } from "../lib/authState";

export default function Callback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const setUser = useStore((s) => s.setUser);
  const setAuthReady = useAuthState((s) => s.setReady);

  useEffect(() => {
    (async () => {
      try {
        const code = typeof params?.code === "string" ? params.code : null;
        if (code && SUPABASE_CONFIGURED && supabase) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error && data?.session?.user) {
            setUser(data.session.user);
            setAuthReady(true);
            return; // gate handles navigation
          }
        }
      } catch (e) {
        if (__DEV__) console.warn("[Callback] session exchange failed:", e?.message);
      }
      router.replace("/(auth)/sign-in");
    })();
  }, []);

  return <View />;
}