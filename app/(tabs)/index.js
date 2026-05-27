// app/(tabs)/index.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, ScrollView, Text, Pressable, InteractionManager } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { MotiView } from "moti";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Screen from "../../components/Screen";
import Card from "../../components/Card";
import Button from "../../components/Button";
import PressableScale from "../../components/PressableScale";
import ListItem from "../../components/ListItem";
import BrandAvatar from "../../components/BrandAvatar";
import ProofModal from "../../components/ProofModal";
import ContextMenuSheet from "../../components/ContextMenuSheet";
import CelebrationSheet from "../../components/CelebrationSheet";
import HomeSkeleton from "../../components/HomeSkeleton";
import { BiBRefreshControl, BiBRefreshBanner } from "../../components/BiBRefreshControl";
import TrialRadarCard from "../../components/TrialRadarCard";
import EmptyStateCard from "../../components/EmptyStateCard";
import HomeSection from "../../components/HomeSection";
import { scheduleTrialReminder } from "../../lib/notifications";
import { getCreepScore, getGuardianStreak, getOnThisDay } from "../../lib/emailImportClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OnThisDayCard from "../../components/OnThisDayCard";
import GuardianStreakCard from "../../components/GuardianStreakCard";
import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { useOnboardingStore } from "../../lib/onboardingStore";
import { useToast } from "../../components/ToastProvider";
import { track } from "../../lib/analytics";
import { formatMoney } from "../../lib/utils";
import { fmtDateShort } from "../../lib/formatters";

import { SPACING } from "../../lib/ui/tokens";
import { VStack } from "../../components/ui/Stack";
import { useRecordingStore } from "../../lib/recordingMode";

// Accent for urgent / upcoming cards (violet from the design — matches t.primary in dark mode)
const ACCENT_VIOLET = "#7C3AED";
const ACCENT_INDIGO = "#5B7CFF";

function pickDomain(x) {
  return x?.domain || x?.raw?.domain || x?.fromDomain || x?.raw?.fromDomain || "";
}
function pickName(x) {
  return x?.name || x?.raw?.merchant || x?.raw?.title || x?.title || "";
}
function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}

// TASK 4: Advance a past renewal date by its billing interval until it's in the future.
// Returns the projected ISO date string, or null if the date is past and interval is unknown.
function projectNextDate(dateStr, cadence) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > Date.now()) return dateStr; // already future
  if (!cadence) return null;                    // overdue, can't project
  const t = new Date(d);
  const now = Date.now();
  let i = 0;
  while (t.getTime() <= now && i++ < 500) {
    if      (cadence === "yearly")      t.setFullYear(t.getFullYear() + 1);
    else if (cadence === "semiannual")  t.setMonth(t.getMonth() + 6);
    else if (cadence === "quarterly")   t.setMonth(t.getMonth() + 3);
    else if (cadence === "biweekly")    t.setDate(t.getDate() + 14);
    else if (cadence === "weekly")      t.setDate(t.getDate() + 7);
    else                                t.setMonth(t.getMonth() + 1); // monthly default
  }
  return t.toISOString();
}
function cadenceFactor(c) {
  return c === "yearly" ? 1 / 12 : c === "quarterly" ? 1 / 3 : c === "weekly" ? 4.345 : 1;
}

