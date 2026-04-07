// app/(onboarding)/privacy.js
import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { Screen, HeaderRow, MattePanel } from "../../components/_ui";

export default function Privacy() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("Privacy") || "Privacy"}
          subtitle={tt("Read-only access") || "Read-only access"}
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(onboarding)/expectations"))}
        />

        <View style={{ height: 14 }} />

        <MattePanel title={tt("What we do") || "What we do"} icon="shield">
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>
            {tt("You control your data") || "You control your data"}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 10, lineHeight: 19, fontWeight: "600" }}>
            {tt("We only scan for subscription signals. You can disconnect anytime.") ||
              "We only scan for subscription signals. You can disconnect anytime."}
          </Text>

          <View style={{ height: 12 }} />
          <Text style={{ color: t.subtext, fontWeight: "600", lineHeight: 19 }}>
            • Read-only scan{"\n"}• Proof for every detection{"\n"}• Disconnect anytime
          </Text>
        </MattePanel>

        <View style={{ marginTop: "auto" }}>
          <Button
            title={tt("Continue") || "Continue"}
            onPress={() => r.replace("/(onboarding)/connect")}
            left={<Feather name="arrow-right" size={16} color="#fff" />}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
