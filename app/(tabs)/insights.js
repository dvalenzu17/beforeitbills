// app/(tabs)/insights.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View, Text, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Svg, { Path, Circle } from "react-native-svg";
import { PanGestureHandler } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

import Screen from "../../components/Screen";
import { BiBRefreshControl, BiBRefreshBanner } from "../../components/BiBRefreshControl";
import Card from "../../components/Card";
import PressableScale from "../../components/PressableScale";
import RecapSheet from "../../components/RecapSheet";
import Skeleton from "../../components/Skeleton";

import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";
import { formatMoney } from "../../lib/utils";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { SPACING } from "../../lib/ui/tokens";
import * as T from "../../components/ui/Text";
import { useRecordingStore } from "../../lib/recordingMode";

/* ─── helpers ────────────────────────────────────────────────────── */

function cadenceFactor(c) {
  return c === "yearly" ? 1 / 12 : c === "quarterly" ? 1 / 3 : c === "weekly" ? 4.345 : 1;
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}
function stableMonthly(x) {
  return (Number(x?.effectiveAmount) || 0) * cadenceFactor(x?.cadence || "monthly");
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

// Returns the total spend expected in the month that is `monthOffset` away from now.
// Monthly/weekly subs contribute their stableMonthly every month.
// Quarterly/yearly subs contribute their full effectiveAmount only in their renewal months.
function computeSpendForMonth(recurring, monthOffset) {
  const now = new Date();
  let targetMonth = now.getMonth() + monthOffset;
  let targetYear = now.getFullYear() + Math.floor(targetMonth / 12);
  targetMonth = ((targetMonth % 12) + 12) % 12;

  let total = 0;
  for (const x of recurring) {
    if (x.active === false) continue;
    const cadence = x.cadence || "monthly";

    if (cadence === "monthly" || cadence === "weekly") {
      total += stableMonthly(x);
    } else {
      const nd = x.nextDate ? new Date(x.nextDate) : null;
      if (!nd || Number.isNaN(nd.getTime())) {
        total += stableMonthly(x); // fallback: spread across months
        continue;
      }
      const monthDiff = (targetYear - nd.getFullYear()) * 12 + (targetMonth - nd.getMonth());
      const period = cadence === "quarterly" ? 3 : 12;
      if (monthDiff % period === 0) {
        total += Number(x.effectiveAmount) || 0;
      }
    }
  }
  return total;
}
function pickName(x) { return x?.title || x?.merchant || x?.name || "Unknown"; }
function pickDomain(x) {
  return x?.domain || x?.fromDomain || x?.merchantDomain || x?.brandDomain || "";
}
function norm(s) { return String(s || "").trim().toLowerCase(); }

function polarToCartesian(cx, cy, r, angle) {
  const a = (angle - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx, cy, r, startAngle, endAngle) {
  // Clamp arc to max 359.9° to avoid SVG rendering artifact on full circles
  const delta = Math.min(endAngle - startAngle, 359.9);
  const start = polarToCartesian(cx, cy, r, startAngle + delta);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const large = delta > 180 ? "1" : "0";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}
function createSmoothPath(points) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const midX = (points[i - 1].x + points[i].x) / 2;
    d += ` C ${midX} ${points[i - 1].y}, ${midX} ${points[i].y}, ${points[i].x} ${points[i].y}`;
  }
  return d;
}

/* ─── InsightsSkeleton ───────────────────────────────────────────── */

function InsightsSkeleton() {
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ gap: 8 }}>
          <Skeleton h={28} w={120} r={10} />
          <Skeleton h={14} w={180} r={10} />
        </View>
        <Skeleton h={38} w={80} r={14} />
      </View>
      <View style={{ borderRadius: 22, padding: 18, gap: 12, backgroundColor: "transparent", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
        <Skeleton h={16} w={100} r={10} />
        <Skeleton h={180} w="100%" r={14} />
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ flex: 1, borderRadius: 18, padding: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", gap: 8 }}>
            <Skeleton h={16} w={24} r={8} />
            <Skeleton h={12} w="60%" r={8} />
            <Skeleton h={18} w="80%" r={8} />
          </View>
        ))}
      </View>
      <View style={{ borderRadius: 22, padding: 18, gap: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
        <Skeleton h={16} w={100} r={10} />
        {[0, 1, 2].map(i => (
          <Skeleton key={i} h={60} w="100%" r={16} />
        ))}
      </View>
    </View>
  );
}

