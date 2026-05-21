// app/(onboarding)/notifications.js
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { setOnboardingDone } from "../../lib/onboardingGate";
import { ensureNotificationReady } from "../../lib/notifications";
import { Screen, HeaderRow, MattePanel } from "../../components/_ui";

export default function Notifications() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function allow() {
    setLoading(true);
    try {
      await ensureNotificationReady();
    } catch {
      // permission denied or unsupported - not fatal
    } finally {
      setLoading(false);
      await complete();
    }
  }

  async function complete() {
    await setOnboardingDone(true);
    // Gate in _layout.js navigates to /(tabs) when onboardingDone flips via USER_UPDATED
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("Notifications") || "Notifications"}
          subtitle={tt("Optional") || "Optional"}
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(onboarding)/goals"))}
        />

        <View style={{ height: 14 }} />

        <MattePanel title={tt("Stay ahead") || "Stay ahead"} icon="bell">
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>
            {tt("Get alerts") || "Get alerts"}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 10, lineHeight: 19, fontWeight: "600" }}>
            {tt("We can notify you about renewals, trials ending, and price changes.") ||
              "We can notify you about renewals, trials ending, and price changes."}
          </Text>

          <View style={{ height: 12 }} />
          <Text style={{ color: t.subtext, fontWeight: "600", lineHeight: 19 }}>
            • Renewals coming up{"\n"}• Trials ending{"\n"}• Price increases
          </Text>
        </MattePanel>

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title={loading ? "" : (tt("Enable notifications") || "Enable notifications")}
            onPress={allow}
            disabled={loading}
            left={
              loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="bell" size={16} color="#fff" />
              )
            }
          />
          <Button
            title={tt("Not now") || "Not now"}
            variant="ghost"
            onPress={complete}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}