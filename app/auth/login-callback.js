// app/auth/login-callback.js
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { useStore } from "../../lib/store";
import { useAuthState } from "../../lib/authState";
import { isOnboardingDone } from "../../lib/onboardingGate";
import { useTheme } from "../../lib/theme";

function getParam(url, key) {
  try {
    const parsed = Linking.parse(url);
    return parsed?.queryParams?.[key] ?? null;
  } catch {
    return null;
  }
}

export default function LoginCallback() {
  const t = useTheme();
  const r = useRouter();

  const setUser = useStore((s) => s.setUser);
  const setAuthReady = useAuthState((s) => s.setReady);
  const [status, setStatus] = useState("Finishing sign-in…");

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!SUPABASE_CONFIGURED || !supabase) {
          throw new Error("Sign-in isn't available in this build.");
        }

        const url = (await Linking.getInitialURL()) || "";
        if (!url) throw new Error("Missing callback URL.");

        const type = String(getParam(url, "type") || "").toLowerCase();

        setStatus("Securing session…");
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (error) throw error;

        // Password recovery — must set new password before entering app
        if (type === "recovery") {
          if (!mounted) return;
          r.replace("/auth/update-password");
          return;
        }

        // No session yet (email confirmation pending)
        if (!data?.session?.user) {
          if (!mounted) return;
          setStatus("Almost there…");
          Alert.alert(
            "Check your email",
            "Finish the confirmation step in your inbox, then come back and sign in.",
            [{ text: "Back to sign in", onPress: () => r.replace("/(auth)/sign-in") }],
            { cancelable: false }
          );
          return;
        }

        // Immediately update store so the gate routes correctly
        const u = data.session.user;
        setUser(u);
        setAuthReady(true);
        // Gate in _layout.js handles navigation
      } catch (e) {
        if (!mounted) return;

        setStatus("Sign-in failed");
        Alert.alert(
          "Couldn't finish sign-in",
          "Something went wrong. Please try signing in again.",
          [{ text: "Back", onPress: () => r.replace("/(auth)/sign-in") }],
          { cancelable: false }
        );
      }
    })();

    return () => { mounted = false; };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", padding: 18 }}>
      <ActivityIndicator />
      <Text style={{ color: t.subtext, marginTop: 12, fontWeight: "800" }}>{status}</Text>
    </View>
  );
}