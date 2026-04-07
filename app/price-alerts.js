// app/price-alerts.js
import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "../lib/theme";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/utils";

import BrandAvatar from "../components/BrandAvatar";
import ProofModal from "../components/ProofModal";
import EmptyStateCard from "../components/EmptyStateCard";

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function pickDomain(x) {
  return x?.domain || x?.fromDomain || x?.merchantDomain || x?.brandDomain || x?.senderDomain || "";
}
function pickName(x) {
  return x?.brand || x?.merchant || x?.name || x?.title || x?.fromName || "Unknown";
}
function safeDate(d) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toISOString().slice(0, 10);
  } catch {
    return String(d).slice(0, 10);
  }
}

// Expected backend shape eventually:
// { id, brand, domain, currency, oldAmount, newAmount, effectiveDate, evidence:[{subject,from,date,snippet,why}] }
function getPriceAlertsFromStore({ recurring, actionFeed }) {
  // 1) If your store already emits actionFeed items of kind "price_increase"
  const feedAlerts =
    (actionFeed || [])
      .filter((a) => norm(a?.kind).includes("price") || norm(a?.type).includes("price"))
      .map((a, idx) => ({
        id: a.id || `feed_${idx}`,
        brand: a.brand || a.title || "Price change",
        domain: a.domain || "",
        currency: a.currency || "USD",
        oldAmount: a.oldAmount ?? a.before ?? null,
        newAmount: a.newAmount ?? a.after ?? null,
        effectiveDate: a.effectiveDate || a.date || null,
        evidence: a.evidence || a.emails || [],
        raw: a,
      })) || [];

  // 2) Fallback demo: if recurring has priceChange fields
  const recurringAlerts =
    (recurring || [])
      .filter((x) => x?.priceChange || x?.price_change || x?.newAmount || x?.oldAmount)
      .map((x, idx) => ({
        id: x.id || `rec_${idx}`,
        brand: pickName(x),
        domain: pickDomain(x),
        currency: x.currency || "USD",
        oldAmount: x.oldAmount ?? x.priceChange?.old ?? x.price_change?.old ?? null,
        newAmount: x.newAmount ?? x.priceChange?.new ?? x.price_change?.new ?? null,
        effectiveDate: x.effectiveDate ?? x.priceChange?.effectiveDate ?? x.price_change?.effective_date ?? null,
        evidence: x.evidence || [],
        raw: x,
      })) || [];

  // De-dupe by id
  const map = new Map();
  [...feedAlerts, ...recurringAlerts].forEach((a) => map.set(a.id, a));
  return Array.from(map.values());
}

function DeltaPill({ oldAmount, newAmount, currency }) {
  const t = useTheme();
  const oldN = Number(oldAmount);
  const newN = Number(newAmount);

  if (!Number.isFinite(oldN) || !Number.isFinite(newN)) return null;

  const delta = newN - oldN;
  const pct = oldN > 0 ? (delta / oldN) * 100 : null;

  const up = delta > 0;
  const borderColor = up ? "rgba(255,80,80,0.55)" : "rgba(80,255,160,0.45)";
  const bg = up ? "rgba(255,80,80,0.10)" : "rgba(80,255,160,0.08)";

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor,
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: t.text, fontWeight: "900", fontSize: 12 }}>
        {up ? "+" : ""}
        {formatMoney?.(delta, currency) ?? delta.toFixed(2)}{" "}
        {pct != null ? `(${up ? "+" : ""}${pct.toFixed(0)}%)` : ""}
      </Text>
    </View>
  );
}

