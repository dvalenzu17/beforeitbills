import React, { useMemo, useEffect } from "react";
import { Alert, Text, View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../../lib/supabase";

import ScanProgressCard from "../../../components/ScanProgressCard";
import { useTheme } from "../../../lib/theme";
import { useToast } from "../../../components/ToastProvider";
import { useTranslation } from "react-i18next";
import { useEmailImportStore } from "../../../lib/emailImportStore";
import { timeAgo } from "../../../lib/timeAgo";

const PROVIDER_META = {
  gmail:   { label: "Gmail",        icon: "G", bg: "#EA4335" },
  yahoo:   { label: "Yahoo Mail",   icon: "Y", bg: "#6001D2" },
  outlook: { label: "Outlook",      icon: "O", bg: "#0078D4" },
  icloud:  { label: "iCloud Mail",  icon: "i", bg: "#0071E3" },
  other:   { label: "Email",        icon: "@", bg: "#555"    },
};

function AccountCard({ account, onScan, onDisconnect, onActivity, isLoading, t, tt }) {
  const meta = PROVIDER_META[account.provider] ?? PROVIDER_META.other;

  const lastScanText = useMemo(() => {
    if (!account.lastScanAt) return tt("mailScan.notYet");
    try { return timeAgo(account.lastScanAt) || tt("mailScan.notYet"); }
    catch { return tt("mailScan.notYet"); }
  }, [account.lastScanAt]);

  return (
    <View style={{
      backgroundColor: t.surface, borderRadius: 18,
      borderWidth: 1, borderColor: t.hairline, overflow: "hidden",
    }}>
      {/* Top row */}
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 42, height: 42, borderRadius: 12,
          backgroundColor: meta.bg,
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Text style={{ fontSize: 20, fontWeight: "900", color: "#fff" }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: t.text }}>{meta.label}</Text>
          {account.email ? (
            <Text style={{ fontSize: 12, fontWeight: "500", color: t.tertiary, marginTop: 1 }} numberOfLines={1}>
              {account.email}
            </Text>
          ) : null}
        </View>
        {/* Active badge */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 5,
          paddingHorizontal: 8, paddingVertical: 4,
          borderRadius: 99, backgroundColor: "#22C55E22",
          borderWidth: 1, borderColor: "#22C55E44",
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" }} />
          <Text style={{ fontSize: 10, fontWeight: "800", color: "#22C55E", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Active
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderTopWidth: 1, borderTopColor: t.hairline,
        flexDirection: "row", gap: 8,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>Last scan</Text>
          <Text style={{ fontSize: 14, fontWeight: "900", color: t.text, marginTop: 2 }}>{lastScanText}</Text>
        </View>
        <View style={{ width: 1, backgroundColor: t.hairline }} />
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={{ fontSize: 9, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>Connected</Text>
          <Text style={{ fontSize: 14, fontWeight: "900", color: t.text, marginTop: 2 }}>
            {account.connectedAt ? timeAgo(account.connectedAt) : "—"}
          </Text>
        </View>
      </View>

      {/* Mini actions */}
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: t.hairline }}>
        <Pressable
          onPress={() => onScan(account)}
          disabled={isLoading}
          style={({ pressed }) => ({
            flex: 1, paddingVertical: 12,
            alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
            backgroundColor: pressed ? t.surface2 : "transparent",
          })}
        >
          <Feather name="refresh-cw" size={13} color={t.accent} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: t.accent }}>
            {isLoading ? "Scanning…" : "Scan"}
          </Text>
        </Pressable>

        <View style={{ width: 1, backgroundColor: t.hairline }} />

        <Pressable
          onPress={() => onActivity(account)}
          style={({ pressed }) => ({
            flex: 1, paddingVertical: 12,
            alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
            backgroundColor: pressed ? t.surface2 : "transparent",
          })}
        >
          <Feather name="activity" size={13} color={t.subtext} />
          <Text style={{ fontSize: 13, fontWeight: "700", color: t.subtext }}>Activity</Text>
        </Pressable>

        <View style={{ width: 1, backgroundColor: t.hairline }} />

        <Pressable
          onPress={() => onDisconnect(account)}
          style={({ pressed }) => ({
            flex: 1, paddingVertical: 12,
            alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
            backgroundColor: pressed ? "#EF444410" : "transparent",
          })}
        >
          <Feather name="trash-2" size={13} color="#EF4444" />
          <Text style={{ fontSize: 13, fontWeight: "700", color: "#EF4444" }}>Remove</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ConnectedEmail() {
  const router = useRouter();
  const t = useTheme();
  const toast = useToast();
  const { t: tt } = useTranslation();
  const insets = useSafeAreaInsets();

  const hydrate           = useEmailImportStore((x) => x.hydrate);
  const removeAccount     = useEmailImportStore((x) => x.removeAccount);
  const clearImported     = useEmailImportStore((x) => x.clearImported);
  const runGmailFastPass  = useEmailImportStore((x) => x.runGmailFastPass);
  const scanAccount       = useEmailImportStore((x) => x.scanAccount);
  const scanAllAccounts   = useEmailImportStore((x) => x.scanAllAccounts);
  const connectedAccounts = useEmailImportStore((x) => x.connectedAccounts);
  const candidates        = useEmailImportStore((x) => x.candidates);
  const isLoading         = useEmailImportStore((x) => x.isLoading);
  const hasHydrated       = useEmailImportStore((x) => x.hasHydrated);
  const scanProgress      = useEmailImportStore((x) => x.scanProgress);
  const didFastPass       = useEmailImportStore((x) => x.didFastPass);

  const hasGmail = connectedAccounts?.some((a) => a.provider === "gmail") ?? false;

  // Sync on auth change
  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(() => { hydrate?.(); });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  // Redirect to picker when no accounts
  useEffect(() => {
    if (hasHydrated && connectedAccounts?.length === 0) {
      router.replace("/account/connect-email");
    }
  }, [hasHydrated, connectedAccounts?.length]);

  function handleScanError(err) {
    const code = err?.message;
    if (code === "gmail_auth_expired") {
      Alert.alert(
        tt("mailScan.gmailAuthExpiredTitle"),
        tt("mailScan.gmailAuthExpiredBody"),
        [
          { text: tt("common.cancel"), style: "cancel" },
          { text: tt("mailScan.gmailReconnect"), onPress: () => router.push("/account/connect-email/verify?provider=gmail") },
        ]
      );
      return;
    }
    if (code === "rate_limited") {
      toast.show({ message: tt("mailScan.scanRateLimited") }); return;
    }
    toast.show({ message: tt("mailScan.scanFailed") });
  }

  // Auto-scan Gmail on first connect
  useEffect(() => {
    if (!hasGmail || didFastPass) return;
    runGmailFastPass?.().catch(handleScanError);
  }, [hasGmail, didFastPass]);

  function onScan(account) {
    Alert.alert(tt("mailScan.scanHowFarTitle"), tt("mailScan.scanHowFarBody"), [
      { text: tt("mailScan.scan6m"), onPress: () => scanAccount(account.id, { daysBack: 180, force: true }).catch(handleScanError) },
      { text: tt("mailScan.scan1y"), onPress: () => scanAccount(account.id, { daysBack: 365, force: true }).catch(handleScanError) },
      { text: tt("mailScan.scan2y"), onPress: () => scanAccount(account.id, { daysBack: 730, force: true }).catch(handleScanError) },
      { text: tt("common.cancel"), style: "cancel" },
    ]);
  }

  function onScanAll() {
    Alert.alert(tt("mailScan.scanHowFarTitle"), tt("mailScan.scanHowFarBody"), [
      { text: tt("mailScan.scan6m"), onPress: () => scanAllAccounts({ daysBack: 180 }).catch(handleScanError) },
      { text: tt("mailScan.scan1y"), onPress: () => scanAllAccounts({ daysBack: 365 }).catch(handleScanError) },
      { text: tt("common.cancel"), style: "cancel" },
    ]);
  }

  function onDisconnect(account) {
    const label = PROVIDER_META[account.provider]?.label ?? "Email";
    Alert.alert(
      tt("mailScan.disconnectConfirmTitle", { provider: label }),
      tt("mailScan.disconnectConfirmBody"),
      [
        { text: tt("common.cancel"), style: "cancel" },
        { text: tt("mailScan.disconnect"), style: "destructive", onPress: async () => {
          await removeAccount(account.id);
          toast.show({ message: tt("mailScan.disconnected") });
        }},
      ]
    );
  }

  function onActivity(account) {
    router.push(`/account/connect-email/activity?accountId=${account.id}`);
  }

  // Latest scan across all accounts
  const lastScanAccount = connectedAccounts
    ?.filter((a) => a.lastScanAt)
    .sort((a, b) => new Date(b.lastScanAt) - new Date(a.lastScanAt))[0];

  const lastScanText = useMemo(() => {
    if (!lastScanAccount?.lastScanAt) return "Never";
    try { return timeAgo(lastScanAccount.lastScanAt) || "Never"; }
    catch { return "Never"; }
  }, [lastScanAccount?.lastScanAt]);

  if (!hasHydrated) {
    return <View style={{ flex: 1, backgroundColor: t.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Ambient glow */}
      <View style={{ position: "absolute", top: -80, right: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: t.accent, opacity: 0.07 }} pointerEvents="none" />

      {/* Header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 14 }}>
        <Pressable
          onPress={() => router.canGoBack?.() ? router.back() : router.replace("/(tabs)")}
          style={({ pressed }) => ({
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: pressed ? t.surface2 : t.surface,
            borderWidth: 1, borderColor: t.hairline,
            alignItems: "center", justifyContent: "center", marginBottom: 16,
          })}
        >
          <Feather name="arrow-left" size={18} color={t.text} />
        </Pressable>
        <Text style={{ fontSize: 28, fontWeight: "900", color: t.text, letterSpacing: -1 }}>
          Connected accounts
        </Text>
        <Text style={{ fontSize: 13, fontWeight: "500", color: t.subtext, marginTop: 4 }}>
          {connectedAccounts.length} active · {candidates?.length ?? 0} subscriptions detected
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

        {/* Scan progress */}
        {scanProgress ? <ScanProgressCard progress={scanProgress} /> : null}

        {/* Stats hero */}
        <View style={{
          padding: 18, borderRadius: 20,
          backgroundColor: t.accent + "14",
          borderWidth: 1, borderColor: t.accent + "33",
          flexDirection: "row", alignItems: "center", gap: 12,
          overflow: "hidden",
        }}>
          <View style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: t.accent, opacity: 0.12 }} pointerEvents="none" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: t.accent, textTransform: "uppercase", letterSpacing: 0.8 }}>Last scan</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.text, marginTop: 2 }}>{lastScanText}</Text>
          </View>
          <View style={{ width: 1, height: 32, backgroundColor: t.hairline }} />
          <View style={{ flex: 1, alignItems: "flex-end" }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: t.accent, textTransform: "uppercase", letterSpacing: 0.8 }}>Detected</Text>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.text, marginTop: 2 }}>
              {candidates?.length ?? 0} subs
            </Text>
          </View>
        </View>

        {/* Action row */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {candidates?.length > 0 ? (
            <Pressable
              onPress={() => router.push("/account/connect-email/review")}
              style={({ pressed }) => ({
                flex: 1, paddingVertical: 14, paddingHorizontal: 12,
                backgroundColor: pressed ? t.accent + "CC" : t.accent,
                borderRadius: 14, flexDirection: "row",
                alignItems: "center", justifyContent: "center", gap: 8,
                shadowColor: t.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              })}
            >
              <Feather name="inbox" size={16} color="#fff" />
              <Text style={{ fontSize: 14, fontWeight: "800", color: "#fff" }}>
                Review · {candidates.length}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={connectedAccounts.length > 1 ? onScanAll : () => connectedAccounts[0] && onScan(connectedAccounts[0])}
            disabled={isLoading}
            style={({ pressed }) => ({
              flex: candidates?.length > 0 ? 0 : 1,
              paddingVertical: 14, paddingHorizontal: 16,
              backgroundColor: pressed ? t.surface2 : t.surface,
              borderWidth: 1, borderColor: t.hairline,
              borderRadius: 14, flexDirection: "row",
              alignItems: "center", justifyContent: "center", gap: 8,
            })}
          >
            <Feather name="refresh-cw" size={16} color={isLoading ? t.tertiary : t.text} />
            <Text style={{ fontSize: 14, fontWeight: "800", color: isLoading ? t.tertiary : t.text }}>
              {isLoading ? "Scanning…" : "Scan"}
            </Text>
          </Pressable>
        </View>

        {/* Account cards */}
        {connectedAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onScan={onScan}
            onDisconnect={onDisconnect}
            onActivity={onActivity}
            isLoading={isLoading}
            t={t}
            tt={tt}
          />
        ))}

        {/* Add another account */}
        <Pressable
          onPress={() => router.push("/account/connect-email")}
          style={({ pressed }) => ({
            paddingVertical: 14, paddingHorizontal: 16,
            borderRadius: 14, borderWidth: 1, borderColor: t.hairline,
            borderStyle: "dashed",
            backgroundColor: pressed ? t.surface : "transparent",
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          })}
        >
          <Feather name="plus" size={16} color={t.accent} />
          <Text style={{ fontSize: 14, fontWeight: "800", color: t.accent }}>
            Add another account
          </Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}
