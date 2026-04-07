import React from "react";
import {
  Alert,
  Share,
  View,
  Text,
  TouchableOpacity,
  ScrollView
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Screen from "../../components/Screen";
import Glass from "../../components/Glass";
import Button from "../../components/Button";
import NavHeader from "../../components/NavHeader";

import { useTranslation } from "react-i18next";
import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";

export default function Help() {

  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();
  const store = useStore();

  const { user, subs = [], bills = [], syncMeta } = store;

  async function sendFeedback() {

    const msg =
      `BeforeItBills feedback\n\n` +
      `Describe what happened:\n\n` +
      `----\n\n` +
      `Diagnostics\n` +
      `User: ${user?.email || "local-only"}\n` +
      `Subscriptions: ${subs.length}\n` +
      `Bills: ${bills.length}\n` +
      `Last sync: ${syncMeta?.lastSyncedAt || "never"}\n` +
      `Timestamp: ${new Date().toISOString()}\n`;

    await Share.share({ message: msg });

  }

  function faq(title, body) {
    Alert.alert(title, body);
  }

  function runDiagnostics() {

    const report =
      `System diagnostics\n\n` +
      `User: ${user?.email || "local-only"}\n` +
      `Subscriptions: ${subs.length}\n` +
      `Bills: ${bills.length}\n` +
      `Last sync: ${syncMeta?.lastSyncedAt || "never"}\n`;

    Alert.alert(tt("help.diagnosticsTitle"), report);

  }

  async function rebuildSystem() {

    try {

      await store.syncNow?.({ source: "help-rebuild" });

      Alert.alert(tt("help.refreshedTitle"), tt("help.refreshedBody"));

    } catch (e) {

      if (__DEV__) console.warn('[help] rebuildSystem failed:', e?.message);
      Alert.alert(tt("help.rebuildFailedTitle"), tt("help.rebuildFailedBody"));

    }

  }

  function Card({ title, subtitle, icon, onPress }) {

    return (

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={{
          backgroundColor: t.surface2 || "transparent",
          borderRadius: 18,
          borderWidth: 1,
          borderColor: t.hairline,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
        }}
      >

        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.surface2 || t.surface,
            borderWidth: 1,
            borderColor: t.hairline
          }}
        >
          <Feather name={icon} size={18} color={t.text} />
        </View>

        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }}>
            {title}
          </Text>

          {subtitle && (
            <Text style={{ color: t.subtext, marginTop: 2 }}>
              {subtitle}
            </Text>
          )}
        </View>

        <Feather name="chevron-right" size={18} color={t.subtext} />

      </TouchableOpacity>

    );

  }

  return (

    <Screen>

      <NavHeader
        title={tt("help.title")}
        subtitle={tt("help.subtitle")}
        onBack={() => {
          if (r.canGoBack()) r.back();
          else r.replace("/(tabs)/account");
        }}
      />

      <ScrollView
        contentContainerStyle={{
          padding: 18,
          paddingBottom: 40,
          gap: 14
        }}
      >

        {/* FAQ */}

        <Glass>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            {tt("help.quickAnswers")}
          </Text>

          <View style={{ marginTop: 12, gap: 10 }}>

            <Card
              icon="mail"
              title={tt("help.faq1Title")}
              subtitle={tt("help.faq1Sub")}
              onPress={() => faq(tt("help.faq1Title"), tt("help.faq1Body"))}
            />

            <Card
              icon="bell"
              title={tt("help.faq2Title")}
              subtitle={tt("help.faq2Sub")}
              onPress={() => faq(tt("help.faq2Title"), tt("help.faq2Body"))}
            />

            <Card
              icon="download"
              title={tt("help.faq3Title")}
              subtitle={tt("help.faq3Sub")}
              onPress={() => faq(tt("help.faq3Title"), tt("help.faq3Body"))}
            />

          </View>

        </Glass>

        {/* TROUBLESHOOT */}

        <Glass>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            {tt("help.troubleshooting")}
          </Text>

          <View style={{ marginTop: 12, gap: 10 }}>

            <Card
              icon="tool"
              title={tt("help.diagCardTitle")}
              subtitle={tt("help.diagCardSub")}
              onPress={runDiagnostics}
            />

            <Card
              icon="refresh-cw"
              title={tt("help.rebuildCardTitle")}
              subtitle={tt("help.rebuildCardSub")}
              onPress={rebuildSystem}
            />

          </View>

        </Glass>

        {/* CONTACT */}

        <Glass>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            {tt("help.contact")}
          </Text>

          <Text
            style={{
              color: t.subtext,
              marginTop: 6,
              lineHeight: 18
            }}
          >
            {tt("help.contactBody")}
          </Text>

          <View style={{ marginTop: 14 }}>

            <Button
              title={tt("help.sendFeedback")}
              onPress={sendFeedback}
              left={<Feather name="send" size={16} color="#0B0B10" />}
            />

          </View>

        </Glass>

      </ScrollView>

    </Screen>

  );

}