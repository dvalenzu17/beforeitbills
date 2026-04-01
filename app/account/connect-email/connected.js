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
import { useEmailImportStore } from "../../../lib/emailImportStore";
import { connectGoogleGmail } from "../../../lib/auth/googleGmailOAuth";
import { EMAIL_PROVIDERS } from "../../../lib/emailImportClient";
import { timeAgo } from "../../../lib/timeAgo";
import { track } from "../../../lib/analytics";

const PROVIDER_LABELS = {
  gmail: "Gmail",
  yahoo: "Yahoo Mail",
  outlook: "Outlook",
  icloud: "iCloud Mail",
  other: "Email",
};

export default function ConnectedEmail() {
  const router = useRouter();
  const t = useTheme();
  const toast = useToast();

  const hydrate = useEmailImportStore((x) => x.hydrate);
  const disconnect = useEmailImportStore((x) => x.disconnect);
  const clearImported = useEmailImportStore((x) => x.clearImported);
  const runGmailFastPass = useEmailImportStore((x) => x.runGmailFastPass);
  const runScan = useEmailImportStore((x) => x.runScan);
  const connectedProvider = useEmailImportStore((x) => x.connectedProvider);
  const connectedEmail = useEmailImportStore((x) => x.connectedEmail);
  const lastScanAt = useEmailImportStore((x) => x.lastScanAt);
  const candidates = useEmailImportStore((x) => x.candidates);
  const isLoading = useEmailImportStore((x) => x.isLoading);
  const hasHydrated = useEmailImportStore((x) => x.hasHydrated);
  const scanProgress = useEmailImportStore((x) => x.scanProgress);
  const didFastPass = useEmailImportStore((x) => x.didFastPass);

  const providerLabel = PROVIDER_LABELS[connectedProvider] ?? "Email";
  const isGmail = connectedProvider === "gmail";

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange(() => {
      hydrate?.();
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isGmail) return;
    if (didFastPass) return;
    runGmailFastPass?.().catch((err) => {
      if (__DEV__) console.warn("[FastPass] scan failed:", err?.message);
      toast.show({ message: __DEV__ ? (err?.message || "Scan failed") : "Scan failed. Tap 'Scan inbox' to retry." });
    });
  }, [isGmail, didFastPass]);

  const lastScan = useMemo(() => {
    if (!lastScanAt) return "Not scanned yet";
    try {
      return timeAgo(lastScanAt) || "Not scanned yet";
    } catch (e) {
      if (__DEV__) console.warn("[connected] timeAgo failed:", e?.message);
      return "Not scanned yet";
    }
  }, [lastScanAt]);

  function onScanInbox() {
    Alert.alert(
      "Scan inbox",
      "How far back should we look?",
      [
        {
          text: "6 months",
          onPress: () => runScan({ provider: connectedProvider, daysBack: 180 }).catch((e) => {
            if (__DEV__) console.warn("[connected] scan failed:", e?.message);
          }),
        },
        {
          text: "1 year",
          onPress: () => runScan({ provider: connectedProvider, daysBack: 365 }).catch((e) => {
            if (__DEV__) console.warn("[connected] scan failed:", e?.message);
          }),
        },
        {
          text: "2 years",
          onPress: () => runScan({ provider: connectedProvider, daysBack: 730 }).catch((e) => {
            if (__DEV__) console.warn("[connected] scan failed:", e?.message);
          }),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  }

  function onDisconnect() {
    Alert.alert(
      `Disconnect ${providerLabel}?`,
      "You'll stop auto-detection. Your saved recurring items stay.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            await disconnect();
            toast.show({ message: "Disconnected" });
          },
        },
      ]
    );
  }

  function onClear() {
    Alert.alert(
      "Clear scan results?",
      "This removes detected results from BeforeItBills. Your email stays untouched.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            await clearImported();
            toast.show({ message: "Results cleared" });
          },
        },
      ]
    );
  }

  if (!hasHydrated) {
    return (
      <Screen>
        <NavHeader
          title="Mail scan"
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
        title="Mail scan"
        subtitle="You're in control. Nothing imports without you."
        onBack={() =>
          router.canGoBack?.() ? router.back() : router.replace("/(tabs)")
        }
      />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View style={{ alignItems: "center" }}>
        </View>

        {scanProgress ? <ScanProgressCard progress={scanProgress} /> : null}

        {!!connectedProvider ? (
          <Card>
            <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
              {providerLabel}
            </Text>

            <Text style={{ color: t.subtext, marginTop: 4 }}>
              {connectedEmail || "—"}
            </Text>

            <View style={{ height: 10 }} />

            <Text style={{ color: t.subtext, fontSize: 12 }}>
              Last scan
            </Text>

            <Text style={{ color: t.text, fontWeight: "900" }}>
              {lastScan}
            </Text>

            <View style={{ height: 14 }} />

            <Button
              title={isLoading ? "Scanning…" : "Scan inbox"}
              onPress={onScanInbox}
              disabled={isLoading}
            />
          </Card>
        ) : (
          <Card>
            <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
              Connect inbox
            </Text>

            <View style={{ height: 12 }} />

            <Button
              title="Connect Gmail"
              onPress={async () => {
                try {
                  const result = await connectGoogleGmail();
                  if (result?.ok) {
                    const store = useEmailImportStore.getState();
                    store.resetFastPass?.();
                    store.setConnectedProvider({
                      provider: "gmail",
                      email: result.email ?? null,
                    });
                    track("gmail_connected", { provider: "gmail" });
                    toast.show({ message: "Gmail connected — scanning inbox…" });
                  }
                } catch (e) {
                  if (e?.message !== "not_authenticated") {
                    toast.show({ message: e?.message || "Could not connect Gmail. Try again." });
                  }
                }
              }}
            />

            <Pressable
              onPress={() => router.push("/account/connect-email")}
              style={{ marginTop: 12, alignItems: "center" }}
            >
              <Text style={{ color: t.accent, fontWeight: "800" }}>
                Other email provider
              </Text>
            </Pressable>
          </Card>
        )}

        {candidates?.length ? (
          <Pressable
            onPress={() =>
              router.push("/account/connect-email/review")
            }
            style={{ alignItems: "center" }}
          >
            <Text style={{ color: t.accent, fontWeight: "800" }}>
              Review detected subscriptions ({candidates.length})
            </Text>
          </Pressable>
        ) : null}

        {connectedProvider ? (
          <Card>
            <Button
              title={`Disconnect ${providerLabel}`}
              variant="danger"
              onPress={onDisconnect}
              disabled={isLoading}
            />

            {candidates?.length ? (
              <>
                <View style={{ height: 8 }} />

                <Button
                  title="Clear scan results"
                  variant="secondary"
                  onPress={onClear}
                  disabled={isLoading}
                />
              </>
            ) : null}
          </Card>
        ) : null}

        {isGmail ? (
          <Pressable
            onPress={() =>
              Linking.openURL("https://myaccount.google.com/permissions")
            }
            style={{ paddingVertical: 10, alignItems: "center" }}
          >
            <Text style={{ color: t.subtext, fontWeight: "800" }}>
              Manage Google permissions →
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Screen>
  );
}