/* ─── Main screen ────────────────────────────────────────────────── */

export default function Insights() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  const recordingActive = useRecordingStore((s) => s.active);
  const recordingPersona = useRecordingStore((s) => s.persona);

  const {
    subs = [], bills = [], user,
    fetchSubs, loadSubsLocal, loadBills, loadMail, getRecurring,
  } = useStore();

  const emailConnected = useEmailImportStore((s) => !!s.connectedProvider);
  const [recapOpen, setRecapOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadMail?.();
      await loadBills?.();
      if (user) await fetchSubs?.();
      else await loadSubsLocal?.();
      setLoading(false);
    })();
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMail?.();
      await loadBills?.();
      if (user) await fetchSubs?.();
      else await loadSubsLocal?.();
    } catch (e) {
      if (__DEV__) console.warn("[insights] refresh failed:", e?.message);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  const recurring = useMemo(
    () => (recordingActive && recordingPersona
      ? recordingPersona.recurring || []
      : getRecurring?.() || []
    ).filter((x) => x.active !== false),
    [recordingActive, recordingPersona, getRecurring, subs, bills]
  );

  const trialsEnding = useMemo(() => recurring.filter((x) => {
    const isTrial = x.raw?.is_trial || x.raw?.isTrial || !!x.raw?.trial_end || !!x.raw?.trialEnd;
    const trialEnd = x.raw?.trial_end || x.raw?.trialEnd || null;
    return isTrial && daysUntil(trialEnd) != null && daysUntil(trialEnd) <= 7;
  }).sort((a, b) => {
    const ae = a.raw?.trial_end || a.raw?.trialEnd;
    const be = b.raw?.trial_end || b.raw?.trialEnd;
    return (daysUntil(ae) ?? 999) - (daysUntil(be) ?? 999);
  }), [recurring]);

  const monthlyBurn = useMemo(
    () => recurring.reduce((s, x) => s + stableMonthly(x), 0),
    [recurring]
  );

  const next30 = useMemo(() => {
    const cutoff = Date.now() + 30 * 86400000;
    return recurring
      .filter((x) => x.nextDate && new Date(x.nextDate).getTime() <= cutoff)
      .reduce((s, x) => s + (Number(x.effectiveAmount) || 0), 0);
  }, [recurring]);

  const weeklyBuckets = useMemo(() => {
    const now = Date.now();
    const weeks = [0, 0, 0, 0];
    for (const x of recurring) {
      if (!x?.nextDate) continue;
      const d = Math.floor((new Date(x.nextDate).getTime() - now) / 86400000);
      if (d < 0 || d > 27) continue;
      weeks[Math.floor(d / 7)] += Number(x.effectiveAmount) || 0;
    }
    return weeks;
  }, [recurring]);

  const saveCandidates = useMemo(() =>
    recurring.filter(x => x.active !== false && x.kind !== "bill" && !x.isTrial)
      .map(x => ({ name: pickName(x), domain: pickDomain(x), monthly: stableMonthly(x) }))
      .sort((a, b) => b.monthly - a.monthly)
      .slice(0, 3),
    [recurring]
  );
  const saveX = useMemo(() => saveCandidates.reduce((s, x) => s + x.monthly, 0), [saveCandidates]);

  const dupGroups = useMemo(() => {
    const m = new Map();
    for (const x of recurring.filter(z => z.active !== false)) {
      const key = pickDomain(x) ? `d:${norm(pickDomain(x))}` : `n:${norm(pickName(x))}`;
      const arr = m.get(key) || [];
      arr.push(x);
      m.set(key, arr);
    }
    return Array.from(m.values()).filter(g => g.length >= 2);
  }, [recurring]);

  // 12 months forward for forecast card
  const forecastData = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ monthOffset: i, spend: computeSpendForMonth(recurring, i) })),
    [recurring]
  );

  // 6 months back → current month for trend card (indices 0..5, monthOffset -5..0)
  const monthTrendData = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ monthOffset: i - 5, spend: computeSpendForMonth(recurring, i - 5) })),
    [recurring]
  );

  if (loading) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: SPACING.screen, paddingBottom: 92, gap: SPACING.cardGap }}>
          <InsightsSkeleton />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <RecapSheet visible={recapOpen} onClose={() => setRecapOpen(false)} />
      <ScrollView
        contentContainerStyle={{ padding: SPACING.screen, paddingBottom: 92, gap: SPACING.cardGap }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <BiBRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <BiBRefreshBanner refreshing={refreshing} />
        {/* HEADER */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
          <View>
            <T.Title style={{ fontSize: 28 }}>{tt("insights.title")}</T.Title>
            <T.Sub style={{ marginTop: 2 }}>{tt("insights.titleSub")}</T.Sub>
          </View>
          <PressableScale onPress={() => setRecapOpen(true)}>
            <View style={{
              paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14,
              borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface,
              flexDirection: "row", alignItems: "center", gap: 8,
            }}>
              <Feather name="bar-chart-2" size={16} color={t.text} />
              <T.Sub style={{ fontWeight: "800" }}>{tt("insights.recap")}</T.Sub>
            </View>
          </PressableScale>
        </View>

        {/* HERO CHART */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <T.H2 style={{ fontSize: 16 }}>{tt("insights.cashFlow")}</T.H2>
            <T.Sub style={{ fontWeight: "800" }}>{formatMoney(next30, "USD")}</T.Sub>
          </View>
          <T.Sub style={{ marginTop: 6 }}>{tt("insights.cashFlowSub")}</T.Sub>
          <View style={{ marginTop: 14 }}>
            <ChartCarousel
              weeklyBuckets={weeklyBuckets}
              recurring={recurring}
              monthlyBurn={monthlyBurn}
              tt={tt}
            />
          </View>
        </Card>

        {/* STAT PILLS */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatPill title={tt("insights.monthlyBurn")} value={formatMoney(monthlyBurn, "USD")} rawValue={monthlyBurn} icon="activity" onPress={() => r.push("/recurring")} />
          <StatPill title={tt("insights.trials7d")} value={String(trialsEnding.length)} rawValue={trialsEnding.length} icon="clock" onPress={() => r.push("/recurring?filter=trials")} />
          <StatPill title={tt("insights.next30")} value={formatMoney(next30, "USD")} rawValue={next30} icon="calendar" onPress={() => r.push("/calendar")} />
        </View>

        {/* FORECAST */}
        {recurring.length > 0 && (
          <ForecastCard data={forecastData} tt={tt} />
        )}

        {/* MONTH TREND */}
        {recurring.length > 0 && (
          <MonthTrendCard data={monthTrendData} tt={tt} />
        )}

        {/* OPTIMIZE */}
        <FeatureCard
          title={tt("insights.optimize")}
          subtitle={tt("insights.optimizeSub")}
          right={<Feather name="zap" size={18} color={t.text} />}
          onPress={() => r.push("/optimize")}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <T.Sub style={{ fontWeight: "800" }}>
                {saveX > 0
                  ? tt("insights.potentialSavings").replace("{{amount}}", formatMoney(saveX, "USD"))
                  : tt("insights.noSavingsYet")}
              </T.Sub>
              <T.Sub style={{ marginTop: 4 }}>
                {saveX > 0
                  ? tt("insights.topCosts").replace("{{names}}", saveCandidates.map(x => x.name).join(", "))
                  : tt("insights.addMoreItems")}
              </T.Sub>
            </View>
            <Feather name="chevron-right" size={18} color={t.tertiary} />
          </View>
        </FeatureCard>

        {/* SIGNALS */}
        <Card>
          <T.H2 style={{ fontSize: 16 }}>{tt("insights.whatNext")}</T.H2>
          <T.Sub style={{ marginTop: 6 }}>{tt("insights.whatNextSub")}</T.Sub>
          <View style={{ marginTop: 12, gap: 10 }}>
            {saveX > 0 ? (
              <InsightRow
                icon="trending-down"
                title={tt("insights.possibleSavings").replace("{{amount}}", formatMoney(saveX, "USD"))}
                subtitle={tt("insights.topCosts").replace("{{names}}", saveCandidates.map(x => x.name).join(", "))}
                onPress={() => r.push("/recurring?sort=amount")}
              />
            ) : (
              <InsightRow
                icon="plus-circle"
                title={tt("insights.noSavingsYet")}
                subtitle={tt("insights.addMoreItems")}
                onPress={() => r.push("/add-recurring")}
              />
            )}
            {trialsEnding.length > 0 && (
              <InsightRow
                icon="alert-triangle"
                title={(trialsEnding.length === 1 ? tt("insights.trialsEnding") : tt("insights.trialsEndingPlural")).replace("{{n}}", trialsEnding.length)}
                subtitle={tt("insights.nextEndsDays").replace("{{n}}", daysUntil(trialsEnding[0].raw?.trial_end || trialsEnding[0].raw?.trialEnd))}
                onPress={() => r.push("/recurring?filter=trials")}
              />
            )}
            {dupGroups.length > 0 && (
              <InsightRow
                icon="copy"
                title={(dupGroups.length === 1 ? tt("insights.duplicateGroup") : tt("insights.duplicateGroups")).replace("{{n}}", dupGroups.length)}
                subtitle={tt("insights.samemerchant")}
                onPress={() => r.push("/recurring")}
              />
            )}
            {!emailConnected && (
              <InsightRow
                icon="mail"
                title={tt("insights.improveAccuracy")}
                subtitle={tt("insights.connectInboxAuto")}
                onPress={() => r.push("/account/connected")}
              />
            )}
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}

/* ─── UI components ──────────────────────────────────────────────── */

// Counts up from 0 on mount, then animates between values on change.
function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  const raf = useRef(null);

  useEffect(() => {
    const from = prev.current;
    const to = target;
    prev.current = target;
    if (from === to) return;

    const start = Date.now();
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (to - from) * ease);
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    }
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);

  return display;
}

function StatPill({ title, value, rawValue, icon, onPress }) {
  const t = useTheme();
  // rawValue is a number; value is the already-formatted string for non-numeric fallback
  const animated = useCountUp(typeof rawValue === "number" ? rawValue : 0);
  // Re-format using the same shape as the passed value (money vs integer)
  const displayValue = typeof rawValue === "number"
    ? (String(value).includes(".") || String(value).startsWith("$")
        ? formatMoney(animated, "USD")
        : String(Math.round(animated)))
    : value;

  return (
    <PressableScale
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${displayValue}`}
      style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface, padding: 12, ...t.shadowSm }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Feather name={icon} size={16} color={t.subtext} />
        <Feather name="chevron-right" size={16} color={t.tertiary} />
      </View>
      <T.Sub style={{ marginTop: 8 }}>{title}</T.Sub>
      <T.H2 style={{ marginTop: 4, fontSize: 16 }}>{displayValue}</T.H2>
    </PressableScale>
  );
}

function FeatureCard({ title, subtitle, right, children, onPress }) {
  const t = useTheme();
  return (
    <PressableScale onPress={onPress} style={{ borderRadius: 22, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface, padding: 14, ...t.shadowSm }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <T.H2 style={{ fontSize: 16 }}>{title}</T.H2>
          <T.Sub style={{ marginTop: 4 }}>{subtitle}</T.Sub>
        </View>
        {right}
      </View>
      <View style={{ marginTop: 12 }}>{children}</View>
    </PressableScale>
  );
}

function InsightRow({ icon, title, subtitle, onPress }) {
  const t = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={{ padding: 12, borderRadius: 18, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface2, flexDirection: "row", alignItems: "center", gap: 12 }}
    >
      <View style={{ width: 38, height: 38, borderRadius: 14, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={16} color={t.text} />
      </View>
      <View style={{ flex: 1 }}>
        <T.Sub style={{ fontWeight: "800" }}>{title}</T.Sub>
        <T.Sub style={{ marginTop: 4 }}>{subtitle}</T.Sub>
      </View>
      <Feather name="chevron-right" size={18} color={t.tertiary} />
    </PressableScale>
  );
}

/* ─── Charts ─────────────────────────────────────────────────────── */

function ChartCarousel({ weeklyBuckets, recurring, monthlyBurn, tt }) {
  const t = useTheme();
  const r = useRouter();
  const [idx, setIdx] = useState(2);
  const [swipeLocked, setSwipeLocked] = useState(false);

  const onGesture = (e) => {
    const { translationX, state } = e.nativeEvent;
    if (state !== 5) return;
    if (swipeLocked) return;
    if (translationX > 60) setIdx(v => (v - 1 + 3) % 3);
    if (translationX < -60) setIdx(v => (v + 1) % 3);
    setSwipeLocked(true);
    setTimeout(() => setSwipeLocked(false), 350);
  };

  const pieData = useMemo(() => {
    const items = (recurring || [])
      .filter(x => x?.active !== false)
      .map(x => ({ label: pickName(x), v: stableMonthly(x) }))
      .filter(x => x.v > 0)
      .sort((a, b) => b.v - a.v);

    if (items.length === 0) return { slices: [], total: 1 };

    // Single item: show as full ring (359.9° to avoid SVG artifact)
    const top = items.slice(0, 5);
    const other = items.slice(5).reduce((s, x) => s + x.v, 0);
    const res = other > 0 ? [...top, { label: "Other", v: other }] : top;
    const total = res.reduce((s, x) => s + x.v, 0) || 1;
    return { slices: res, total };
  }, [recurring]);

  const lineSeries = useMemo(() => {
    const now = Date.now();
    const pts = new Array(28).fill(0);
    for (const x of recurring || []) {
      if (!x?.nextDate) continue;
      const d = Math.floor((new Date(x.nextDate).getTime() - now) / 86400000);
      if (d >= 0 && d <= 27) pts[d] += Number(x.effectiveAmount) || 0;
    }
    let run = 0;
    return pts.map(v => (run += v));
  }, [recurring]);

  const hasData = recurring.length > 0;

  const chartTitles = [
    tt("insights.weeklySpend"),
    tt("insights.projectedSpend"),
    tt("insights.monthlyDist"),
  ];
  const chartSubs = [
    tt("insights.weeklySpendSub"),
    tt("insights.projectedSpendSub"),
    tt("insights.monthlyDistSub"),
  ];

  return (
    <PanGestureHandler onHandlerStateChange={onGesture}>
      <View style={{ borderRadius: 22, backgroundColor: t.surface, padding: 14, ...t.shadowSm }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <View>
            <T.Sub style={{ fontWeight: "900" }}>{chartTitles[idx]}</T.Sub>
            <T.Sub style={{ marginTop: 2 }}>{chartSubs[idx]}</T.Sub>
          </View>
          <T.Sub style={{ fontWeight: "800" }}>{formatMoney(monthlyBurn, "USD")}</T.Sub>
        </View>

        <View style={{ minHeight: 180 }}>
          {!hasData ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 180, gap: 12 }}>
              <Feather name="bar-chart-2" size={32} color={t.hairline} />
              <T.Sub style={{ textAlign: "center" }}>{tt("insights.noDataYet")}</T.Sub>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <PressableScale
                  onPress={() => r.push("/add-recurring")}
                  style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: t.accent }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{tt("insights.addManually")}</Text>
                </PressableScale>
                <PressableScale
                  onPress={() => r.push("/account/connect-email")}
                  style={{ paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hairline }}
                >
                  <Text style={{ color: t.text, fontWeight: "800", fontSize: 13 }}>{tt("insights.scanInbox")}</Text>
                </PressableScale>
              </View>
            </View>
          ) : (
            <>
              {idx === 0 && <WeeklyBarChart values={weeklyBuckets} tt={tt} />}
              {idx === 1 && <SmoothLineChart values={lineSeries} tt={tt} />}
              {idx === 2 && <RingChart slices={pieData.slices} total={pieData.total} center={formatMoney(monthlyBurn, "USD")} tt={tt} />}
            </>
          )}
        </View>

        {/* dots */}
        <View style={{ flexDirection: "row", gap: 6, marginTop: 12, alignSelf: "center" }}>
          {[0, 1, 2].map((i) => (
            <PressableScale
              key={i}
              onPress={() => setIdx(i)}
              accessible={true}
              accessibilityRole="tab"
              accessibilityLabel={chartTitles[i]}
              accessibilityState={{ selected: i === idx }}
            >
              <View style={{ width: i === idx ? 18 : 8, height: 8, borderRadius: 99, backgroundColor: i === idx ? t.accent : t.hairline }} />
            </PressableScale>
          ))}
        </View>
      </View>
    </PanGestureHandler>
  );
}

function WeeklyBarChart({ values, tt }) {
  const t = useTheme();
  const [selected, setSelected] = useState(null);
  // Guard: ensure we always have 4 values, handle all-zero case
  const safe = (values || [0, 0, 0, 0]).map(v => Number(v) || 0);
  const maxVal = Math.max(...safe);
  const max = maxVal > 0 ? maxVal : 1; // prevent division by zero
  const active = selected ?? safe.reduce((bestI, v, i) => v > safe[bestI] ? i : bestI, 0);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ marginBottom: 8, alignItems: "center" }}>
        <T.Sub>{tt("insights.week").replace("{{n}}", active + 1)}</T.Sub>
        <T.H2 style={{ fontSize: 16 }}>{formatMoney(safe[active] || 0, "USD")}</T.H2>
      </View>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingHorizontal: 8, minHeight: 120 }}>
        {safe.map((v, i) => {
          // Minimum visible height even for $0 bars
          const pct = maxVal > 0 ? v / max : 0;
          const h = Math.max(8, pct * 100);
          const isActive = i === active;
          return (
            <PressableScale key={i} onPress={() => setSelected(i)} accessible={true} accessibilityRole="button" accessibilityLabel={`Week ${i + 1}: ${formatMoney(v, "USD")}`} style={{ alignItems: "center", flex: 1 }}>
              <View style={{
                width: isActive ? 14 : 12, height: h, borderRadius: 100,
                backgroundColor: isActive ? t.accent : t.accent + "66",
                marginBottom: 4,
              }} />
              <T.Sub style={{ fontSize: 11 }}>W{i + 1}</T.Sub>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function SmoothLineChart({ values, tt }) {
  const t = useTheme();
  const [selected, setSelected] = useState(null);

  const W = 320; const H = 120; const pad = 16;
  // Safe values - handle single point and all-zero
  const safe = (values || []).filter((_, i) => i % 2 === 0); // downsample to 14 pts for clarity
  const maxVal = Math.max(...safe.map(v => Number(v) || 0));
  const max = maxVal > 0 ? maxVal : 1;

  const points = safe.map((v, i) => ({
    x: pad + (safe.length < 2 ? (W - pad * 2) / 2 : (i / (safe.length - 1)) * (W - pad * 2)),
    y: pad + (1 - (Number(v) || 0) / max) * (H - pad * 2),
    v: Number(v) || 0,
  }));

  // For single point, duplicate so line renders
  const renderPoints = points.length === 1
    ? [{ ...points[0], x: pad }, { ...points[0], x: W - pad }]
    : points;

  const path = createSmoothPath(renderPoints);
  const activeIndex = selected !== null ? Math.min(selected, points.length - 1) : points.length - 1;
  const activeValue = points[activeIndex]?.v || 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ marginBottom: 8, alignItems: "center" }}>
        <T.Sub>{selected !== null ? tt("insights.day").replace("{{n}}", activeIndex * 2 + 1) : tt("insights.today")}</T.Sub>
        <T.H2 style={{ fontSize: 16 }}>{formatMoney(activeValue, "USD")}</T.H2>
      </View>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Path d={path} stroke={t.accent} strokeWidth="3" fill="none" strokeLinecap="round" />
        {points.map((p, i) => (
          <Circle
            key={i} cx={p.x} cy={p.y}
            r={i === activeIndex ? 6 : 3}
            fill={t.accent}
            opacity={i === activeIndex ? 1 : 0.35}
            onPress={() => setSelected(i)}
          />
        ))}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
        <T.Sub style={{ fontSize: 11 }}>{tt("insights.today")}</T.Sub>
        <T.Sub style={{ fontSize: 11 }}>{tt("insights.projected").replace("{{amount}}", formatMoney(activeValue, "USD"))}</T.Sub>
      </View>
    </View>
  );
}

function MiniBarChart({ data, selected, onSelect, accentFn }) {
  const t = useTheme();
  const maxSpend = Math.max(...data.map((d) => d.spend), 1);
  const now = new Date();

  function monthLabel(offset) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset);
    return d.toLocaleDateString("default", { month: "short" });
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 90, gap: 3, marginTop: 10 }}>
      {data.map((d, i) => {
        const pct = d.spend / maxSpend;
        const h = Math.max(6, pct * 68);
        const color = accentFn(i, d, t);
        return (
          <PressableScale
            key={i}
            onPress={() => onSelect(i)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${monthLabel(d.monthOffset)}: ${formatMoney(d.spend, "USD")}`}
            style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}
          >
            <View style={{ width: "100%", height: h, borderRadius: 6, backgroundColor: color }} />
            <T.Sub style={{ fontSize: 9, marginTop: 3 }} numberOfLines={1}>
              {monthLabel(d.monthOffset)}
            </T.Sub>
          </PressableScale>
        );
      })}
    </View>
  );
}

