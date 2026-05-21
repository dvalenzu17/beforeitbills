import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, Animated } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EMAIL_PROVIDERS } from "@/lib/emailImportClient";
import { useTheme } from "@/lib/theme";

const PROVIDER_META = {
  gmail:   { icon: "G", bg: "#EA4335", desc: "App Password · imap.gmail.com" },
  outlook: { icon: "O", bg: "#0078D4", desc: "Microsoft 365, Hotmail, Live" },
  icloud:  { icon: "i", bg: "#0071E3", desc: "@icloud.com · @me.com · @mac.com" },
  yahoo:   { icon: "Y", bg: "#6001D2", desc: "Yahoo, AOL, Verizon" },
};

const TRUST_ROWS = [
  { icon: "shield", label: "Read-only access",    sub: "We never send, delete, or modify mail." },
  { icon: "lock",   label: "Encrypted in transit", sub: "TLS 1.3 + AES-256. Always." },
  { icon: "trash-2",label: "Disconnect anytime",   sub: "One tap removes all data we cached." },
];

const MAIN_PROVIDERS = ["gmail", "outlook", "icloud", "yahoo"];

export default function ConnectEmailProviderPicker() {
  const router = useRouter();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(24)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0,   duration: 420, useNativeDriver: true }),
      Animated.timing(fadeAnim,  { toValue: 1,   duration: 380, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Ambient glows */}
      <View style={{ position: "absolute", top: -80, right: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: t.accent, opacity: 0.08 }} pointerEvents="none" />
      <View style={{ position: "absolute", bottom: -100, left: -60, width: 240, height: 240, borderRadius: 120, backgroundColor: t.accent2 ?? t.accent, opacity: 0.06 }} pointerEvents="none" />

      {/* Back button */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20 }}>
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

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }], marginBottom: 28 }}>
          {/* Mail icon */}
          <View style={{ position: "relative", width: 68, height: 68, marginBottom: 18 }}>
            <View style={{
              position: "absolute", inset: -8, borderRadius: 22,
              backgroundColor: t.accent, opacity: 0.15,
            }} />
            <View style={{
              width: 68, height: 68, borderRadius: 18,
              backgroundColor: t.accent,
              alignItems: "center", justifyContent: "center",
              shadowColor: t.accent, shadowOpacity: 0.45,
              shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
              elevation: 8,
            }}>
              <Feather name="mail" size={30} color="#fff" />
            </View>
          </View>

          <Text style={{ fontSize: 30, fontWeight: "900", color: t.text, letterSpacing: -1, lineHeight: 34, marginBottom: 10 }}>
            Find your{"\n"}subscriptions in{"\n"}
            <Text style={{ color: t.accent }}>2 minutes</Text>.
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "600", color: t.subtext, lineHeight: 20 }}>
            We scan receipts in your inbox to detect every recurring charge. Read-only, encrypted, never stored.
          </Text>
        </Animated.View>

        {/* Provider list */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={{ fontSize: 11, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, marginLeft: 4 }}>
            Choose your provider
          </Text>

          <View style={{ backgroundColor: t.surface, borderRadius: 18, borderWidth: 1, borderColor: t.hairline, overflow: "hidden", marginBottom: 12 }}>
            {MAIN_PROVIDERS.map((key, i) => {
              const meta = PROVIDER_META[key];
              const provider = EMAIL_PROVIDERS[key];
              if (!meta || !provider) return null;
              return (
                <Pressable
                  key={key}
                  onPress={() => router.push(`/account/connect-email/verify?provider=${key}`)}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", gap: 14,
                    padding: 14, paddingHorizontal: 16,
                    backgroundColor: pressed ? t.surface2 : "transparent",
                    borderBottomWidth: i < MAIN_PROVIDERS.length - 1 ? 1 : 0,
                    borderBottomColor: t.hairline,
                  })}
                >
                  {/* Brand icon */}
                  <View style={{
                    width: 40, height: 40, borderRadius: 11,
                    backgroundColor: meta.bg,
                    alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Text style={{ fontSize: 18, fontWeight: "900", color: "#fff" }}>{meta.icon}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: "800", color: t.text }}>{provider.label}</Text>
                    <Text style={{ fontSize: 11, fontWeight: "500", color: t.tertiary, marginTop: 2 }}>{meta.desc}</Text>
                  </View>

                  <Feather name="chevron-right" size={18} color={t.tertiary} />
                </Pressable>
              );
            })}
          </View>

          {/* Custom IMAP */}
          <Pressable
            onPress={() => router.push("/account/connect-email/verify?provider=other")}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 12,
              padding: 14, paddingHorizontal: 16,
              borderRadius: 14,
              borderWidth: 1, borderColor: t.hairline, borderStyle: "dashed",
              backgroundColor: pressed ? t.surface : "transparent",
              marginBottom: 24,
            })}
          >
            <Feather name="plus" size={18} color={t.accent} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: t.text }}>Custom IMAP server</Text>
              <Text style={{ fontSize: 11, fontWeight: "500", color: t.tertiary, marginTop: 2 }}>Fastmail, Proton, self-hosted…</Text>
            </View>
          </Pressable>

          {/* Trust strip */}
          <View style={{
            backgroundColor: t.surface, borderRadius: 16,
            borderWidth: 1, borderColor: t.hairline,
            padding: 16, gap: 12,
          }}>
            {TRUST_ROWS.map((row, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
                <View style={{
                  width: 26, height: 26, borderRadius: 7,
                  backgroundColor: t.accent + "22",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0, marginTop: 1,
                }}>
                  <Feather name={row.icon} size={13} color={t.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: t.text }}>{row.label}</Text>
                  <Text style={{ fontSize: 11, fontWeight: "500", color: t.tertiary, marginTop: 2 }}>{row.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
