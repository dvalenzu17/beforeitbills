import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { EMAIL_PROVIDERS } from "@/lib/emailImportClient";
import { useEmailImportStore } from "@/lib/emailImportStore";
import { track } from "@/lib/analytics";

import Screen from "@/components/Screen";
import NavHeader from "@/components/NavHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { useTheme } from "@/lib/theme";

export default function ConnectEmailVerify() {

  const router = useRouter();
  const t = useTheme();
  const { provider } = useLocalSearchParams();

  const providerKey = String(provider);

  const preset = useMemo(
    () => EMAIL_PROVIDERS[providerKey] || EMAIL_PROVIDERS.other,
    [providerKey]
  );

  const verifyCredentials = useEmailImportStore((x) => x.verifyCredentials);
  const addAccount = useEmailImportStore((x) => x.addAccount);
  const saveImapCredentials = useEmailImportStore((x) => x.saveImapCredentials);
  const scanAccount = useEmailImportStore((x) => x.scanAccount);
  const isLoading = useEmailImportStore((x) => x.isLoading);
  const error = useEmailImportStore((x) => x.error);
  const clearError = useEmailImportStore((x) => x.clearError);

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [host, setHost] = useState(preset.imap?.host || "");
  const [port, setPort] = useState(String(preset.imap?.port || 993));

  const canSubmit = email.trim().length > 0 && pass.length > 0 && !isLoading;

  async function onVerifyAndScan() {
    clearError();
    track("email_connect_submit", { provider: providerKey });

    try {
      await verifyCredentials({
        provider: providerKey,
        user: email.trim(),
        pass,
      });

      const accountId = `${providerKey}:${email.trim()}`;
      addAccount({ provider: providerKey, email: email.trim() });
      await saveImapCredentials(accountId, email.trim(), pass);

      router.replace("/account/connect-email/connected");

      scanAccount(accountId, {
        user: email.trim(),
        pass,
        daysBack: 365,
      }).catch((err) => {
        if (__DEV__) console.warn("[verify] post-connect scan failed:", err?.message);
      });

    } catch (e) {
      if (__DEV__) console.warn("[verify] credential check failed:", e?.message);
      // error is set on emailImportStore — displayed in the UI below
    }
  }

  function openHelp() {
    if (providerKey === "icloud") {
      Linking.openURL("https://appleid.apple.com");
    }
  }

  return (
    <Screen>

      <NavHeader
        title={`Connect ${preset.label}`}
        subtitle="Used to detect subscription receipts"
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>

        <Card>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            Email address
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@email.com"
            placeholderTextColor={t.tertiary}
            style={inputStyle(t)}
          />

          <Text
            style={{
              marginTop: 16,
              color: t.text,
              fontWeight: "900",
              fontSize: 16,
            }}
          >
            App password
          </Text>

          <TextInput
            value={pass}
            onChangeText={setPass}
            secureTextEntry
            placeholder="App-specific password"
            placeholderTextColor={t.tertiary}
            style={inputStyle(t)}
          />

          <Pressable
            onPress={openHelp}
            style={{ marginTop: 8 }}
          >
            <Text style={{ color: t.accent, fontWeight: "800" }}>
              How to generate an app password →
            </Text>
          </Pressable>

          {providerKey === "other" && (
            <>
              <Text style={{ marginTop: 16, color: t.text, fontWeight: "900" }}>
                IMAP host
              </Text>

              <TextInput
                value={host}
                onChangeText={setHost}
                style={inputStyle(t)}
              />

              <Text style={{ marginTop: 12, color: t.text, fontWeight: "900" }}>
                Port
              </Text>

              <TextInput
                value={port}
                onChangeText={setPort}
                keyboardType="number-pad"
                style={inputStyle(t)}
              />
            </>
          )}

          {error && (
            <Text style={{ color: "#C43C3C", marginTop: 10 }}>
              {error}
            </Text>
          )}

          <View style={{ height: 16 }} />

          <Button
            title={isLoading ? "Connecting…" : "Connect & Scan"}
            disabled={!canSubmit}
            onPress={onVerifyAndScan}
          />

        </Card>

      </ScrollView>

    </Screen>
  );
}

function inputStyle(t) {
  return {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.hairline,
    color: t.text,
    fontWeight: "800",
  };
}