// app/(onboarding)/scan.js
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { useOnboardingStore } from "../../lib/onboardingStore";
import { Screen, HeaderRow, MattePanel } from "../../components/_ui";

export default function OnboardingScan() {
  const t = useTheme();
  const r = useRouter();
  const markStep = useOnboardingStore((s) => s.markStep);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow title="Scan inbox" subtitle="Find recurring charges" onBack={() => r.back()} />

        <View style={{ height: 14 }} />

        <MattePanel title="Scan" icon="search">
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>Let’s scan your inbox</Text>
          <Text style={{ color: t.subtext, marginTop: 10, lineHeight: 19, fontWeight: "600" }}>
            You’ll see live progress and detections. Every item has proof.
          </Text>
        </MattePanel>

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title="Start scan"
            onPress={() => {
              markStep?.("scan");
              r.push("/(onboarding)/scan-setup");
            }}
            left={<Feather name="arrow-right" size={16} color="#fff" />}
          />
          <Button title="Skip" variant="ghost" onPress={() => r.replace("/(onboarding)/done")} />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
