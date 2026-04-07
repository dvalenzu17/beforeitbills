// app/(onboarding)/language.js
import React, { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { setAppLanguage, getAppLanguage } from "../../lib/i18n";
import { Screen, HeaderRow, MattePanel, Pill } from "../../components/_ui";

export default function Language() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  const initial = (typeof getAppLanguage === "function" ? getAppLanguage() : "en") || "en";
  const [lang, setLang] = useState(initial);

  async function apply(next) {
    setLang(next);
    await setAppLanguage?.(next);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("Language") || "Language"}
          subtitle={tt("Choose your default") || "Choose your default"}
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(onboarding)/expectations"))}
        />

        <View style={{ height: 14 }} />

        <MattePanel title={tt("App language") || "App language"} icon="globe">
          <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
            <Pill active={lang === "en"} label="English" onPress={() => apply("en")} />
            <Pill active={lang === "es"} label="Español" onPress={() => apply("es")} />
          </View>
        </MattePanel>

        <View style={{ marginTop: "auto" }}>
          <Button
            title={tt("Continue") || "Continue"}
            onPress={() => r.replace("/(onboarding)/expectations")}
            left={<Feather name="arrow-right" size={16} color="#fff" />}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}
