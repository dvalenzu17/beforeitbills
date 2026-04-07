import React from "react";
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useStore } from "../lib/store";
import { useAuthState } from "../lib/authState";
import { useTheme } from "../lib/theme";
import { SUPABASE_CONFIGURED } from "../lib/supabase";

export default function RootIndex() {
  const t = useTheme();
  const user = useStore((s) => s.user);

  const authReady = useAuthState((s) => s.authReady);
  const authBypass = useAuthState((s) => s.authBypass);

  // Wait for boot (bypass + session restore)
  if (!authReady) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  // If Supabase isn’t configured, just run local-first.
  if (!SUPABASE_CONFIGURED) return <Redirect href="/(tabs)" />;

  // Signed in OR explicitly bypassed → app
  if (user || authBypass) return <Redirect href="/(tabs)" />;

  // Otherwise → auth modal
  return <Redirect href="/(auth)/sign-in" />;
}
