import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { setOnboardingDone } from "../../lib/onboardingGate";
import { track } from "../../lib/analytics";
import { Screen, HeaderRow, MattePanel } from "../../components/_ui";

export default function Done() {
  const t = useTheme();
  const r = useRouter();
  const [loading, setLoading] = useState(false);

  async function goManual() {
    setLoading(true);
    try {
      await setOnboardingDone(true);
    } catch {
      // Local AsyncStorage write failed — navigate anyway, Supabase will retry on next boot
    } finally {
      setLoading(false);
    }
    track("onboarding_completed", { method: "manual" });
    r.replace("/add-recurring");
  }

  async function goScan() {
    r.replace("/account/connect-email");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title="Add manually"
          subtitle="Enter your own subscriptions"
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/account/connect-email"))}
        />

        <View style={{ height: 14 }} />

        <MattePanel title="No inbox needed" icon="plus-circle">
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>
            Track anything you like
          </Text>
          <Text style={{ color: t.subtext, marginTop: 10, lineHeight: 19, fontWeight: "600" }}>
            Add subscriptions by name, amount, and billing date. You stay in full control of what's tracked.
          </Text>

          <View style={{ height: 12 }} />

          <Text style={{ color: t.subtext, fontWeight: "600", lineHeight: 19 }}>
            • Netflix, Spotify, Adobe - anything{"\n"}
            • Set the amount and billing cadence{"\n"}
            • You can always connect your inbox later
          </Text>
        </MattePanel>

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title={loading ? "Setting up…" : "Add my first subscription"}
            onPress={goManual}
            disabled={loading}
            haptic="impactLight"
            left={<Feather name="plus" size={16} color="#fff" />}
          />
          <Button
            title="Connect inbox instead"
            variant="secondary"
            onPress={goScan}
            left={<Feather name="mail" size={16} color={t.text} />}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}