// ── New Hero (matches BIB App.html HomeScreen design) ─────────────────────────
function HeroSection({
  t, tt, recurring, urgentItems, candidateCount,
  displayName, greetingKey,
  onSearch, onBell, onPressUrgent, onPressReview,
}) {
  const monthlySpend = useMemo(() => {
    return (recurring || []).reduce((sum, x) => {
      const amt = Number(x?.effectiveAmount ?? x?.amount ?? 0) || 0;
      const n = Number(x?.sharedCount ?? 1);
      const div = x?.shared && Number.isFinite(n) && n >= 1 ? n : 1;
      const cf = cadenceFactor(x?.cadence || "monthly");
      return sum + (amt / div) * cf;
    }, 0);
  }, [recurring]);

  const subMonthly = useMemo(() =>
    (recurring || []).filter(x => x.kind === "subscription").reduce((s, x) => {
      const amt = Number(x?.effectiveAmount ?? x?.amount ?? 0) || 0;
      return s + amt * cadenceFactor(x?.cadence || "monthly");
    }, 0),
  [recurring]);

  const billMonthly = useMemo(() =>
    (recurring || []).filter(x => x.kind === "bill").reduce((s, x) => {
      const amt = Number(x?.effectiveAmount ?? x?.amount ?? 0) || 0;
      return s + amt * cadenceFactor(x?.cadence || "monthly");
    }, 0),
  [recurring]);

  const subCount   = (recurring || []).filter(x => x.kind === "subscription").length;
  const billCount  = (recurring || []).filter(x => x.kind === "bill").length;
  const trialCount = (recurring || []).filter(x => x.status === "trial" || x.isTrial).length;

  const intStr  = Math.floor(monthlySpend).toLocaleString("en-US");
  const decStr  = "." + monthlySpend.toFixed(2).split(".")[1];
  const yearStr = Math.round(monthlySpend * 12).toLocaleString("en-US");

  const nameInitial = (displayName || "?")[0].toUpperCase();
  const greeting    = tt(greetingKey);

  const hasUrgent  = urgentItems.length > 0;
  const hasReview  = candidateCount > 0;
  const showStrip  = hasUrgent || hasReview;

  const stats = [
    { label: tt("home.statsSubscriptions"), val: `${subCount}`,   sub: `${formatMoney(subMonthly, "USD")}/mo`,          glow: ACCENT_VIOLET, count: subCount },
    { label: tt("home.statsBills"),         val: `${billCount}`,  sub: `${formatMoney(billMonthly, "USD")}/mo`,         glow: ACCENT_INDIGO, count: billCount },
    { label: tt("home.statsTrials"),        val: `${trialCount}`, sub: trialCount > 0 ? tt("home.statsTrialSub") : "—", glow: "#FFD60A",     count: trialCount },
  ];
  // TASK 3: hide zero-count tiles
  const visibleStats = stats.filter((s) => s.count > 0);

  return (
    <View style={{ position: "relative" }}>
      {/* Ambient glow orbs — approximate the blur glows from the design */}
      <View style={{
        position: "absolute", top: -50, right: -40,
        width: 180, height: 180, borderRadius: 90,
        backgroundColor: ACCENT_VIOLET, opacity: 0.08,
      }} pointerEvents="none" />
      <View style={{
        position: "absolute", top: 180, left: -50,
        width: 140, height: 140, borderRadius: 70,
        backgroundColor: ACCENT_INDIGO, opacity: 0.06,
      }} pointerEvents="none" />

      {/* ── Greeting row ── */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <LinearGradient
            colors={["#F43F5E", "#6366F1"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900", color: "#fff" }}>{nameInitial}</Text>
          </LinearGradient>
          <View>
            <Text style={{ fontSize: 11, fontWeight: "700", color: t.tertiary, letterSpacing: 0.4, textTransform: "uppercase" }}>
              {greeting}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: t.text, letterSpacing: -0.3, marginTop: 1 }}>
              {displayName}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={onSearch}
            hitSlop={8}
            accessibilityRole="button"
            style={{
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Feather name="search" size={15} color={t.subtext} />
          </Pressable>
          <Pressable
            onPress={onBell}
            hitSlop={8}
            accessibilityRole="button"
            style={{
              width: 38, height: 38, borderRadius: 12,
              backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Feather name="bell" size={15} color={t.subtext} />
          </Pressable>
        </View>
      </View>

      {/* ── Monthly spend hero ── */}
      <View style={{ marginBottom: 4 }}>
        <Text style={{
          fontSize: 11, fontWeight: "800", color: t.tertiary,
          textTransform: "uppercase", letterSpacing: 1, marginBottom: 8,
        }}>
          {tt("home.monthlySpend")}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 2 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: t.tertiary, marginTop: 10 }}>$</Text>
          <Text style={{ fontSize: 68, fontWeight: "900", color: t.text, letterSpacing: -3, lineHeight: 72 }}>
            {intStr}
          </Text>
          <Text style={{ fontSize: 30, fontWeight: "900", color: t.tertiary, letterSpacing: -1, lineHeight: 72, marginTop: 6 }}>
            {decStr}
          </Text>
        </View>
        <Text style={{ fontSize: 12, fontWeight: "600", color: t.tertiary, marginTop: 10 }}>
          {tt("home.yearlyProjected", { yearly: yearStr })}
        </Text>
      </View>

      {/* ── Stats row (TASK 3: only render tiles with count > 0) ── */}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 22 }}>
        {visibleStats.length > 0 ? visibleStats.map((s) => (
          <View key={s.label} style={{
            flex: 1, backgroundColor: t.surface, borderRadius: 14, padding: 12,
            borderWidth: 1, borderColor: t.hairline, overflow: "hidden",
          }}>
            {/* Corner glow orb */}
            <View style={{
              position: "absolute", top: -10, right: -10,
              width: 40, height: 40, borderRadius: 20,
              backgroundColor: s.glow, opacity: 0.14,
            }} pointerEvents="none" />
            <Text style={{ fontSize: 10, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 0.7 }}>
              {s.label}
            </Text>
            <Text style={{ fontSize: 22, fontWeight: "900", color: t.text, letterSpacing: -0.8, marginTop: 4, lineHeight: 26 }}>
              {s.val}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: "600", color: t.subtext, marginTop: 3 }}>
              {s.sub}
            </Text>
          </View>
        )) : (
          <View style={{
            flex: 1, backgroundColor: t.surface, borderRadius: 14, padding: 14,
            borderWidth: 1, borderColor: t.hairline,
          }}>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.subtext }}>
              {tt("home.statsEmpty")}
            </Text>
          </View>
        )}
      </View>

      {/* ── Urgent / review strip ── */}
      {showStrip && (
        <Pressable
          onPress={hasUrgent ? onPressUrgent : onPressReview}
          style={{ marginTop: 16, borderRadius: 18, overflow: "hidden" }}
        >
          <LinearGradient
            colors={[ACCENT_VIOLET + "30", ACCENT_VIOLET + "10"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
              borderWidth: 1, borderColor: ACCENT_VIOLET + "50", borderRadius: 18,
            }}
          >
            <View style={{
              width: 38, height: 38, borderRadius: 11,
              backgroundColor: ACCENT_VIOLET + "30", borderWidth: 1, borderColor: ACCENT_VIOLET + "55",
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather
                name={hasUrgent ? "bell" : "mail"}
                size={15}
                color={ACCENT_VIOLET}
              />
            </View>

            <View style={{ flex: 1 }}>
              {hasUrgent ? (
                <>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: t.text }}>
                    {urgentItems.length === 1
                      ? tt("home.renewalThisWeek")
                      : tt("home.renewalsThisWeek", { n: urgentItems.length })}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: "500", color: t.subtext, marginTop: 2 }}>
                    {urgentItems.slice(0, 3).map(x => x.title || x.merchant || x.name || "").join(" · ")}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 13, fontWeight: "800", color: t.text }}>
                    {candidateCount === 1
                      ? tt("home.reviewDetections", { n: candidateCount })
                      : tt("home.reviewDetectionsPlural", { n: candidateCount })}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: "500", color: t.subtext, marginTop: 2 }}>
                    {tt("home.fromInboxScan")}
                  </Text>
                </>
              )}
            </View>

            <View style={{
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
              backgroundColor: ACCENT_VIOLET + "33",
            }}>
              <Text style={{ fontSize: 9, fontWeight: "900", color: ACCENT_VIOLET, letterSpacing: 0.6 }}>
                REVIEW
              </Text>
            </View>
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

