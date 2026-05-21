import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EMAIL_PROVIDERS } from "@/lib/emailImportClient";
import { useEmailImportStore } from "@/lib/emailImportStore";
import { track } from "@/lib/analytics";
import { useTheme } from "@/lib/theme";

const PROVIDER_META = {
  gmail:   { icon: "G", bg: "#EA4335" },
  outlook: { icon: "O", bg: "#0078D4" },
  icloud:  { icon: "i", bg: "#0071E3" },
  yahoo:   { icon: "Y", bg: "#6001D2" },
  other:   { icon: "@", bg: "#555"    },
};

const PROVIDER_HELP = {
  gmail: {
    passwordLabel: "App Password",
    passwordHint:  "Must be a Google App Password — not your regular Google account password.",
    emailHint:     "Enter your full Gmail address (e.g. you@gmail.com)",
    helpUrl:       "https://myaccount.google.com/apppasswords",
    helpLabel:     "Generate an App Password at myaccount.google.com",
    placeholder:   "you@gmail.com",
  },
  icloud: {
    passwordLabel: "App-specific password",
    passwordHint:  "Must be an app-specific password, not your Apple ID password.",
    emailHint:     "Use your full iCloud address (e.g. you@icloud.com)",
    helpUrl:       "https://appleid.apple.com/account/manage",
    helpLabel:     "Generate one at appleid.apple.com",
    placeholder:   "you@icloud.com",
  },
  yahoo: {
    passwordLabel: "App password",
    passwordHint:  "Required when 2FA is on. Go to Yahoo Account Security.",
    emailHint:     "Enter your full Yahoo email address.",
    helpUrl:       "https://login.yahoo.com/account/security",
    helpLabel:     "Generate an app password in Yahoo Security settings",
    placeholder:   "you@yahoo.com",
  },
  outlook: {
    passwordLabel: "App password",
    passwordHint:  "Required if two-step verification is enabled on your account.",
    emailHint:     "Enter your full Outlook or Hotmail address.",
    helpUrl:       "https://account.microsoft.com/security",
    helpLabel:     "Generate an app password in Microsoft Security settings",
    placeholder:   "you@outlook.com",
  },
  other: {
    passwordLabel: "Password",
    passwordHint:  null,
    emailHint:     null,
    helpUrl:       null,
    helpLabel:     null,
    placeholder:   "you@example.com",
  },
};