function ForecastCard({ data, tt }) {
  const t = useTheme();
  const [selected, setSelected] = useState(0);

  const annualTotal = data.reduce((s, d) => s + d.spend, 0);
  const now = new Date();
  function monthLabel(offset) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset);
    return d.toLocaleDateString("default", { month: "short" });
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <T.H2 style={{ fontSize: 16 }}>{tt("insights.forecast")}</T.H2>
        <T.Sub style={{ fontWeight: "800", flexShrink: 1, textAlign: "right" }}>
          {tt("insights.forecastAnnual").replace("{{amount}}", formatMoney(annualTotal, "USD"))}
        </T.Sub>
      </View>
      <T.Sub style={{ marginTop: 4 }}>{tt("insights.forecastSub")}</T.Sub>
      <View style={{ marginTop: 10, alignItems: "center" }}>
        <T.Sub>{monthLabel(data[selected].monthOffset)}</T.Sub>
        <T.H2 style={{ fontSize: 20 }}>{formatMoney(data[selected].spend, "USD")}</T.H2>
      </View>
      <MiniBarChart
        data={data}
        selected={selected}
        onSelect={setSelected}
        accentFn={(i, _d, t) => (i === selected ? t.accent : t.accent + "44")}
      />
    </Card>
  );
}

function MonthTrendCard({ data, tt }) {
  const t = useTheme();
  const [selected, setSelected] = useState(5); // default = current month

  const current = data[5]?.spend ?? 0;
  const lastMonth = data[4]?.spend ?? 0;
  const deltaPct = lastMonth > 0.5 ? ((current - lastMonth) / lastMonth) * 100 : 0;
  const deltaUp = deltaPct > 0;

  const deltaStr =
    Math.abs(deltaPct) < 1
      ? tt("insights.flatVsLastMonth")
      : tt("insights.vsLastMonth").replace("{{pct}}", (deltaUp ? "+" : "") + Math.round(deltaPct));

  const now = new Date();
  function monthLabel(offset) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset);
    return d.toLocaleDateString("default", { month: "short" });
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <T.H2 style={{ fontSize: 16, flex: 1 }}>{tt("insights.monthTrend")}</T.H2>
        <View
          style={{
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 99,
            backgroundColor: deltaUp ? "#7F1D1D22" : "#064E3B22",
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: deltaUp ? "#F87171" : "#34D399" }}>
            {deltaStr}
          </Text>
        </View>
      </View>
      <T.Sub style={{ marginTop: 4 }}>{tt("insights.monthTrendSub")}</T.Sub>
      <View style={{ marginTop: 10, alignItems: "center" }}>
        <T.Sub>{monthLabel(data[selected].monthOffset)}</T.Sub>
        <T.H2 style={{ fontSize: 20 }}>{formatMoney(data[selected].spend, "USD")}</T.H2>
      </View>
      <MiniBarChart
        data={data}
        selected={selected}
        onSelect={setSelected}
        accentFn={(i, d, t) => {
          if (i === selected) return t.accent;
          if (d.monthOffset === 0) return t.accent + "88";
          return t.accent + "33";
        }}
      />
    </Card>
  );
}

