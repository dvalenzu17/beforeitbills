import React from "react";
import { Alert, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { EMAIL_PROVIDERS } from "@/lib/emailImportClient";
import { connectGoogleGmail } from "@/lib/auth/googleGmailOAuth";
import { useEmailImportStore } from "@/lib/emailImportStore";
import { track } from "@/lib/analytics";

import Screen from "@/components/Screen";
import NavHeader from "@/components/NavHeader";
import Card from "@/components/Card";
import { useTheme } from "@/lib/theme";

export default function ConnectEmailProviderPicker() {
  const router = useRouter();
  const t = useTheme();
  const { t: tt } = useTranslation();
  const addAccount = useEmailImportStore((s) => s.addAccount);
  const resetFastPass = useEmailImportStore((s) => s.resetFastPass);

  async function onPick(key) {
    try {
      if (key === "gmail") {
        const result = await connectGoogleGmail();
        if (result?.ok) {
          resetFastPass?.();
          addAccount({ provider: "gmail", email: result?.email ?? null });
          track("gmail_connected", { provider: "gmail" });
          router.replace("/account/connect-email/connected");
        }
        return;
      }
      router.push(`/account/connect-email/verify?provider=${key}`);
    } catch (e) {
      if (__DEV__) console.warn('[connect-email] onPick failed:', e?.message || e);
      Alert.alert(tt("connect.errorTitle"), tt("connect.errorBody"));
    }
  }

  // "other" has its own dedicated button — filter it from the list to avoid showing it twice
  const providers = Object.entries(EMAIL_PROVIDERS).filter(([key]) => key !== "other");

  return (
    <Screen>
      <NavHeader
        title="Add account"
        subtitle="Choose your provider"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card style={{ padding: 0 }}>

          {providers.map(([key, meta], index) => (
            <Pressable
              key={key}
              onPress={() => onPick(key)}
              style={{
                paddingVertical: 18,
                paddingHorizontal: 18,
                borderBottomWidth: 1,
                borderColor: t.hairline,
              }}
            >
              <Text
                style={{
                  color: key === "gmail" ? t.accent : t.text,
                  fontWeight: "900",
                  fontSize: 18,
                }}
              >
                {meta.label}
              </Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => router.push("/account/connect-email/verify?provider=other")}
            style={{ paddingVertical: 18, paddingHorizontal: 18 }}
          >
            <Text style={{ color: t.accent, fontWeight: "900", fontSize: 16 }}>
              Add Other Account…
            </Text>
          </Pressable>

        </Card>
      </ScrollView>
    </Screen>
  );
}