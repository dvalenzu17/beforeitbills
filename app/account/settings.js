import React, { useState, useEffect } from "react";
import { Pressable, ScrollView, Text, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import NavHeader from "../../components/NavHeader";
import { SPACING } from "../../lib/ui/tokens";
import { useTheme, useThemeSettings } from "../../lib/theme";
import { setAppLanguage, getAppLanguage } from "../../lib/i18n";
import { useStore } from "../../lib/store";
import { shortcutsAvailable } from "../../lib/shortcuts";

function Group({ t, children }) {
  return (
    <View
      style={{
        borderRadius: 18,
        overflow: "hidden",
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.hairline,
      }}
    >
      {children}
    </View>
  );
}

function Row({ t, title, subtitle, right, onPress, danger }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: t.hairline,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: danger ? "#ff3b30" : t.text,
              fontWeight: "800",
              fontSize: 16,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: t.subtext, marginTop: 3 }}>{subtitle}</Text>
          ) : null}
        </View>
        {right}
      </View>
    </Pressable>
  );
}

function Radio({ active, t }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: active ? t.accent : t.tertiary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {active && (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: 10,
            backgroundColor: t.accent,
          }}
        />
      )}
    </View>
  );
}

export default function SettingsScreen() {
  const r = useRouter();
  const t = useTheme();
  const { mode, setThemeMode } = useThemeSettings();
  const { t: tt } = useTranslation();
  const store = useStore();

  const [currentLang, setCurrentLang] = useState(
    () => (typeof getAppLanguage === "function" ? getAppLanguage() : "en") || "en"
  );

  useEffect(() => {
    const i18n = require("../../lib/i18n").default;
    const handler = (lng) => setCurrentLang(lng || "en");
    i18n.on("languageChanged", handler);
    return () => i18n.off("languageChanged", handler);
  }, []);

  async function rebuildSystem() {
    try {
      await store.syncNow?.({ source: "settings-rebuild" });
      Alert.alert("System refreshed", "Sync, reminders, and subscriptions were rebuilt.");
    } catch (e) {
      Alert.alert("Rebuild failed", e?.message || "Try again.");
    }
  }

  function resetLocalData() {
    Alert.alert(
      tt("settings.resetData"),
      "This clears subscriptions, reminders, and settings stored on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => store.resetStore?.(),
        },
      ]
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <NavHeader
        title={tt("settings.title")}
        onBack={() => r.canGoBack?.() ? r.back() : r.replace("/(tabs)/account")}
      />

      <ScrollView
        contentContainerStyle={{
          padding: SPACING.screen,
          gap: 24,
          paddingBottom: 32,
        }}
      >

        {/* APPEARANCE */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "800", marginBottom: 8, marginLeft: 4 }}>
            {tt("settings.sectionAppearance")}
          </Text>
          <Group t={t}>
            <Row
              t={t}
              title={tt("settings.automatic")}
              subtitle={tt("settings.automaticSub")}
              onPress={() => setThemeMode("system")}
              right={<Radio active={mode === "system"} t={t} />}
            />
            <Row
              t={t}
              title={tt("settings.light")}
              onPress={() => setThemeMode("light")}
              right={<Radio active={mode === "light"} t={t} />}
            />
            <Row
              t={t}
              title={tt("settings.dark")}
              onPress={() => setThemeMode("dark")}
              right={<Radio active={mode === "dark"} t={t} />}
            />
          </Group>
        </View>

        {/* LANGUAGE */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "800", marginBottom: 8, marginLeft: 4 }}>
            {tt("settings.sectionLanguage")}
          </Text>
          <Group t={t}>
            <Row
              t={t}
              title="English"
              onPress={() => setAppLanguage?.("en")}
              right={<Radio active={currentLang === "en"} t={t} />}
            />
            <Row
              t={t}
              title="Español"
              onPress={() => setAppLanguage?.("es")}
              right={<Radio active={currentLang === "es"} t={t} />}
            />
          </Group>
        </View>

        {/* SECURITY */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "800", marginBottom: 8, marginLeft: 4 }}>
            {tt("settings.sectionSecurity")}
          </Text>
          <Group t={t}>
            <Row
              t={t}
              title={tt("settings.biometricLock")}
              subtitle={tt("settings.biometricLockSub")}
              onPress={() => r.push("/account/biometric-lock")}
              right={<Text style={{ color: t.tertiary }}>›</Text>}
            />
          </Group>
        </View>

        {/* QUICK ACTIONS */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "800", marginBottom: 8, marginLeft: 4 }}>
            {tt("settings.sectionShortcuts")}
          </Text>
          <Group t={t}>
            <Row
              t={t}
              title={tt("settings.shortcutsTitle")}
              subtitle={shortcutsAvailable
                ? tt("settings.shortcutsAvailable")
                : tt("settings.shortcutsUnavailable")}
              right={
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: shortcutsAvailable ? "#34d399" : t.tertiary,
                  }}
                />
              }
            />
          </Group>
        </View>

        {/* DATA */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "800", marginBottom: 8, marginLeft: 4 }}>
            {tt("settings.sectionData")}
          </Text>
          <Group t={t}>
            <Row
              t={t}
              title={tt("settings.exportData")}
              subtitle={tt("settings.exportDataSub")}
              onPress={() => r.push("/account/export")}
              right={<Text style={{ color: t.tertiary }}>›</Text>}
            />
            <Row
              t={t}
              title={tt("settings.rebuildSystem")}
              subtitle={tt("settings.rebuildSystemSub")}
              onPress={rebuildSystem}
              right={<Text style={{ color: t.tertiary }}>›</Text>}
            />
          </Group>
        </View>

        {/* SUPPORT */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "800", marginBottom: 8, marginLeft: 4 }}>
            {tt("settings.sectionSupport")}
          </Text>
          <Group t={t}>
            <Row
              t={t}
              title={tt("settings.help")}
              subtitle={tt("settings.helpSub")}
              onPress={() => r.push("/account/help")}
              right={<Text style={{ color: t.tertiary }}>›</Text>}
            />
            <Row
              t={t}
              title={tt("settings.privacyTerms")}
              subtitle={tt("settings.privacyTermsSub")}
              onPress={() => r.push("/account/legals")}
              right={<Text style={{ color: t.tertiary }}>›</Text>}
            />
            <Row
              t={t}
              title={tt("settings.about")}
              subtitle={tt("settings.aboutSub")}
              onPress={() => r.push("/account/about")}
              right={<Text style={{ color: t.tertiary }}>›</Text>}
            />
          </Group>
        </View>

        {/* ADVANCED */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "800", marginBottom: 8, marginLeft: 4 }}>
            {tt("settings.sectionAdvanced")}
          </Text>
          <Group t={t}>
            <Row
              t={t}
              title={tt("settings.resetData")}
              subtitle={tt("settings.resetDataSub")}
              onPress={resetLocalData}
              danger
            />
          </Group>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}