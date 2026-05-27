import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  View,
  Text,
  Pressable,
  Image,
  StatusBar,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, ZoomIn } from "react-native-reanimated";
import { usePurchasesStore } from "../lib/purchasesStore";
import { canUseNativePurchases } from "../lib/purchasesClient";
import { useTheme } from "../lib/theme";
import * as Haptics from "expo-haptics";
import Skeleton from "./Skeleton";
import { track } from "../lib/analytics";

// ─── Features ─────────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: "clock",    color: "#6366F1", labelKey: "paywall.feature1" },
  { icon: "mail",     color: "#8B5CF6", labelKey: "paywall.feature2" },
  { icon: "bell",     color: "#F59E0B", labelKey: "paywall.feature3" },
  { icon: "download", color: "#10B981", labelKey: "paywall.feature4" },
  { icon: "zap",      color: "#EF4444", labelKey: "paywall.feature5" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickPackage(packages, kind) {
  const list = Array.isArray(packages) ? packages : [];
  const norm = (s) => String(s || "").toLowerCase();
  const byType = list.find((p) => norm(p?.packageType) === norm(kind));
  if (byType) return byType;
  const idMatch = (p, words) => {
    const id    = norm(p?.identifier || p?.product?.identifier);
    const title = norm(p?.product?.title);
    return words.some((w) => id.includes(w) || title.includes(w));
  };
  if (kind === "monthly") return list.find((p) => idMatch(p, ["month", "monthly", "mth", "mo"]));
  if (kind === "annual")  return list.find((p) => idMatch(p, ["year", "annual", "yr"]));
  return null;
}

const priceStr = (pkg) => pkg?.product?.priceString ?? "-";
const hasTrial = (pkg)  => !!(pkg?.product?.introductoryPrice ?? pkg?.product?.intro_price);

// Builds the 1–2 plan options to display, with a safe fallback if RC package
// types don't match exactly (e.g. custom identifiers).
function buildDisplayPlans(packages, annual, monthly) {
  if (!packages.length) return [];
  if (annual && monthly) return [
    { id: "annual",  pkg: annual,  badgeKey: "paywall.badgeBestValue", captionKey: "paywall.captionPerYear"  },
    { id: "monthly", pkg: monthly, badgeKey: null,                     captionKey: "paywall.captionPerMonth" },
  ];
  if (annual)  return [{ id: "annual",  pkg: annual,  badgeKey: "paywall.badgeBestValue", captionKey: "paywall.captionPerYear"  }];
  if (monthly) return [{ id: "monthly", pkg: monthly, badgeKey: null,                     captionKey: "paywall.captionPerMonth" }];
  // Fallback: show first 2 packages regardless of type
  return packages.slice(0, 2).map((pkg, i) => ({
    id:         `pkg_${i}`,
    pkg,
    badgeKey:   i === 0 ? "paywall.badgeBestValue" : null,
    captionKey: i === 0 ? "paywall.captionPerYear" : "paywall.captionPerMonth",
  }));
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({ title, price, caption, badge, active, onPress, isDark }) {
  const activeBorder = "#6366F1";
  const inactiveBorder = isDark ? "rgba(255,255,255,0.1)" : "rgba(47,77,255,0.12)";
  const activeBg = isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.07)";
  const inactiveBg = isDark ? "rgba(255,255,255,0.04)" : "#fff";
  const titleColor = isDark ? "#fff" : "#0D1321";
  const priceColor = isDark ? "#fff" : "#0D1321";
  const captionColor = isDark
    ? "rgba(255,255,255,0.35)"
    : "rgba(13,19,33,0.45)";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={{
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 18,
        borderWidth: 1.5,
        borderColor: active ? activeBorder : inactiveBorder,
        backgroundColor: active ? activeBg : inactiveBg,
      }}
    >
      {badge ? (
        <View
          style={{
            alignSelf: "flex-start",
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: "#6366F1",
            marginBottom: 6,
          }}
        >
          <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>
            {badge}
          </Text>
        </View>
      ) : (
        <View style={{ height: 16, marginBottom: 6 }} />
      )}
      <Text style={{ color: priceColor, fontWeight: "900", fontSize: 18, letterSpacing: -0.3 }}>
        {price}
      </Text>
      <Text style={{ color: active ? titleColor : captionColor, fontWeight: "700", fontSize: 12, marginTop: 3 }}>
        {title}
      </Text>
      <Text style={{ color: captionColor, fontSize: 11, fontWeight: "500", marginTop: 1 }}>
        {caption}
      </Text>
    </Pressable>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PaywallSheet({ onClose }) {
  const { t: i18n } = useTranslation();
  const t       = useTheme();
  const isDark  = t.surface === "#161B24"; // DARK.surface - reliable sentinel

  const isPro           = usePurchasesStore((s) => s.isPro);
  const offerings       = usePurchasesStore((s) => s.offerings);
  const loading         = usePurchasesStore((s) => s.loading);
  const loadOfferings   = usePurchasesStore((s) => s.loadOfferings);
  const purchasePackage = usePurchasesStore((s) => s.purchasePackage);
  const restore         = usePurchasesStore((s) => s.restore);

  const [msg, setMsg]           = useState("");
  const [selected, setSelected] = useState("annual");
  const [buying, setBuying]     = useState(false);

  useEffect(() => {
    track("paywall_seen");
    loadOfferings();
    if (!canUseNativePurchases()) {
      setMsg(i18n("paywall.errExpoGo"));
    }
  }, []);

  const packages = useMemo(() => offerings?.current?.availablePackages ?? [], [offerings]);

  useEffect(() => {
    if (!loading && canUseNativePurchases() && packages.length === 0) {
      setMsg(i18n("paywall.errNoPlans"));
    } else if (packages.length > 0) {
      setMsg("");
    }
  }, [loading, packages]);

  const annual       = useMemo(() => pickPackage(packages, "annual"),  [packages]);
  const monthly      = useMemo(() => pickPackage(packages, "monthly"), [packages]);
  const displayPlans = useMemo(() => buildDisplayPlans(packages, annual, monthly), [packages, annual, monthly]);

  // Keep selected in sync when plans load
  useEffect(() => {
    if (displayPlans.length > 0 && !displayPlans.find((d) => d.id === selected)) {
      setSelected(displayPlans[0].id);
    }
  }, [displayPlans]);

  const selectedPlan = displayPlans.find((d) => d.id === selected) ?? displayPlans[0];
  const selectedPkg  = selectedPlan?.pkg ?? null;
  const trial        = hasTrial(selectedPkg);
  const period       = selected === "monthly" || selectedPlan?.caption === "per month" ? "/mo" : "/yr";

  // CTA label: "Start for $4.99/mo" or "Start free trial" or fallback
  const ctaLabel = buying
    ? "Processing…"
    : selectedPkg
    ? trial
      ? `Start free trial`
      : `Start for ${priceStr(selectedPkg)}${period}`
    : "Unlock BeforeItBills Pro";

  async function handleBuy() {
    if (!selectedPkg) {
      setMsg(i18n("paywall.errNoPlan"));
      return;
    }
    setBuying(true);
    setMsg("");
    try {
      const res = await purchasePackage(selectedPkg);
      if (!res.ok) {
        const errLower = (res.error || "").toLowerCase();
        if (!errLower.includes("cancel")) {
          Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Error).catch(() => {});
          const friendly = errLower.includes("network") || errLower.includes("connection")
            ? i18n("paywall.errNoConnection")
            : errLower.includes("payment") || errLower.includes("billing")
            ? i18n("paywall.errPaymentFailed")
            : errLower.includes("not_allowed") || errLower.includes("storekit")
            ? i18n("paywall.errRestricted")
            : i18n("paywall.errPurchaseFailed");
          setMsg(friendly);
        }
      } else {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success).catch(() => {});
        track("paywall_converted", { plan: selected, pkg: selectedPkg?.identifier });
        onClose?.();
      }
    } finally {
      setBuying(false);
    }
  }

  async function handleRestore() {
    const res = await restore();
    if (res?.ok) onClose?.();
    else if (res?.reason === "expo_go") setMsg(i18n("paywall.errRestoreExpoGo"));
  }

  function handleDevUnlock() {
    usePurchasesStore.setState({ isPro: true });
    track("paywall_dev_unlock");
    onClose?.();
  }

  // ── Theme-derived colors ───────────────────────────────────────────────────

  const bgGradient   = isDark
    ? ["#0A0E1A", "#130E2E", "#0A0E1A"]
    : [t.bg, "#E4EBFF", t.bg];

  const featureCardBg     = isDark ? "rgba(255,255,255,0.03)"  : "#fff";
  const featureCardBorder = isDark ? "rgba(255,255,255,0.07)"  : "rgba(47,77,255,0.08)";
  const featureRowBorder  = isDark ? "rgba(255,255,255,0.06)"  : "rgba(47,77,255,0.06)";
  const featureTextColor  = isDark ? "#fff"                    : t.text;
  const sectionLabelColor = isDark ? "rgba(255,255,255,0.28)"  : t.tertiary;
  const headlineColor     = isDark ? "#fff"                    : t.text;
  const subheadlineColor  = isDark ? "rgba(255,255,255,0.45)"  : t.subtext;
  const msgBg             = isDark ? "rgba(255,255,255,0.05)"  : t.surface;
  const msgBorder         = isDark ? "rgba(255,255,255,0.08)"  : t.hairline;
  const msgText           = isDark ? "rgba(255,255,255,0.5)"   : t.subtext;
  const footerTextColor   = isDark ? "rgba(255,255,255,0.3)"   : t.tertiary;
  const cancelTextColor   = isDark ? "rgba(255,255,255,0.28)"  : t.tertiary;
  const closeIconBg       = isDark ? "rgba(255,255,255,0.08)"  : "rgba(0,0,0,0.06)";
  const closeIconColor    = isDark ? "rgba(255,255,255,0.55)"  : t.subtext;
  const proBadgeShadow    = isDark ? 0.65 : 0.35;

  // ── Pro screen (already subscribed) ─────────────────────────────────────

  if (isPro) {
    return (
      <LinearGradient
        colors={bgGradient}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={{ flex: 1 }}
      >
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <SafeAreaView style={{ flex: 1 }}>
          <Pressable
            onPress={onClose}
            hitSlop={16}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={{
              position: "absolute",
              top: Platform.OS === "android" ? 12 : 4,
              right: 20,
              zIndex: 20,
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: closeIconBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="x" size={16} color={closeIconColor} />
          </Pressable>

          <View style={{ flex: 1, paddingHorizontal: 22, alignItems: "center", justifyContent: "center", gap: 16 }}>
            <Animated.View entering={ZoomIn.duration(380)} style={{ alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  overflow: "hidden",
                  shadowColor: "#6366F1",
                  shadowOpacity: 0.55,
                  shadowRadius: 22,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 12,
                }}
              >
                <Image
                  source={require("../assets/BeforeItBillsLogo.png")}
                  style={{ width: 72, height: 72 }}
                  resizeMode="cover"
                />
              </View>

              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 8,
                  backgroundColor: "#6366F1",
                  shadowColor: "#6366F1",
                  shadowOpacity: proBadgeShadow,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 0 },
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, letterSpacing: 1.2 }}>
                  PRO ACTIVE
                </Text>
              </View>

              <Text
                style={{
                  fontSize: 28,
                  fontWeight: "900",
                  color: headlineColor,
                  textAlign: "center",
                  letterSpacing: -0.5,
                  lineHeight: 34,
                }}
              >
                You're all set.
              </Text>

              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "500",
                  color: subheadlineColor,
                  textAlign: "center",
                  lineHeight: 20,
                  maxWidth: 280,
                }}
              >
                BeforeItBills Pro is active. All features are unlocked.
              </Text>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(380)} style={{ width: "100%", gap: 10, marginTop: 8 }}>
              {FEATURES.map((f) => (
                <View
                  key={f.labelKey}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      backgroundColor: f.color + (isDark ? "30" : "18"),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Feather name={f.icon} size={13} color={f.color} />
                  </View>
                  <Text style={{ color: featureTextColor, fontWeight: "700", fontSize: 14, flex: 1 }}>
                    {i18n(f.labelKey)}
                  </Text>
                  <Feather name="check-circle" size={15} color="#30D158" />
                </View>
              ))}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(380).duration(380)} style={{ width: "100%", marginTop: 8 }}>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  shadowColor: "#6366F1",
                  shadowOpacity: isDark ? 0.45 : 0.3,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 10,
                }}
              >
                <LinearGradient
                  colors={["#6366F1", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 17, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.2 }}>
                    Continue
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={handleRestore}
                hitSlop={12}
                accessibilityRole="button"
                style={{ alignItems: "center", marginTop: 14 }}
              >
                <Text style={{ color: footerTextColor, fontWeight: "700", fontSize: 12 }}>
                  Manage subscription
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <LinearGradient
      colors={bgGradient}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Close */}
        <Pressable
          onPress={onClose}
          hitSlop={16}
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={{
            position: "absolute",
            top: Platform.OS === "android" ? 12 : 4,
            right: 20,
            zIndex: 20,
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: closeIconBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name="x" size={16} color={closeIconColor} />
        </Pressable>

        <View style={{ flex: 1, paddingHorizontal: 22 }}>

          {/* ── Header ── */}
          <Animated.View
            entering={ZoomIn.duration(380)}
            style={{ alignItems: "center", paddingTop: 20, paddingBottom: 18 }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                overflow: "hidden",
                marginBottom: 12,
                shadowColor: "#6366F1",
                shadowOpacity: 0.55,
                shadowRadius: 22,
                shadowOffset: { width: 0, height: 4 },
                elevation: 12,
              }}
            >
              <Image
                source={require("../assets/BeforeItBillsLogo.png")}
                style={{ width: 64, height: 64 }}
                resizeMode="cover"
              />
            </View>

            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: "#6366F1",
                marginBottom: 12,
                shadowColor: "#6366F1",
                shadowOpacity: proBadgeShadow,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 11, letterSpacing: 1.2 }}>
                PRO
              </Text>
            </View>

            <Text
              style={{
                fontSize: 26,
                fontWeight: "900",
                color: headlineColor,
                textAlign: "center",
                letterSpacing: -0.5,
                lineHeight: 32,
                marginBottom: 7,
              }}
            >
              Unlock BeforeItBills Pro
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: "500",
                color: subheadlineColor,
                textAlign: "center",
                lineHeight: 19,
              }}
            >
              Everything you need to take control before you get charged.
            </Text>
          </Animated.View>

          {/* ── Features - flex:1 fills the middle ── */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(380)}
            style={{ flex: 1, justifyContent: "center", minHeight: 0 }}
          >
            <Text style={{ fontSize: 10, fontWeight: "800", color: sectionLabelColor, letterSpacing: 1.4, marginBottom: 10 }}>
              WHAT'S INCLUDED
            </Text>

            <View
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: featureCardBorder,
                backgroundColor: featureCardBg,
                overflow: "hidden",
                ...(isDark ? {} : {
                  shadowColor: "#6366F1",
                  shadowOpacity: 0.06,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 2,
                }),
              }}
            >
              {FEATURES.map((f, i) => (
                <Animated.View
                  key={f.labelKey}
                  entering={FadeInDown.delay(100 + i * 50).duration(320)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingVertical: 11,
                    paddingHorizontal: 14,
                    borderBottomWidth: i < FEATURES.length - 1 ? 1 : 0,
                    borderBottomColor: featureRowBorder,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 11,
                      backgroundColor: f.color + (isDark ? "30" : "18"),
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      shadowColor: f.color,
                      shadowOpacity: isDark ? 0.4 : 0.2,
                      shadowRadius: 8,
                      shadowOffset: { width: 0, height: 0 },
                    }}
                  >
                    <Feather name={f.icon} size={16} color={f.color} />
                  </View>
                  <Text style={{ flex: 1, color: featureTextColor, fontWeight: "700", fontSize: 14 }}>
                    {i18n(f.labelKey)}
                  </Text>
                  <Feather name="check-circle" size={15} color={f.color} style={{ opacity: 0.8 }} />
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* ── Bottom section ── */}
          <Animated.View entering={FadeInDown.delay(420).duration(380)} style={{ paddingBottom: 8 }}>

            {/* Plan picker */}
            <Text style={{ fontSize: 10, fontWeight: "800", color: sectionLabelColor, letterSpacing: 1.4, marginTop: 16, marginBottom: 10 }}>
              CHOOSE YOUR PLAN
            </Text>

            {loading ? (
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1 }}><Skeleton h={90} r={18} /></View>
                <View style={{ flex: 1 }}><Skeleton h={90} r={18} /></View>
              </View>
            ) : displayPlans.length > 0 ? (
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                {displayPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    title={plan.badgeKey ? i18n("common.annual") : i18n("common.monthly")}
                    price={priceStr(plan.pkg)}
                    caption={plan.captionKey ? i18n(plan.captionKey) : ""}
                    badge={plan.badgeKey ? i18n(plan.badgeKey) : null}
                    active={selected === plan.id}
                    isDark={isDark}
                    onPress={() => {
                      Haptics.selectionAsync?.().catch(() => {});
                      setSelected(plan.id);
                    }}
                  />
                ))}
              </View>
            ) : (
              <View style={{ marginBottom: 16 }} />
            )}

            {/* Error/info message */}
            {!!msg && (
              <View
                style={{
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: msgBg,
                  borderWidth: 1,
                  borderColor: msgBorder,
                }}
              >
                <Text style={{ color: msgText, fontWeight: "600", fontSize: 12, lineHeight: 17 }}>
                  {msg}
                </Text>
              </View>
            )}

            {/* CTA */}
            {packages.length > 0 ? (
              <Pressable
                onPress={handleBuy}
                disabled={buying}
                accessibilityRole="button"
                style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  opacity: buying ? 0.7 : 1,
                  shadowColor: "#6366F1",
                  shadowOpacity: isDark ? 0.45 : 0.3,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 10,
                }}
              >
                <LinearGradient
                  colors={["#6366F1", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 17, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: 0.2 }}>
                    {ctaLabel}
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : __DEV__ ? (
              <Pressable
                onPress={handleDevUnlock}
                accessibilityRole="button"
                style={{
                  borderRadius: 18,
                  overflow: "hidden",
                  shadowColor: "#6366F1",
                  shadowOpacity: isDark ? 0.45 : 0.3,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 5 },
                  elevation: 10,
                }}
              >
                <LinearGradient
                  colors={["#6366F1", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 17, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                    [DEV] Unlock Pro
                  </Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <Pressable
                onPress={loadOfferings}
                accessibilityRole="button"
                style={{ borderRadius: 18, overflow: "hidden", elevation: 10 }}
              >
                <LinearGradient
                  colors={["#6366F1", "#8B5CF6"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ paddingVertical: 17, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                    Retry
                  </Text>
                </LinearGradient>
              </Pressable>
            )}

            {/* Cancel anytime */}
            <Text
              style={{
                textAlign: "center",
                color: cancelTextColor,
                fontSize: 11,
                fontWeight: "500",
                marginTop: 10,
                lineHeight: 16,
              }}
            >
              {trial
                ? `7-day free trial · then ${priceStr(selectedPkg)}${period} · cancel anytime`
                : "Auto-renews · cancel anytime in App Store Settings"}
            </Text>

            {/* Restore + not now */}
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 28, marginTop: 14 }}>
              <Pressable onPress={handleRestore} hitSlop={12} accessibilityRole="button">
                <Text style={{ color: footerTextColor, fontWeight: "700", fontSize: 12 }}>
                  Restore purchases
                </Text>
              </Pressable>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
                <Text style={{ color: footerTextColor, fontWeight: "700", fontSize: 12 }}>
                  Not now
                </Text>
              </Pressable>
            </View>

          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
