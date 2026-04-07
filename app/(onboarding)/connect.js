import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { Screen, HeaderRow, MattePanel } from "../../components/_ui";

export default function ConnectInbox() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  const goMailScan = () => r.push("/(onboarding)/scan-setup");
  const goManualAdd = () => r.push("/(onboarding)/done");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("connect.title")}
          subtitle={tt("connect.subtitle")}
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(onboarding)/expectations"))}
        />

        <View style={{ height: 14 }} />

        <MattePanel title={tt("connect.panelTitle")} icon="mail">
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>
            {tt("connect.heading")}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 10, lineHeight: 19, fontWeight: "600" }}>
            {tt("connect.body")}
          </Text>

          <View style={{ height: 12 }} />

          <Text style={{ color: t.subtext, fontWeight: "600", lineHeight: 19 }}>
            {"• "}{tt("connect.bullet1")}{"\n"}
            {"• "}{tt("connect.bullet2")}{"\n"}
            {"• "}{tt("connect.bullet3")}
          </Text>

          <View style={{ height: 14 }} />

          <Text style={{ color: t.tertiary, fontWeight: "600" }}>
            {tt("connect.footnote")}
          </Text>
        </MattePanel>

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title={tt("connect.ctaConnect")}
            onPress={goMailScan}
            left={<Feather name="mail" size={16} color="#fff" />}
          />
          <Button
            title={tt("connect.ctaManual")}
            variant="secondary"
            onPress={goManualAdd}
            left={<Feather name="plus" size={16} color={t.text} />}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}