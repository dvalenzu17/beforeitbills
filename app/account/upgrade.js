import React, { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import PaywallSheet from "../../components/PaywallSheet";
import NavHeader from "../../components/NavHeader";
import { useTheme } from "../../lib/theme";
import { usePurchasesStore } from "../../lib/purchasesStore";
import { track } from "../../lib/analytics";
import { FREE_RECURRING_LIMIT } from "../../lib/limits";

function Card({ t, children, style }) {
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderColor: t.hairline,
          borderWidth: 1,
          borderRadius: 22,
          padding: 18,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function CompareRow({ t, label, free, pro, highlightPro }) {
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: t.hairline,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      </View>
      <View style={{ width: 96, alignItems: "flex-end" }}>
        <Text style={{ color: t.subtext, fontSize: 14, fontWeight: "600" }}>{free}</Text>
      </View>
      <View style={{ width: 104, alignItems: "flex-end" }}>
        <Text
          style={{
            color: highlightPro ? t.accent : t.text,
            fontSize: 14,
            fontWeight: highlightPro ? "800" : "600",
            textAlign: "right",
          }}
        >
          {pro}
        </Text>
      </View>
    </View>
  );
}

export default function UpgradeScreen() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  // Single source of truth — purchasesStore
  const isPro = usePurchasesStore((s) => s.isPro);
  const loading = usePurchasesStore((s) => s.loading);
  const loadOfferings = usePurchasesStore((s) => s.loadOfferings);

  const [paywallOpen, setPaywallOpen] = useState(false);

  const rows = useMemo(
    () => [
      { label: tt("upgrade.rows.recurringItems"),        free: tt("upgrade.values.upTo", { n: FREE_RECURRING_LIMIT }), pro: tt("upgrade.values.unlimited"),           highlightPro: true },
      { label: tt("upgrade.rows.mailScanDepth"),         free: tt("upgrade.values.nEmails", { n: 100 }),               pro: tt("upgrade.values.unlimited"),           highlightPro: true },
      { label: tt("upgrade.rows.preChargeAlerts"),       free: tt("upgrade.values.alertFree"),                         pro: tt("upgrade.values.alertPro"),            highlightPro: true },
      { label: tt("upgrade.rows.priceIncreaseAlerts"),   free: "—",                                                    pro: "✓",                                      highlightPro: true },
      { label: tt("upgrade.rows.cancellationShortcuts"), free: "—",                                                    pro: "✓",                                      highlightPro: true },
      { label: tt("upgrade.rows.renewalHistory"),        free: tt("upgrade.values.nDays", { n: 30 }),                  pro: tt("upgrade.values.nMonths", { n: 12 }), highlightPro: true },
      { label: tt("upgrade.rows.spendAnalytics"),        free: tt("upgrade.values.monthlyTotal"),                      pro: tt("upgrade.values.trendsAndCategories"), highlightPro: true },
      { label: tt("upgrade.rows.gmailAccounts"),         free: "1",                                                    pro: tt("upgrade.values.upTo", { n: 5 }),      highlightPro: true },
      { label: tt("upgrade.rows.csvExport"),             free: "—",                                                    pro: "✓",                                      highlightPro: true },
      { label: tt("upgrade.rows.imapConnect"),           free: "—",                                                    pro: tt("upgrade.values.unlocked"),            highlightPro: true },
    ],
    [tt]
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <NavHeader
        title={tt("upgrade.title")}
        onBack={() => (r.canGoBack() ? r.back() : r.replace("/(tabs)/account"))}
      />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 28 }}>
        <Card t={t}>
          <Text style={{ color: t.text, fontSize: 20, fontWeight: "800" }}>
            {isPro ? tt("upgrade.youArePro") : tt("upgrade.goPro")}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 8, lineHeight: 21, fontSize: 15, fontWeight: "500" }}>
            {isPro ? tt("upgrade.proUnlocked") : tt("upgrade.proBody")}
          </Text>

          <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
            <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hairline }}>
              <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>{tt("upgrade.tierFree")}</Text>
              <Text style={{ marginTop: 6, color: t.subtext, fontSize: 14 }}>{tt("upgrade.tierFreeTagline")}</Text>
            </View>
            <View style={{ flex: 1, padding: 14, borderRadius: 16, backgroundColor: "rgba(99,102,241,0.10)", borderWidth: 1, borderColor: "rgba(99,102,241,0.35)" }}>
              <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>{tt("upgrade.tierPro")}</Text>
              <Text style={{ marginTop: 6, color: t.subtext, fontSize: 14 }}>{tt("upgrade.tierProTagline")}</Text>
            </View>
          </View>

          {!isPro && (
            <Pressable
              onPress={() => {
                loadOfferings();
                setPaywallOpen(true);
                track("paywall_seen");
              }}
              style={{ marginTop: 18, backgroundColor: t.accent, paddingVertical: 15, borderRadius: 16, alignItems: "center" }}
            >
              <Text style={{ color: "#0B0F1A", fontSize: 16, fontWeight: "800" }}>{tt("upgrade.seePlans")}</Text>
            </Pressable>
          )}

          {loading && (
            <View style={{ marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator />
              <Text style={{ color: t.subtext, fontWeight: "600" }}>{tt("upgrade.checkingStatus")}</Text>
            </View>
          )}
        </Card>

        <View style={{ height: 16 }} />

        <Card t={t}>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={{ flex: 1, color: t.subtext, fontSize: 12, fontWeight: "700" }}>{tt("upgrade.colFeature")}</Text>
            <Text style={{ width: 96, textAlign: "right", color: t.subtext, fontSize: 12, fontWeight: "700" }}>{tt("upgrade.colFree")}</Text>
            <Text style={{ width: 104, textAlign: "right", color: t.accent, fontSize: 12, fontWeight: "700" }}>{tt("upgrade.colPro")}</Text>
          </View>
          {rows.map((row) => (
            <CompareRow key={row.label} t={t} label={row.label} free={row.free} pro={row.pro} highlightPro={row.highlightPro} />
          ))}
          <Text style={{ marginTop: 12, color: t.subtext, fontSize: 12, lineHeight: 18 }}>
            {tt("upgrade.disclaimer")}
          </Text>
        </Card>
      </ScrollView>

      <Modal transparent visible={paywallOpen} animationType="fade" onRequestClose={() => setPaywallOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: t.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: t.hairline, paddingBottom: 18 }}>
            <View style={{ alignItems: "center", paddingTop: 12, paddingBottom: 8 }}>
              <View style={{ width: 44, height: 5, borderRadius: 10, backgroundColor: t.hairline }} />
            </View>
            <PaywallSheet onClose={() => setPaywallOpen(false)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}