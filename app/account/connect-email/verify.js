import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { EMAIL_PROVIDERS } from "@/lib/emailImportClient";
import { useEmailImportStore } from "@/lib/emailImportStore";
import { track } from "@/lib/analytics";

import Screen from "@/components/Screen";
import NavHeader from "@/components/NavHeader";
import Card from "@/components/Card";
import Button from "@/components/Button";
import { useTheme } from "@/lib/theme";

// Per-provider help links and hints
const PROVIDER_HELP = {
  icloud: {
    passwordLabel: "App-specific password",
    passwordHint:  "Must be an app-specific password, not your Apple ID password.",
    emailHint:     "Use your full iCloud address (e.g. you@icloud.com)",
    helpUrl:       "https://appleid.apple.com/account/manage",
    helpLabel:     "Generate an app-specific password at appleid.apple.com →",
  },
  yahoo: {
    passwordLabel: "App password",
    passwordHint:  "Generate one in Yahoo Account Security settings.",
    emailHint:     "Enter your full Yahoo email address.",
    helpUrl:       "https://login.yahoo.com/account/security",
    helpLabel:     "Generate an app password in Yahoo Security settings →",
  },
  outlook: {
    passwordLabel: "App password",
    passwordHint:  "Required if two-step verification is enabled on your account.",
    emailHint:     "Enter your full Outlook or Hotmail address.",
    helpUrl:       "https://account.microsoft.com/security",
    helpLabel:     "Generate an app password in Microsoft Security settings →",
  },
  other: {
    passwordLabel: "Password",
    passwordHint:  null,
    emailHint:     null,
    helpUrl:       null,
    helpLabel:     null,
  },
};

export default function ConnectEmailVerify() {
  const router = useRouter();
  const t = useTheme();
  const { provider } = useLocalSearchParams();

  const providerKey = String(provider);
  const preset = useMemo(() => EMAIL_PROVIDERS[providerKey] || EMAIL_PROVIDERS.other, [providerKey]);
  const help    = PROVIDER_HELP[providerKey] || PROVIDER_HELP.other;

  const verifyCredentials   = useEmailImportStore((x) => x.verifyCredentials);
  const addAccount          = useEmailImportStore((x) => x.addAccount);
  const saveImapCredentials = useEmailImportStore((x) => x.saveImapCredentials);
  const scanAccount         = useEmailImportStore((x) => x.scanAccount);
  const isLoading           = useEmailImportStore((x) => x.isLoading);
  const error               = useEmailImportStore((x) => x.error);
  const clearError          = useEmailImportStore((x) => x.clearError);

  const [email,       setEmail]       = useState("");
  const [pass,        setPass]        = useState("");
  const [host,        setHost]        = useState(preset.imap?.host || "");
  const [port,        setPort]        = useState(String(preset.imap?.port || 993));
  const [showPass,    setShowPass]    = useState(false);

  const canSubmit = email.trim().length > 0 && pass.length > 0 && !isLoading;

  async function onVerifyAndScan() {
    clearError();
    track("email_connect_submit", { provider: providerKey });

    try {
      await verifyCredentials({ provider: providerKey, user: email.trim(), pass });

      const accountId = `${providerKey}:${email.trim()}`;
      addAccount({ provider: providerKey, email: email.trim() });
      await saveImapCredentials(accountId, email.trim(), pass);

      router.replace("/account/connect-email/connected");

      scanAccount(accountId, { user: email.trim(), pass, daysBack: 365 }).catch((err) => {
        if (__DEV__) console.warn("[verify] post-connect scan failed:", err?.message);
      });
    } catch (e) {
      if (__DEV__) console.warn("[verify] credential check failed:", e?.message);
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
        <Card style={{ gap: 4 }}>

          {/* Email */}
          <Text style={labelStyle(t)}>Email address</Text>
          {help.emailHint && (
            <Text style={hintStyle(t)}>{help.emailHint}</Text>
          )}
          <TextInput
            value={email}
            onChangeText={(v) => { clearError(); setEmail(v); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={t.tertiary}
            style={[inputStyle(t), { marginTop: 6 }]}
          />

          {/* Password */}
          <Text style={[labelStyle(t), { marginTop: 16 }]}>{help.passwordLabel}</Text>
          {help.passwordHint && (
            <Text style={hintStyle(t)}>{help.passwordHint}</Text>
          )}
          <View style={{ marginTop: 6 }}>
            <TextInput
              value={pass}
              onChangeText={(v) => { clearError(); setPass(v); }}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={help.passwordLabel}
              placeholderTextColor={t.tertiary}
              style={inputStyle(t)}
            />
            <Pressable
              onPress={() => setShowPass((x) => !x)}
              hitSlop={10}
              style={{ position: "absolute", right: 14, top: 14 }}
            >
              <Feather
                name={showPass ? "eye-off" : "eye"}
                size={18}
                color={t.tertiary}
              />
            </Pressable>
          </View>

          {/* Help link */}
          {help.helpUrl && (
            <Pressable
              onPress={() => Linking.openURL(help.helpUrl)}
              style={{ marginTop: 10 }}
            >
              <Text style={{ color: t.accent, fontWeight: "700", fontSize: 13 }}>
                {help.helpLabel}
              </Text>
            </Pressable>
          )}

          {/* Custom IMAP fields */}
          {providerKey === "other" && (
            <>
              <Text style={[labelStyle(t), { marginTop: 16 }]}>IMAP host</Text>
              <TextInput
                value={host}
                onChangeText={setHost}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="imap.example.com"
                placeholderTextColor={t.tertiary}
                style={[inputStyle(t), { marginTop: 6 }]}
              />
              <Text style={[labelStyle(t), { marginTop: 12 }]}>Port</Text>
              <TextInput
                value={port}
                onChangeText={setPort}
                keyboardType="number-pad"
                style={[inputStyle(t), { marginTop: 6 }]}
              />
            </>
          )}

          {/* Error */}
          {error ? (
            <View style={{ marginTop: 12, flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <Feather name="alert-circle" size={15} color="#C43C3C" style={{ marginTop: 1 }} />
              <Text style={{ color: "#C43C3C", fontSize: 14, flex: 1, fontWeight: "600" }}>
                {error}
              </Text>
            </View>
          ) : null}

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

function labelStyle(t) {
  return { color: t.text, fontWeight: "900", fontSize: 15 };
}

function hintStyle(t) {
  return { color: t.tertiary, fontSize: 13, marginTop: 3, fontWeight: "500" };
}

function inputStyle(t) {
  return {
    padding: 14,
    borderRadius: 14,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.hairline,
    color: t.text,
    fontWeight: "700",
    fontSize: 15,
  };
}