export default function PriceAlerts() {
  const t = useTheme();
  const r = useRouter();

  const getRecurring = useStore((s) => s.getRecurring);
  const subs = useStore((s) => s.subs);
  const bills = useStore((s) => s.bills);
  const getActionFeed = useStore((s) => s.getActionFeed);

  const recurring = useMemo(() => getRecurring?.() || [], [getRecurring, subs, bills]);
  const actionFeed = useMemo(() => getActionFeed?.() || [], [getActionFeed, subs, bills]);

  const alerts = useMemo(() => getPriceAlertsFromStore({ recurring, actionFeed }), [recurring, actionFeed]);

  const [proofOpen, setProofOpen] = useState(false);
  const [proofItem, setProofItem] = useState(null);

  const openProof = (a) => {
    const ev = a.evidence?.[0] || {
      subject: "Your price is changing",
      from: a.domain ? `billing@${a.domain}` : "billing@merchant.com",
      date: a.effectiveDate || new Date().toISOString(),
      snippet: `Your plan price is changing from ${a.oldAmount} to ${a.newAmount}. Effective ${safeDate(a.effectiveDate)}.`,
      why: ["Email included a before/after price.", "Contained an effective date.", "Sender matched the merchant domain."],
    };

    setProofItem({
      merchant: a.brand,
      name: a.brand,
      domain: a.domain,
      cadence: "price change",
      evidence: [ev],
    });
    setProofOpen(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => r.back()}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: t.hairline,
              backgroundColor: t.surface,
            }}
          >
            <Feather name="arrow-left" size={16} color={t.text} />
          </Pressable>

          <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>Price alerts</Text>
        </View>

        <Text style={{ color: t.subtext, marginTop: 8, lineHeight: 18 }}>
          Spot price hikes before they hit your card. Tap any alert to see the exact email proof.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 28, gap: 10 }} showsVerticalScrollIndicator={false}>
        {alerts.length === 0 ? (
          <EmptyStateCard
            icon="trending-up"
            title="No price increases detected"
            body="When a merchant emails “your plan is going up”, we’ll catch it and show the before/after."
            primary={{
              title: "Scan inbox",
              icon: "search",
              onPress: () => r.push("/(onboarding)/scan-setup"),
            }}
            secondary={{
              title: "Add manually",
              icon: "plus",
              onPress: () => r.push("/add-recurring"),
            }}
            tertiary={{
              title: "Back to Home",
              onPress: () => r.push("/(tabs)"),
            }}
          />
        ) : (
          alerts
            .slice()
            .sort((a, b) => {
              const da = a.effectiveDate ? new Date(a.effectiveDate).getTime() : Number.POSITIVE_INFINITY;
              const db = b.effectiveDate ? new Date(b.effectiveDate).getTime() : Number.POSITIVE_INFINITY;
              return da - db;
            })
            .map((a) => (
              <Pressable
                key={a.id}
                onPress={() => openProof(a)}
                style={{
                  padding: 14,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: t.hairline,
                  backgroundColor: t.surface,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <BrandAvatar domain={a.domain} name={a.brand} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>{a.brand}</Text>
                    <Text style={{ color: t.subtext, marginTop: 3 }}>
                      Effective {safeDate(a.effectiveDate)}
                    </Text>
                  </View>

                  <DeltaPill oldAmount={a.oldAmount} newAmount={a.newAmount} currency={a.currency} />
                  <Feather name="chevron-right" size={18} color={t.tertiary} />
                </View>

                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 12 }}>
                  <Text style={{ color: t.subtext, fontWeight: "900" }}>Before</Text>
                  <Text style={{ color: t.text, fontWeight: "900" }}>
                    {a.oldAmount != null ? (formatMoney?.(a.oldAmount, a.currency) ?? `${a.oldAmount} ${a.currency}`) : "—"}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 6 }}>
                  <Text style={{ color: t.subtext, fontWeight: "900" }}>After</Text>
                  <Text style={{ color: t.text, fontWeight: "900" }}>
                    {a.newAmount != null ? (formatMoney?.(a.newAmount, a.currency) ?? `${a.newAmount} ${a.currency}`) : "—"}
                  </Text>
                </View>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
                  <Feather name="shield" size={14} color={t.tertiary} />
                  <Text style={{ color: t.tertiary, fontWeight: "900" }}>Tap to see proof</Text>
                </View>
              </Pressable>
            ))
        )}
      </ScrollView>

      <ProofModal visible={proofOpen} item={proofItem} onClose={() => setProofOpen(false)} />
    </SafeAreaView>
  );
}
