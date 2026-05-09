import React, { useMemo, useEffect } from "react";
import { Alert, Text, View, Pressable, Linking } from "react-native";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../../lib/supabase";

import Screen from "../../../components/Screen";
import NavHeader from "../../../components/NavHeader";
import Card from "../../../components/Card";
import Button from "../../../components/Button";
import ScanProgressCard from "../../../components/ScanProgressCard";

import { useTheme } from "../../../lib/theme";
import { useToast } from "../../../components/ToastProvider";
import { useTranslation } from "react-i18next";
import { useEmailImportStore } from "../../../lib/emailImportStore";
import { connectGoogleGmail } from "../../../lib/auth/googleGmailOAuth";
import { timeAgo } from "../../../lib/timeAgo";
import { track } from "../../../lib/analytics";

const PROVIDER_LABELS = {
  gmail: "Gmail",
  yahoo: "Yahoo Mail",
  outlook: "Outlook",
  icloud: "iCloud Mail",
  other: "Email",
};

function AccountCard({ account, onScan, onDisconnect, isLoading, t, tt }) {
  const label = PROVIDER_LABELS[account.provider] ?? "Email";
  const isGmail = account.provider === "gmail";

  const lastScanText = useMemo(() => {
    if (!account.lastScanAt) return tt("mailScan.notYet");
    try {
      return timeAgo(account.lastScanAt) || tt("mailScan.notYet");
    } catch {
      return tt("mailScan.notYet");
    }
  }, [account.lastScanAt]);

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>{label}</Text>
          {account.email ? (
            <Text style={{ color: t.subtext, marginTop: 2, fontSize: 13 }}>{account.email}</Text>
          ) : null}
        </View>

        {isGmail ? (
          <Pressable
            onPress={() => Linking.openURL("https://myaccount.google.com/permissions")}
            accessibilityRole="link"
            accessibilityLabel={tt("mailScan.manageGoogle")}
          >
            <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "700" }}>Permissions →</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ height: 10 }} />

      <Text style={{ color: t.subtext, fontSize: 12 }}>{tt("mailScan.lastScan")}</Text>
      <Text style={{ color: t.text, fontWeight: "900", marginTop: 2 }}>{lastScanText}</Text>

      <View style={{ height: 14 }} />

      <Button
        title={isLoading ? tt("mailScan.scanning") : tt("mailScan.scanInbox")}
        onPress={() => onScan(account)}
        disabled={isLoading}
      />

      <View style={{ height: 8 }} />

      <Button
        title={tt("mailScan.disconnect")}
        variant="danger"
        onPress={() => onDisconnect(account)}
        disabled={isLoading}
      />
    </Card>
  );
}