// ── Upcoming horizontal scroll (replaces UpcomingTabs) ────────────────────────
function UpcomingHScroll({ t, tt, items, onPressItem, onSeeAll }) {
  if (items.length === 0) return null;

  return (
    <View>
      {/* Section header */}
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: t.text, letterSpacing: -0.6 }}>
          {tt("home.upcoming")}
        </Text>
        <Pressable onPress={onSeeAll} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
          <Text style={{ fontSize: 12, fontWeight: "800", color: ACCENT_VIOLET }}>
            {tt("home.seeAll")}
          </Text>
          <Feather name="chevron-right" size={12} color={ACCENT_VIOLET} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingRight: 4 }}
      >
        {items.map((item) => {
          const days  = daysUntil(item.nextDate);
          // TASK 2: only urgent when days is a non-negative value ≤ 7
          const urgnt = days !== null && days >= 0 && days <= 7;

          return (
            <Pressable
              key={`${item.kind}-${item.id}`}
              onPress={() => onPressItem(item)}
              style={{ width: 128 }}
            >
              <LinearGradient
                colors={urgnt
                  ? [ACCENT_VIOLET + "38", ACCENT_VIOLET + "12"]
                  : [t.surface, t.surface]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 18, padding: 14,
                  borderWidth: 1,
                  borderColor: urgnt ? ACCENT_VIOLET + "55" : t.hairline,
                  overflow: "hidden",
                }}
              >
                {/* Urgent glow orb */}
                {urgnt && (
                  <View style={{
                    position: "absolute", top: -14, right: -14,
                    width: 48, height: 48, borderRadius: 24,
                    backgroundColor: ACCENT_VIOLET, opacity: 0.22,
                  }} pointerEvents="none" />
                )}

                {/* Logo row */}
                <View style={{
                  flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 12,
                }}>
                  <BrandAvatar
                    domain={item.domain}
                    name={item.name}
                    size={34}
                    billIconKey={item.billIconKey}
                  />
                  {/* TASK 2: overdue → red badge; null → nothing; future → day count */}
                  {(item.overdue || days !== null) && (
                    <View style={{
                      paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5,
                      backgroundColor: item.overdue
                        ? "#FF3B3022"
                        : urgnt ? ACCENT_VIOLET + "33" : t.surface2,
                    }}>
                      <Text style={{
                        fontSize: 9, fontWeight: "900", letterSpacing: 0.5,
                        color: item.overdue ? "#FF3B30" : urgnt ? ACCENT_VIOLET : t.tertiary,
                      }}>
                        {item.overdue ? "OVERDUE" : `${days}D`}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={{ fontSize: 13, fontWeight: "800", color: t.text }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={{ fontSize: 13, fontWeight: "900", color: t.text, marginTop: 4, letterSpacing: -0.3 }}>
                  {formatMoney(item.amount, item.currency || "USD")}
                </Text>
                <Text style={{ fontSize: 10, fontWeight: "600", color: t.tertiary, marginTop: 2 }}>
                  {item.nextDate ? fmtDateShort(item.nextDate) : "—"}
                </Text>
              </LinearGradient>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── All recurring compact list ────────────────────────────────────────────────
function AllRecurringList({ t, tt, items, onPressItem, onLongPressItem, onSeeAll }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 5);

  return (
    <View>
      <View style={{
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <Text style={{ fontSize: 18, fontWeight: "900", color: t.text, letterSpacing: -0.6 }}>
          {tt("home.allRecurring")}
        </Text>
        <Text style={{ fontSize: 11, fontWeight: "700", color: t.tertiary }}>
          {items.length} {tt("home.items")}
        </Text>
      </View>

      <View style={{
        backgroundColor: t.surface, borderRadius: 18,
        borderWidth: 1, borderColor: t.hairline, overflow: "hidden",
      }}>
        {shown.map((item, i) => (
          <View
            key={`${item.kind}-${item.id}`}
            style={i < shown.length - 1
              ? { borderBottomWidth: 1, borderBottomColor: t.hairline }
              : {}
            }
          >
            <ListItem
              merchant={item.name}
              subtitle={item.subtitle}
              overdue={item.overdue}
              amount={item.amount}
              currency={item.currency}
              domain={item.domain}
              sharedCount={item.sharedCount}
              isShared={item.isShared}
              billIconKey={item.billIconKey}
              index={i}
              onPress={() => onPressItem(item)}
              onLongPress={() => onLongPressItem?.(item)}
            />
          </View>
        ))}
        {items.length > 5 && (
          <Pressable
            onPress={onSeeAll}
            style={{
              padding: 14, alignItems: "center",
              borderTopWidth: 1, borderTopColor: t.hairline,
            }}
          >
            <Text style={{ color: ACCENT_VIOLET, fontWeight: "800", fontSize: 13 }}>
              {tt("home.seeAll")} ({items.length - 5} more)
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Creep Score Card ──────────────────────────────────────────────────────────
function CreepScoreCard({ score, t, tt }) {
  const s = score?.score ?? 100;
  const pct = Math.abs(s - 100);

  let bgColors, borderColor, dotColor, labelText;
  if (s <= 100) {
    bgColors    = ["#064E3B", "#065F46"];
    borderColor = "#34D39944";
    dotColor    = "#34D399";
    labelText   = tt("home.creepScore.onTrack");
  } else if (s <= 120) {
    bgColors    = ["#78350F", "#92400E"];
    borderColor = "#F59E0B44";
    dotColor    = "#F59E0B";
    labelText   = tt("home.creepScore.growing", { pct });
  } else {
    bgColors    = ["#7F1D1D", "#991B1B"];
    borderColor = "#EF444444";
    dotColor    = "#EF4444";
    labelText   = tt("home.creepScore.high", { pct });
  }

  return (
    <View style={{ borderRadius: 18, overflow: "hidden" }}>
      <LinearGradient
        colors={bgColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          flexDirection: "row", alignItems: "center",
          paddingVertical: 16, paddingHorizontal: 18, borderRadius: 18,
          borderWidth: 1, borderColor, gap: 12,
        }}
      >
        <View style={{
          width: 36, height: 36, borderRadius: 11,
          backgroundColor: "rgba(0,0,0,0.2)",
          alignItems: "center", justifyContent: "center",
        }}>
          <Feather name="trending-up" size={16} color={dotColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
            {tt("home.creepScore.label")}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 }}>
            {labelText}
          </Text>
        </View>
        <View style={{ paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 999 }}>
          <Text style={{ color: dotColor, fontWeight: "900", fontSize: 13 }}>{s}</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

// ── Action card (for Next Actions section) ────────────────────────────────────
function ActionCard({ t, item, onPress, featured }) {
  const iconMap = {
    recap: { icon: "bar-chart-2", color: t.accent },
    recommendation: { icon: "scissors", color: "#FF3B30" },
    renewal: { icon: "clock", color: "#FF9F0A" },
    bill: { icon: "file-text", color: "#64D2FF" },
  };
  const { icon, color } = iconMap[item.kind] || { icon: "zap", color: t.accent };

  if (featured) {
    return (
      <PressableScale haptic="impactMedium" onPress={onPress} style={{ borderRadius: 18, overflow: "hidden" }}>
        <LinearGradient
          colors={[color + "CC", color + "88"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ padding: 18, flexDirection: "row", alignItems: "center", gap: 14 }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.18)", alignItems: "center", justifyContent: "center" }}>
            <Feather name={icon} size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>{item.title}</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 3, fontSize: 13 }}>{item.detail}</Text>
          </View>
          <Feather name="arrow-right" size={18} color="rgba(255,255,255,0.9)" />
        </LinearGradient>
      </PressableScale>
    );
  }

  return (
    <PressableScale
      haptic="selection"
      onPress={onPress}
      style={{
        borderRadius: 16, padding: 14, borderWidth: 1, borderColor: t.hairline,
        backgroundColor: t.surface, flexDirection: "row", alignItems: "center", gap: 12,
      }}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: color + "22", alignItems: "center", justifyContent: "center" }}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 14 }}>{item.title}</Text>
        <Text style={{ color: t.subtext, marginTop: 2, fontSize: 13 }}>{item.detail}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={t.tertiary} />
    </PressableScale>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Home() {
  const t = useTheme();
  const r = useRouter();
  const toast = useToast();
  const { t: tt } = useTranslation();

  const recordingActive  = useRecordingStore((s) => s.active);
  const recordingPersona = useRecordingStore((s) => s.persona);
  const hydrateRecording = useRecordingStore((s) => s.hydrate);

  const {
    subs, bills, mail,
    loadMail, loadProfile, user, profile,
    fetchSubs, loadSubsLocal, loadBills,
    getActionFeed, getRecurring, notificationSettings,
    savings, updateSub, updateBill, deleteSub, deleteBill,
  } = useStore();

  const emailStateHydrate  = useEmailImportStore((s) => s.hydrate);
  const connectedProvider  = useEmailImportStore((s) => s.connectedProvider);
  const emailStoreHydrated = useEmailImportStore((s) => s.hasHydrated);
  const candidates         = useEmailImportStore((s) => s.candidates);

  const hydrateOnboarding  = useOnboardingStore((s) => s.hydrate);
  const syncFromAppState   = useOnboardingStore((s) => s.syncFromAppState);
  const markStep           = useOnboardingStore((s) => s.markStep);
  const enableDemo         = useOnboardingStore((s) => s.enableDemo);
  const disableDemo        = useOnboardingStore((s) => s.disableDemo);

  const [now, setNow]                           = useState(() => new Date());
  const [savingsDismissed, setSavingsDismissed] = useState(false);
  const [creepScore, setCreepScore]             = useState(null);
  const [guardianStreak, setGuardianStreak]     = useState(null);
  const [onThisDay, setOnThisDay]               = useState(null);
  const [onThisDayDismissed, setOnThisDayDismissed] = useState(false);
  const [proofOpen, setProofOpen]               = useState(false);
  const [proofItem, setProofItem]               = useState(null);
  const [initialLoading, setInitialLoading]     = useState(true);
  const [refreshing, setRefreshing]             = useState(false);
  const [refreshError, setRefreshError]         = useState(false);
  const [contextItem, setContextItem]           = useState(null);
  const [celebration, setCelebration]           = useState(null);

  const openProof = (x) => { setProofItem(x); setProofOpen(true); };

  useEffect(() => {
    hydrateOnboarding?.();
    emailStateHydrate?.();
    hydrateRecording?.();
    track("app_opened");
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(false);
    try {
      await loadMail?.();
      await loadBills?.();
      await loadProfile?.();
      if (user) await fetchSubs?.();
      else await loadSubsLocal?.();
      if (user) {
        getCreepScore().then(setCreepScore).catch(() => {});
        getGuardianStreak().then(setGuardianStreak).catch(() => {});
      }
    } catch (e) {
      if (__DEV__) console.warn("[home] refresh failed:", e?.message);
      setRefreshError(true);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    const timeout = setTimeout(() => setInitialLoading(false), 30_000);

    (async () => {
      try {
        await loadMail?.();
        await loadBills?.();
        await loadSubsLocal?.();
        await loadProfile?.();
      } catch (e) {
        if (__DEV__) console.warn("[home] local load failed:", e?.message);
      } finally {
        clearTimeout(timeout);
        setInitialLoading(false);
      }

      if (user) {
        InteractionManager.runAfterInteractions(() => {
          fetchSubs?.().catch((e) => {
            if (__DEV__) console.warn("[home] background sync failed:", e?.message);
          });
          getCreepScore().then(setCreepScore).catch(() => {});
          getGuardianStreak().then(setGuardianStreak).catch(() => {});
          getOnThisDay().then(async (data) => {
            if (!data) return;
            const todayStr = new Date().toISOString().slice(0, 10);
            const dismissed = await AsyncStorage.getItem("@bib_onthisday_dismissed_v1").catch(() => null);
            if (dismissed !== todayStr) setOnThisDay(data);
          }).catch(() => {});
        });
      }
    })();

    return () => clearTimeout(timeout);
  }, [user]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const recurring = useMemo(
    () => (recordingActive && recordingPersona
      ? recordingPersona.recurring || []
      : getRecurring?.() || []
    ).filter((x) => x.active !== false),
    [recordingActive, recordingPersona, getRecurring, subs, bills]
  );

  useEffect(() => {
    syncFromAppState?.({
      hasAnyRecurring: recurring.length > 0,
      remindersEnabled: !!notificationSettings?.renewalsEnabled,
    });
  }, [recurring, notificationSettings]);

  const actionFeed = useMemo(() => getActionFeed?.() || [], [getActionFeed, subs, bills]);

  function fmtDue(dateStr) {
    if (!dateStr) return "—";
    const days = daysUntil(dateStr);
    if (days === null) return fmtDateShort(dateStr);
    if (days < 0)  return tt("home.overdue");
    if (days === 0) return "today";
    if (days === 1) return "tomorrow";
    if (days <= 14) return `in ${days} days`;
    return fmtDateShort(dateStr);
  }

  // All upcoming items (subs + bills) sorted by due date.
  // TASK 4: uses projectNextDate to advance past renewal dates by billing interval.
  // Overdue items with no known cadence (can't project) are included at the end with overdue=true.
  const allUpcoming = useMemo(() => {
    return recurring
      .map((x) => {
        if (!x.nextDate) return null;  // never had a renewal date — skip
        const projected = projectNextDate(x.nextDate, x.cadence);
        const overdue = projected === null; // past date, no cadence to project forward
        const effectiveDate = projected;   // null when overdue with unknown cadence
        return {
          kind: x.kind, id: x.id,
          name: x.title || x.merchant || x.name || "",
          amount: x.effectiveAmount,
          currency: x.currency || "USD",
          cadence: x.cadence,
          overdue,
          nextDate: effectiveDate,
          subtitle: overdue
            ? tt("home.overdue")
            : (x.kind === "bill"
                ? `bill · due ${fmtDue(effectiveDate)}`
                : `${x.cadence} · renews ${fmtDue(effectiveDate)}`),
          domain: x.domain || x.fromDomain || "",
          sharedCount: Number(x.sharedCount ?? 1) || 1,
          isShared: x.isShared === true,
          billIconKey: x.iconKey || (x.kind === "bill" ? "bill" : undefined),
        };
      })
      .filter(Boolean)                              // drop items with no nextDate at all
      .filter((x) => x.nextDate !== null || x.overdue) // include overdue with no projection
      .sort((a, b) => {
        const da = a.overdue ? 9999 : (daysUntil(a.nextDate) ?? 9998);
        const db = b.overdue ? 9999 : (daysUntil(b.nextDate) ?? 9998);
        return da - db;
      });
  }, [recurring]);

  // TASK 2: derive urgent items from allUpcoming (uses projected dates).
  // Only items with a real future date (not overdue) and due within 7 days.
  const urgentItems = useMemo(() =>
    allUpcoming.filter((x) => {
      if (x.overdue) return false;
      const d = daysUntil(x.nextDate);
      return d !== null && d >= 0 && d <= 7;
    }),
  [allUpcoming]);

  const trialRadarItems = useMemo(() => {
    return recurring
      .map((x) => {
        const trialEndsAt = x.trialEndsAt || x.trial_end_at || x.trial_end_date || null;
        const isTrial = x.status === "trial" || x.isTrial === true || !!trialEndsAt;
        if (!isTrial) return null;
        const d = daysUntil(trialEndsAt);
        if (d == null || d > 14) return null;
        return {
          id: x.id, name: x.title,
          domain: x.domain || x.fromDomain || "",
          trialEndsAt, amount: x.effectiveAmount,
          currency: x.currency || "USD", raw: x,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (daysUntil(a.trialEndsAt) ?? 999) - (daysUntil(b.trialEndsAt) ?? 999));
  }, [recurring]);

  const hour = now.getHours();
  const greetingKey = hour < 12 ? "home.greetingMorning" : hour < 18 ? "home.greetingAfternoon" : "home.greetingEvening";

  const displayName = recordingActive && recordingPersona
    ? recordingPersona.firstName
    : profile?.name ||
      user?.user_metadata?.name ||
      profile?.username ||
      user?.email?.split("@")?.[0] ||
      tt("common.user");

  const emailConnected = !!connectedProvider || !!mail?.connected;
  const candidateCount = candidates?.length || 0;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SPACING.screen,
          paddingBottom: 100,
          gap: SPACING.cardGap,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <BiBRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <BiBRefreshBanner refreshing={refreshing} />

        {refreshError && !refreshing && (
          <View style={{
            padding: 12, borderRadius: 12,
            backgroundColor: "#FF3B3018", borderWidth: 1, borderColor: "#FF3B3033",
          }}>
            <Text style={{ color: "#FF3B30", fontWeight: "700", fontSize: 13 }}>
              {tt("home.refreshError") || "Could not refresh. Check your connection."}
            </Text>
          </View>
        )}

        {/* ── HERO ── */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210 }}
        >
          <HeroSection
            t={t}
            tt={tt}
            recurring={recurring}
            urgentItems={urgentItems}
            candidateCount={candidateCount}
            displayName={displayName}
            greetingKey={greetingKey}
            onSearch={() => r.push("/search")}
            onBell={() => r.push("/account/notifications")}
            onPressUrgent={() => r.push("/recurring")}
            onPressReview={() => r.push("/account/connect-email/review")}
          />
        </MotiView>

        {initialLoading ? (
          <HomeSkeleton />
        ) : (
          <>
            {/* ── UPCOMING HORIZONTAL SCROLL ── */}
            {allUpcoming.length > 0 ? (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 40 }}
              >
                <UpcomingHScroll
                  t={t}
                  tt={tt}
                  items={allUpcoming.slice(0, 8)}
                  onPressItem={(x) => {
                    markStep?.("reviewedUpcoming", true);
                    r.push({ pathname: "/brand", params: { domain: x.domain || "", name: x.name || "" } });
                  }}
                  onSeeAll={() => r.push("/recurring")}
                />
              </MotiView>
            ) : (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 40 }}
              >
                <Card>
                  <EmptyStateCard
                    icon="zap"
                    title={tt("home.noRecurringYet")}
                    body={tt("home.noRecurringBody")}
                    primary={{
                      title: tt("home.scanInbox"),
                      icon: "mail",
                      onPress: () => r.push("/account/connect-email"),
                    }}
                    secondary={{
                      title: tt("home.addManually"),
                      icon: "plus",
                      onPress: () => r.push("/add-recurring"),
                    }}
                  />
                </Card>
              </MotiView>
            )}

            {/* ── ALL RECURRING LIST ── */}
            {allUpcoming.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 60 }}
              >
                <AllRecurringList
                  t={t}
                  tt={tt}
                  items={allUpcoming}
                  onPressItem={(x) => {
                    markStep?.("reviewedUpcoming", true);
                    r.push({ pathname: "/brand", params: { domain: x.domain || "", name: x.name || "" } });
                  }}
                  onLongPressItem={(x) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    setContextItem(x);
                  }}
                  onSeeAll={() => r.push("/recurring")}
                />
              </MotiView>
            )}

            {/* ── SAVINGS TRACKER ── */}
            {(savings?.totalSaved > 0) && !savingsDismissed && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 80 }}
              >
                <View style={{ borderRadius: 18, overflow: "hidden" }}>
                  <LinearGradient
                    colors={["#064E3B", "#065F46"]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={{
                      flexDirection: "row", alignItems: "center",
                      paddingVertical: 16, paddingHorizontal: 18,
                      borderRadius: 18, borderWidth: 1, borderColor: "#34D39944",
                    }}
                  >
                    <Pressable
                      onPress={() => r.push("/recurring")}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}
                    >
                      <Text style={{ fontSize: 24 }}>🎉</Text>
                      <View>
                        <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                          {tt("home.savedAmount", { amount: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(savings.totalSaved) ? savings.totalSaved : 0) })}
                        </Text>
                        <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 }}>
                          {tt("home.cancelledCount", { count: savings.entries?.length || 0 })}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => setSavingsDismissed(true)}
                      hitSlop={10}
                      style={{ padding: 4, marginLeft: 8 }}
                    >
                      <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
                    </Pressable>
                  </LinearGradient>
                </View>
              </MotiView>
            )}

            {/* ── ON THIS DAY ── */}
            {onThisDay && !onThisDayDismissed && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 90 }}
              >
                <OnThisDayCard
                  data={onThisDay}
                  tt={tt}
                  onDismiss={async () => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    await AsyncStorage.setItem("@bib_onthisday_dismissed_v1", todayStr).catch(() => {});
                    setOnThisDayDismissed(true);
                  }}
                />
              </MotiView>
            )}

            {/* ── SUBSCRIPTION CREEP SCORE ── */}
            {creepScore?.score != null && creepScore?.firstScanAt && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 95 }}
              >
                <CreepScoreCard score={creepScore} t={t} tt={tt} />
              </MotiView>
            )}

            {/* ── GUARDIAN STREAK ── */}
            {guardianStreak != null && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 100 }}
              >
                <GuardianStreakCard streak={guardianStreak} tt={tt} />
              </MotiView>
            )}

            {/* ── QUICK ADD ── */}
            <MotiView
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 110 }}
            >
              <Button
                title={tt("home.addRecurring")}
                onPress={() => r.push("/add-recurring")}
                left={<Feather name="plus" size={16} color="#fff" />}
              />
            </MotiView>

            {/* ── CONNECT / CHECK EMAIL ── */}
            {emailStoreHydrated && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 120 }}
              >
                {!emailConnected ? (
                  <Button
                    title={tt("home.connectEmail") || "Connect your email"}
                    variant="secondary"
                    onPress={() => r.push("/account/connect-email")}
                    left={<Feather name="mail" size={16} color={t.text} />}
                  />
                ) : (
                  <Button
                    title={tt("home.checkEmails") || "Check your emails"}
                    variant="secondary"
                    onPress={() => r.push("/account/connect-email/connected")}
                    left={<Feather name="mail" size={16} color={t.text} />}
                  />
                )}
              </MotiView>
            )}

            {/* ── NEXT ACTIONS ── */}
            {actionFeed.length > 0 && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210, delay: 130 }}
              >
                <HomeSection title={tt("home.nextActions")}>
                  <VStack gap={8}>
                    {actionFeed.slice(0, 4).map((a, idx) => (
                      <ActionCard
                        key={`${a.kind}-${idx}`}
                        t={t}
                        item={a}
                        featured={idx === 0 && a.kind === "recommendation"}
                        onPress={() => a.href ? r.push(a.href) : null}
                      />
                    ))}
                  </VStack>
                </HomeSection>
              </MotiView>
            )}

            {/* ── TRIALS ── */}
            {trialRadarItems.length > 0 && (() => {
              const hasUrgent = trialRadarItems?.some(x => (daysUntil(x.trialEndsAt) ?? 99) <= 3) ?? false;
              const hasCritical = trialRadarItems?.some(x => (daysUntil(x.trialEndsAt) ?? 99) <= 1) ?? false;
              return (
                <HomeSection
                  title={tt("home.trialsEndingSoon")}
                  titleStyle={hasUrgent ? { color: "#FF9F0A" } : undefined}
                  right={hasCritical ? <Feather name="alert-triangle" size={16} color="#FF9F0A" /> : undefined}
                >
                  <TrialRadarCard
                    items={trialRadarItems}
                    onPressItem={(x) => openProof({ ...x.raw, name: x.name, domain: x.domain })}
                    onCancel={(x) => r.push({
                      pathname: "/cancel-center",
                      params: {
                        domain: x.domain, name: x.name,
                        plan: x.raw?.plan || x.raw?.tier || "",
                        price: x.amount != null ? `${x.currency || "USD"} ${x.amount}` : "",
                        cadence: x.raw?.cadence || "trial",
                      },
                    })}
                    onRemind={async (x) => {
                      try { await Haptics.selectionAsync(); } catch {}
                      await scheduleTrialReminder({
                        id: x.id, brand: x.name, domain: x.domain,
                        trialEndsAt: x.trialEndsAt, amount: x.amount,
                        currency: x.currency || "USD", daysBefore: 1,
                      });
                      toast.show({ message: `Reminder set for ${x.name}` });
                    }}
                    onKeep={(x) => r.push({
                      pathname: "/brand",
                      params: { domain: pickDomain(x), name: pickName(x) },
                    })}
                  />
                </HomeSection>
              );
            })()}
          </>
        )}
      </ScrollView>

      <ProofModal visible={proofOpen} item={proofItem} onClose={() => setProofOpen(false)} />
      <ContextMenuSheet
        visible={!!contextItem}
        item={contextItem}
        onClose={() => setContextItem(null)}
        onEdit={() => {
          if (!contextItem) return;
          const kind = contextItem.kind === "bill" ? "bill" : "subscription";
          r.push(`/recurring/${kind}/${contextItem.id}`);
        }}
        onArchive={async () => {
          if (!contextItem) return;
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            const result = contextItem.kind === "bill"
              ? await updateBill?.(contextItem.id, { active: false })
              : await updateSub?.(contextItem.id, { active: false });
            if (result?.savedEntry) setCelebration(result.savedEntry);
          } catch (e) {
            if (__DEV__) console.warn("[home] archive failed:", e?.message);
          }
        }}
        onCancel={contextItem?.kind !== "bill" ? () => {
          if (!contextItem) return;
          r.push({
            pathname: "/cancel-center",
            params: { name: contextItem.name || "", domain: contextItem.domain || "", cadence: contextItem.cadence || "" },
          });
        } : null}
      />
      <CelebrationSheet
        visible={!!celebration}
        entry={celebration}
        onDismiss={() => setCelebration(null)}
      />
    </Screen>
  );
}
