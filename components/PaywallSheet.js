import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { usePurchasesStore } from "../lib/purchasesStore";
import { canUseNativePurchases } from "../lib/purchasesClient";
import { useTheme } from "../lib/theme";
import * as Haptics from "expo-haptics";
import Skeleton from "./Skeleton";
import { track } from "../lib/analytics";

function pickPackage(packages, kind) {
  const list = Array.isArray(packages) ? packages : [];
  const norm = (s) => String(s || "").toLowerCase();
  const byType = list.find((p) => norm(p?.packageType) === norm(kind));
  if (byType) return byType;
  const idMatch = (p, words) => {
    const id = norm(p?.identifier || p?.product?.identifier);
    const title = norm(p?.product?.title);
    return words.some((w) => id.includes(w) || title.includes(w));
  };
  if (kind === "monthly")  return list.find((p) => idMatch(p, ["month", "monthly", "mth", "mo"]));
  if (kind === "annual")   return list.find((p) => idMatch(p, ["year", "annual", "yr"]));
  if (kind === "lifetime") return list.find((p) => idMatch(p, ["life", "lifetime", "forever"]));
  return null;
}

function PlanCard({ t, title, price, caption, badge, active, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      accessible={true}
      accessibilityRole="radio"
      accessibilityLabel={`${title}, ${price}${badge ? `, ${badge}` : ""}`}
      accessibilityHint={caption}
      accessibilityState={{ selected: active }}
      style={{
        padding: 14, borderRadius: 20,
        backgroundColor: active ? "rgba(167,139,250,0.12)" : t.surface2,
        borderWidth: 1,
        borderColor: active ? "rgba(167,139,250,0.42)" : t.hairline,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>{title}</Text>
        {badge ? (
          <View style={{ paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(167,139,250,0.18)", borderWidth: 1, borderColor: "rgba(167,139,250,0.35)" }}>
            <Text style={{ color: t.text, fontWeight: "800", fontSize: 12 }}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={{ color: t.text, fontWeight: "800", fontSize: 18, marginTop: 8 }}>{price}</Text>
      <Text style={{ color: t.subtext, fontWeight: "600", marginTop: 6, lineHeight: 18 }}>{caption}</Text>
    </Pressable>
  );
}

// Default copy — overridden by offerings.current.metadata when RC experiment is running
const DEFAULT_COPY = {
  headline: "Go Pro",
  subheadline: "Start free. Scan your first 100 emails to preview mail insights. Upgrade when you're ready.\nReminders stay free.",
  cta: "Continue",
};

export default function PaywallSheet({ onClose }) {
  const t = useTheme();

  const offerings   = usePurchasesStore((s) => s.offerings);
  const loading     = usePurchasesStore((s) => s.loading);
  const loadOfferings     = usePurchasesStore((s) => s.loadOfferings);
  const purchasePackage   = usePurchasesStore((s) => s.purchasePackage);
  const restore     = usePurchasesStore((s) => s.restore);

  const [msg, setMsg] = useState("");
  const [selected, setSelected] = useState("annual");

  // Read copy from offering metadata — populated by RC experiment variants
  const meta = offerings?.current?.metadata ?? {};
  const copy = {
    headline:    meta.headline    ?? DEFAULT_COPY.headline,
    subheadline: meta.subheadline ?? DEFAULT_COPY.subheadline,
    cta:         meta.cta         ?? DEFAULT_COPY.cta,
  };

  useEffect(() => {
    track("paywall_seen", { variant: offerings?.current?.lookupKey ?? "default" });
    loadOfferings();
    if (!canUseNativePurchases()) {
      setMsg("Payments require a dev build / APK. Expo Go can't do in-app purchases.");
    }
  }, []);

  const packages = useMemo(
    () => offerings?.current?.availablePackages ?? [],
    [offerings]
  );

  useEffect(() => {
    if (!loading && canUseNativePurchases() && packages.length === 0) {
      setMsg("No plans found yet. Add products + an offering in RevenueCat.");
    } else if (packages.length > 0) {
      setMsg("");
    }
  }, [loading, packages]);

  const monthly  = useMemo(() => pickPackage(packages, "monthly"),  [packages]);
  const annual   = useMemo(() => pickPackage(packages, "annual"),   [packages]);
  const lifetime = useMemo(() => pickPackage(packages, "lifetime"), [packages]);

  const selectedPkg =
    selected === "monthly"  ? monthly  :
    selected === "lifetime" ? lifetime :
    annual || monthly || lifetime;

  async function handleBuy() {
    setMsg("");
    if (!selectedPkg) {
      setMsg("No plan available yet. Configure monthly/yearly/lifetime in RevenueCat.");
      return;
    }
    const res = await purchasePackage(selectedPkg);
    if (!res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMsg(res.error || "Purchase failed.");
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    track("paywall_converted", { plan: selected, pkg: selectedPkg?.identifier });
    onClose?.();
  }

  async function handleRestore() {
    const res = await restore();
    if (!res?.ok && res?.reason === "expo_go") {
      setMsg("Restore requires a dev build / APK.");
      return;
    }
    onClose?.();
  }

  // Dev bypass — sets isPro locally without a real purchase
  function handleDevUnlock() {
    usePurchasesStore.setState({ isPro: true });
    onClose?.();
  }

  const priceString = (p) => p?.product?.priceString || "—";

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "800", color: t.text }}>{copy.headline}</Text>
      <Text style={{ marginTop: 8, color: t.subtext, fontWeight: "600", lineHeight: 20 }}>
        {copy.subheadline}
      </Text>

      {!!msg && (
        <View style={{ marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hairline }}>
          <Text style={{ color: t.text, fontWeight: "700" }}>{msg}</Text>
        </View>
      )}

      <View style={{ marginTop: 14, gap: 10 }}>
        <PlanCard t={t} title="Yearly"   price={priceString(annual)}   caption="Best value. One payment, full year."      badge="Best value" active={selected === "annual"}   onPress={() => setSelected("annual")} />
        <PlanCard t={t} title="Monthly"  price={priceString(monthly)}  caption="Flexible. Cancel anytime."                               active={selected === "monthly"}  onPress={() => setSelected("monthly")} />
        <PlanCard t={t} title="Lifetime" price={priceString(lifetime)} caption="Pay once. Keep Pro forever."               badge="One-time"   active={selected === "lifetime"} onPress={() => setSelected("lifetime")} />

        <View style={{ padding: 14, borderRadius: 20, backgroundColor: "rgba(167,139,250,0.10)", borderWidth: 1, borderColor: "rgba(167,139,250,0.30)" }}>
          <Text style={{ fontWeight: "800", color: t.text }}>What you get</Text>
          {["Unlimited recurring", "Unlimited mail scan + advanced insights", "Export CSV", "IMAP connect"].map((f) => (
            <Text key={f} style={{ marginTop: 6, color: t.text, fontWeight: "600" }}>• {f}</Text>
          ))}
        </View>

        {loading ? (
          <View style={{ gap: 10 }}>
            <Skeleton h={82} r={20} />
            <Skeleton h={82} r={20} />
            <Skeleton h={82} r={20} />
            <Skeleton h={100} r={20} />
            <Skeleton h={50} r={18} />
          </View>
        ) : packages.length ? (
          <Pressable onPress={handleBuy} accessibilityRole="button" accessibilityLabel="Continue with selected plan" style={{ paddingVertical: 14, borderRadius: 18, backgroundColor: t.accent, alignItems: "center" }}>
            <Text style={{ color: "#0B0F1A", fontWeight: "800" }}>{copy.cta}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={handleDevUnlock} accessibilityRole="button" accessibilityLabel="Unlock Pro beta" style={{ paddingVertical: 14, borderRadius: 18, backgroundColor: t.accent, alignItems: "center" }}>
            <Text style={{ color: "#0B0F1A", fontWeight: "800" }}>Unlock Pro (beta)</Text>
          </Pressable>
        )}

        <Pressable onPress={handleRestore} accessibilityRole="button" accessibilityLabel="Restore purchases" style={{ paddingVertical: 14, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", borderWidth: 1, borderColor: t.hairline }}>
          <Text style={{ color: t.text, fontWeight: "800" }}>Restore purchases</Text>
        </Pressable>

        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss paywall" style={{ paddingVertical: 12, alignItems: "center" }}>
          <Text style={{ fontWeight: "800", color: t.subtext }}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}