export default function ConnectedEmail() {
  const router = useRouter();
  const t = useTheme();
  const toast = useToast();
  const { t: tt } = useTranslation();

  const hydrate          = useEmailImportStore((x) => x.hydrate);
  const addAccount       = useEmailImportStore((x) => x.addAccount);
  const removeAccount    = useEmailImportStore((x) => x.removeAccount);
  const clearImported    = useEmailImportStore((x) => x.clearImported);
  const runGmailFastPass = useEmailImportStore((x) => x.runGmailFastPass);
  const scanAccount      = useEmailImportStore((x) => x.scanAccount);
  const scanAllAccounts  = useEmailImportStore((x) => x.scanAllAccounts);
  const connectedAccounts = useEmailImportStore((x) => x.connectedAccounts);
  const candidates       = useEmailImportStore((x) => x.candidates);
  const isLoading        = useEmailImportStore((x) => x.isLoading);
  const hasHydrated      = useEmailImportStore((x) => x.hasHydrated);
  const scanProgress     = useEmailImportStore((x) => x.scanProgress);
  const didFastPass      = useEmailImportStore((x) => x.didFastPass);
  const resetFastPass    = useEmailImportStore((x) => x.resetFastPass);

  const hasGmail = connectedAccounts?.some((a) => a.provider === "gmail") ?? false;

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(() => {
      hydrate?.();
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  // Auto-scan Gmail on first connect (FastPass)
  useEffect(() => {
    if (!hasGmail) return;
    if (didFastPass) return;
    runGmailFastPass?.().catch((err) => {
      if (__DEV__) console.warn("[FastPass] scan failed:", err?.message);
      toast.show({ message: __DEV__ ? (err?.message || "Scan failed") : tt("mailScan.scanFailed") });
    });
  }, [hasGmail, didFastPass]);

  function onScan(account) {
    Alert.alert(
      tt("mailScan.scanHowFarTitle"),
      tt("mailScan.scanHowFarBody"),
      [
        {
          text: tt("mailScan.scan6m"),
          onPress: () => scanAccount(account.id, { daysBack: 180, force: true }).catch((e) => {
            if (__DEV__) console.warn("[connected] scan failed:", e?.message);
          }),
        },
        {
          text: tt("mailScan.scan1y"),
          onPress: () => scanAccount(account.id, { daysBack: 365, force: true }).catch((e) => {
            if (__DEV__) console.warn("[connected] scan failed:", e?.message);
          }),
        },
        {
          text: tt("mailScan.scan2y"),
          onPress: () => scanAccount(account.id, { daysBack: 730, force: true }).catch((e) => {
            if (__DEV__) console.warn("[connected] scan failed:", e?.message);
          }),
        },
        { text: tt("common.cancel"), style: "cancel" },
      ]
    );
  }

  function onScanAll() {
    Alert.alert(
      tt("mailScan.scanHowFarTitle"),
      tt("mailScan.scanHowFarBody"),
      [
        {
          text: tt("mailScan.scan6m"),
          onPress: () => scanAllAccounts({ daysBack: 180 }).catch((e) => {
            if (__DEV__) console.warn("[connected] scanAll failed:", e?.message);
          }),
        },
        {
          text: tt("mailScan.scan1y"),
          onPress: () => scanAllAccounts({ daysBack: 365 }).catch((e) => {
            if (__DEV__) console.warn("[connected] scanAll failed:", e?.message);
          }),
        },
        { text: tt("common.cancel"), style: "cancel" },
      ]
    );
  }

  function onDisconnect(account) {
    const label = PROVIDER_LABELS[account.provider] ?? "Email";
    Alert.alert(
      tt("mailScan.disconnectConfirmTitle", { provider: label }),
      tt("mailScan.disconnectConfirmBody"),
      [
        { text: tt("common.cancel"), style: "cancel" },
        {
          text: tt("mailScan.disconnect"),
          style: "destructive",
          onPress: async () => {
            await removeAccount(account.id);
            toast.show({ message: tt("mailScan.disconnected") });
          },
        },
      ]
    );
  }

  function onClear() {
    Alert.alert(
      tt("mailScan.clearConfirmTitle"),
      tt("mailScan.clearConfirmBody"),
      [
        { text: tt("common.cancel"), style: "cancel" },
        {
          text: tt("mailScan.clearResults"),
          style: "destructive",
          onPress: async () => {
            await clearImported();
            toast.show({ message: tt("mailScan.resultsCleared") });
          },
        },
      ]
    );
  }

  async function onConnectGmail() {
    try {
      const result = await connectGoogleGmail();
      if (result?.ok) {
        resetFastPass?.();
        addAccount({ provider: "gmail", email: result?.email ?? null });
        track("gmail_connected", { provider: "gmail" });
        toast.show({ message: tt("mailScan.gmailConnecting") });
      }
    } catch (e) {
      if (__DEV__) console.warn("[connected] gmail connect failed:", e?.message);
      if (e?.message !== "not_authenticated") {
        toast.show({ message: tt("connect.gmailConnectFailed") });
      }
    }
  }

  if (!hasHydrated) {
    return (
      <Screen>
        <NavHeader
          title={tt("mailScan.title")}
          onBack={() =>
            router.canGoBack?.() ? router.back() : router.replace("/(tabs)")
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <NavHeader
        title={tt("mailScan.title")}
        subtitle={tt("mailScan.subtitle")}
        onBack={() =>
          router.canGoBack?.() ? router.back() : router.replace("/(tabs)")
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>

        {scanProgress ? <ScanProgressCard progress={scanProgress} /> : null}

        {/* Connected accounts */}
        {connectedAccounts.map((account) => (
          <AccountCard
            key={account.id}
            account={account}
            onScan={onScan}
            onDisconnect={onDisconnect}
            isLoading={isLoading}
            t={t}
            tt={tt}
          />
        ))}

        {/* Scan all - only shown when multiple accounts */}
        {connectedAccounts.length > 1 ? (
          <Button
            title={tt("mailScan.scanAll")}
            onPress={onScanAll}
            disabled={isLoading}
          />
        ) : null}

        {/* Add another account */}
        {connectedAccounts.length > 0 ? (
          <Pressable
            onPress={() => router.push("/account/connect-email")}
            style={{ paddingVertical: 14, alignItems: "center" }}
            accessibilityRole="button"
            accessibilityLabel={tt("mailScan.addAccount")}
          >
            <Text style={{ color: t.accent, fontWeight: "800", fontSize: 16 }}>
              + {tt("mailScan.addAccount")}
            </Text>
          </Pressable>
        ) : null}

        {/* No accounts: show connect options */}
        {connectedAccounts.length === 0 ? (
          <Card>
            <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
              {tt("mailScan.noAccounts")}
            </Text>

            <View style={{ height: 12 }} />

            <Button
              title={tt("mailScan.connectGmail")}
              onPress={onConnectGmail}
            />

            <Pressable
              onPress={() => router.push("/account/connect-email")}
              style={{ marginTop: 12, alignItems: "center" }}
              accessibilityRole="button"
            >
              <Text style={{ color: t.accent, fontWeight: "800" }}>
                {tt("mailScan.otherProvider")}
              </Text>
            </Pressable>
          </Card>
        ) : null}

        {/* Review detected subscriptions */}
        {candidates?.length ? (
          <Pressable
            onPress={() => router.push("/account/connect-email/review")}
            style={{ paddingVertical: 10, alignItems: "center" }}
            accessibilityRole="button"
            accessibilityLabel={tt("mailScan.reviewDetected", { count: candidates.length })}
          >
            <Text style={{ color: t.accent, fontWeight: "800" }}>
              {tt("mailScan.reviewDetected", { count: candidates.length })}
            </Text>
          </Pressable>
        ) : null}

        {/* Clear results */}
        {connectedAccounts.length > 0 && candidates?.length ? (
          <Card>
            <Button
              title={tt("mailScan.clearResults")}
              variant="secondary"
              onPress={onClear}
              disabled={isLoading}
            />
          </Card>
        ) : null}

      </ScrollView>
    </Screen>
  );
}