function RingChart({ slices, total, center, tt }) {
  const t = useTheme();
  const [selected, setSelected] = useState(null);
  const size = 140; const stroke = 16;
  const radius = (size - stroke) / 2;
  const cx = size / 2; const cy = size / 2;

  const colors = [t.accent, "#FF3B30", "#30D158", "#FFD60A", "#64D2FF", "#AF52DE"];

  // Empty state
  if (!slices || slices.length === 0) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", minHeight: 160 }}>
        <T.Sub>{tt("insights.noDataYet")}</T.Sub>
      </View>
    );
  }

  let angle = 0;
  const arcs = slices.map((s, i) => {
    const pct = Math.max(s.v / total, 0.001); // minimum visible arc
    const sweep = pct * 359.9; // never full 360 to avoid SVG artifact
    const start = angle;
    angle += sweep;
    return { ...s, start, sweep, color: colors[i % colors.length] };
  });

  const displayLabel = selected !== null ? slices[selected]?.label : tt("insights.monthly_share");
  const displayValue = selected !== null ? formatMoney(slices[selected]?.v, "USD") : center;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        <Svg width={size} height={size}>
          {/* Background track */}
          <Circle cx={cx} cy={cy} r={radius} stroke={t.hairline} strokeWidth={stroke} fill="none" />
          {arcs.map((arc, i) => (
            <Path
              key={i}
              d={arcPath(cx, cy, radius, arc.start, arc.start + arc.sweep)}
              stroke={arc.color}
              strokeWidth={selected === i ? stroke + 4 : stroke}
              strokeLinecap="butt"
              fill="none"
              onPress={() => setSelected(selected === i ? null : i)}
            />
          ))}
        </Svg>
        <View style={{ position: "absolute", alignItems: "center" }}>
          <T.Sub style={{ fontSize: 11, textAlign: "center" }} numberOfLines={1}>{displayLabel}</T.Sub>
          <T.H2 style={{ fontSize: 15, textAlign: "center" }}>{displayValue}</T.H2>
        </View>
      </View>
      <View style={{ marginTop: 14, width: "100%", gap: 6 }}>
        {arcs.slice(0, 5).map((arc, i) => (
          <PressableScale key={i} onPress={() => setSelected(selected === i ? null : i)}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: arc.color,
              ...(selected === i ? { width: 12, height: 12 } : {}) }} />
            <T.Sub style={{ flex: 1 }} numberOfLines={1}>{arc.label}</T.Sub>
            <T.Sub style={{ fontWeight: "700", fontSize: 12 }}>
              {Math.round((arc.v / total) * 100)}%
            </T.Sub>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}