export default function ConnectEmailVerify() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { provider } = useLocalSearchParams();

  const providerKey = String(provider);
  const preset      = useMemo(() => EMAIL_PROVIDERS[providerKey] || EMAIL_PROVIDERS.other, [providerKey]);
  const meta        = PROVIDER_META[providerKey] || PROVIDER_META.other;
  const help        = PROVIDER_HELP[providerKey] || PROVIDER_HELP.other;

  const verifyCredentials   = useEmailImportStore((x) => x.verifyCredentials);
  const addAccount          = useEmailImportStore((x) => x.addAccount);
  const saveImapCredentials = useEmailImportStore((x) => x.saveImapCredentials);
  const scanAccount         = useEmailImportStore((x) => x.scanAccount);
  const isLoading           = useEmailImportStore((x) => x.isLoading);
  const error               = useEmailImportStore((x) => x.error);
  const clearError          = useEmailImportStore((x) => x.clearError);

  const [email,        setEmail]        = useState("");
  const [pass,         setPass]         = useState("");
  const [showPass,     setShowPass]     = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [host,         setHost]         = useState(preset.imap?.host || "");
  const [port,         setPort]         = useState(String(preset.imap?.port || 993));

  const emailValid = email.includes("@") && email.includes(".");
  const passValid  = pass.length >= 4;
  const canSubmit  = emailValid && passValid && !isLoading;

  async function onVerifyAndScan() {
    clearError();
    track("email_connect_submit", { provider: providerKey });
    try {
      await verifyCredentials({ provider: providerKey, user: email.trim(), pass });
      const accountId = `${providerKey}:${email.trim()}`;
      addAccount({ provider: providerKey, email: email.trim() });
      await saveImapCredentials(accountId, email.trim(), pass);
      router.replace("/account/connect-email/connected");
      scanAccount(accountId, { user: email.trim(), pass, daysBack: 365, force: true }).catch((err) => {
        if (__DEV__) console.warn("[verify] post-connect scan failed:", err?.message);
      });
    } catch (e) {
      if (__DEV__) console.warn("[verify] credential check failed:", e?.message);
    }
  }

  const fieldBorder = (valid) => valid ? t.accent + "88" : t.hairline;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Back button */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, marginBottom: 8 }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: pressed ? t.surface2 : t.surface,
            borderWidth: 1, borderColor: t.hairline,
            alignItems: "center", justifyContent: "center",
          })}
        >
          <Feather name="arrow-left" size={18} color={t.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Provider banner */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          padding: 14, paddingHorizontal: 16,
          backgroundColor: t.surface, borderRadius: 16,
          borderWidth: 1, borderColor: t.hairline,
          marginBottom: 24,
        }}>
          <View style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: meta.bg,
            alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>{meta.icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "800", color: t.text }}>{preset.label}</Text>
            <Text style={{ fontSize: 11, fontWeight: "500", color: t.tertiary, marginTop: 2 }}>
              IMAP · port 993 · SSL/TLS
            </Text>
          </View>
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 4,
            backgroundColor: "#22C55E22",
            paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
          }}>
            <Feather name="lock" size={9} color="#22C55E" />
            <Text style={{ fontSize: 10, fontWeight: "900", color: "#22C55E", letterSpacing: 0.4 }}>SSL</Text>
          </View>
        </View>

        {/* Title */}
        <Text style={{ fontSize: 26, fontWeight: "900", color: t.text, letterSpacing: -0.8, marginBottom: 6 }}>
          Connect {preset.label}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "500", color: t.subtext, marginBottom: 24, lineHeight: 18 }}>
          Used only to detect subscription receipts. Read-only.
        </Text>

        {/* Email field */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 }}>
            Email address
          </Text>
          {help.emailHint && (
            <Text style={{ fontSize: 12, fontWeight: "500", color: t.subtext, marginBottom: 8, marginLeft: 2, lineHeight: 17 }}>
              {help.emailHint}
            </Text>
          )}
          <TextInput
            value={email}
            onChangeText={(v) => { clearError(); setEmail(v); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={help.placeholder || "you@example.com"}
            placeholderTextColor={t.tertiary}
            style={{
              padding: 14, paddingHorizontal: 16,
              borderRadius: 14,
              backgroundColor: t.surface,
              borderWidth: 1, borderColor: fieldBorder(emailValid),
              color: t.text, fontWeight: "700", fontSize: 15,
            }}
          />
        </View>

        {/* Password field */}
        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginLeft: 2 }}>
            {help.passwordLabel || "Password"}
          </Text>
          {help.passwordHint && (
            <Text style={{ fontSize: 12, fontWeight: "500", color: t.subtext, marginBottom: 8, marginLeft: 2, lineHeight: 17 }}>
              {help.passwordHint}
            </Text>
          )}
          <View>
            <TextInput
              value={pass}
              onChangeText={(v) => { clearError(); setPass(v); }}
              secureTextEntry={!showPass}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={help.passwordLabel || "Password"}
              placeholderTextColor={t.tertiary}
              style={{
                padding: 14, paddingHorizontal: 16, paddingRight: 52,
                borderRadius: 14,
                backgroundColor: t.surface,
                borderWidth: 1, borderColor: fieldBorder(passValid),
                color: t.text, fontWeight: "700", fontSize: 15,
              }}
            />
            <Pressable
              onPress={() => setShowPass((x) => !x)}
              hitSlop={10}
              style={{ position: "absolute", right: 6, top: 6, width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 10 }}
            >
              <Feather name={showPass ? "eye-off" : "eye"} size={18} color={t.tertiary} />
            </Pressable>
          </View>

          {/* Help link */}
          {help.helpUrl && (
            <Pressable
              onPress={() => Linking.openURL(help.helpUrl)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 9,
                marginTop: 10, padding: 12, borderRadius: 10,
                backgroundColor: t.accent + "14",
                borderWidth: 1, borderColor: t.accent + "33",
              }}
            >
              <Feather name="external-link" size={13} color={t.accent} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: t.accent, flex: 1 }}>{help.helpLabel}</Text>
            </Pressable>
          )}
        </View>

        {/* Advanced IMAP (other only) */}
        {providerKey === "other" && (
          <View style={{ marginBottom: 18 }}>
            <Pressable
              onPress={() => setShowAdvanced((s) => !s)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}
            >
              <Feather name={showAdvanced ? "chevron-down" : "chevron-right"} size={14} color={t.subtext} />
              <Text style={{ fontSize: 13, fontWeight: "700", color: t.subtext }}>IMAP server settings</Text>
            </Pressable>
            {showAdvanced && (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>IMAP host</Text>
                  <TextInput
                    value={host}
                    onChangeText={setHost}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="imap.example.com"
                    placeholderTextColor={t.tertiary}
                    style={{ padding: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline, color: t.text, fontWeight: "600", fontSize: 14 }}
                  />
                </View>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>Port</Text>
                  <TextInput
                    value={port}
                    onChangeText={setPort}
                    keyboardType="number-pad"
                    style={{ padding: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline, color: t.text, fontWeight: "600", fontSize: 14 }}
                  />
                </View>
              </View>
            )}
          </View>
        )}

        {/* Error */}
        {error ? (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", marginBottom: 16, padding: 12, backgroundColor: "#C43C3C18", borderRadius: 10, borderWidth: 1, borderColor: "#C43C3C44" }}>
            <Feather name="alert-circle" size={15} color="#C43C3C" style={{ marginTop: 1 }} />
            <Text style={{ color: "#C43C3C", fontSize: 14, flex: 1, fontWeight: "600" }}>{error}</Text>
          </View>
        ) : null}

        {/* CTA */}
        <Pressable
          onPress={canSubmit ? onVerifyAndScan : undefined}
          style={({ pressed }) => ({
            padding: 18, borderRadius: 18,
            backgroundColor: canSubmit
              ? pressed ? t.accent + "CC" : t.accent
              : t.surface2,
            alignItems: "center", justifyContent: "center",
            flexDirection: "row", gap: 10,
            opacity: !canSubmit ? 0.5 : 1,
            shadowColor: canSubmit ? t.accent : "transparent",
            shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
            elevation: canSubmit ? 6 : 0,
            marginBottom: 14,
          })}
        >
          <Feather name="zap" size={18} color={canSubmit ? "#fff" : t.tertiary} />
          <Text style={{ fontSize: 16, fontWeight: "800", color: canSubmit ? "#fff" : t.tertiary, letterSpacing: -0.2 }}>
            {isLoading ? "Connecting…" : "Connect & Scan"}
          </Text>
        </Pressable>

        {/* Encrypted note */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
          <Feather name="lock" size={11} color={t.tertiary} />
          <Text style={{ fontSize: 11, fontWeight: "600", color: t.tertiary, textAlign: "center" }}>
            Encrypted with TLS 1.3 — credentials never leave your device unencrypted.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}
