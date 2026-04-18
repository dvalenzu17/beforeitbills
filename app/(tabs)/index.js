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
import ProofModal from "../../components/ProofModal";
import ContextMenuSheet from "../../components/ContextMenuSheet";
import CelebrationSheet from "../../components/CelebrationSheet";
import HomeSkeleton from "../../components/HomeSkeleton";
import { BiBRefreshControl, BiBRefreshBanner } from "../../components/BiBRefreshControl";
import MonthlyDigestCard from "../../components/MonthlyDigestCard";
import SetupChecklistCard from "../../components/SetupCheckListCard";
import ScanSummaryCard from "../../components/ScanSummaryCard";
import TrialRadarCard from "../../components/TrialRadarCard";
import EmptyStateCard from "../../components/EmptyStateCard";
import HomeSection from "../../components/HomeSection";
import { scheduleTrialReminder } from "../../lib/notifications";
import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { useOnboardingStore } from "../../lib/onboardingStore";
import { useToast } from "../../components/ToastProvider";
import { track } from "../../lib/analytics";
import { formatMoney } from "../../lib/utils";

import { SPACING } from "../../lib/ui/tokens";
import { VStack } from "../../components/ui/Stack";
import * as T from "../../components/ui/Text";
import { useRecordingStore } from "../../lib/recordingMode";

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

function HeroSection({ t, displayName, urgentCount, candidateCount, emailConnected, greetingKey, tt, onSearch }) {
  const hour = new Date().getHours();
  const greeting = tt(greetingKey) || (hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 210 }}
    >
      <T.Sub style={{ marginBottom: 2 }}>{greeting}</T.Sub>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <T.Title style={{ fontSize: 30, flex: 1 }}>{displayName}</T.Title>
        <Pressable
          onPress={onSearch}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={tt("search.placeholder") || "Search"}
          style={{
            padding: 10, borderRadius: 14,
            borderWidth: 1, borderColor: t.hairline,
            backgroundColor: t.surface,
          }}
        >
          <Feather name="search" size={18} color={t.text} />
        </Pressable>
      </View>

      {/* Urgent / inbox badges only — spend is shown in MonthlyDigestCard */}
      {(urgentCount > 0 || candidateCount > 0 || !emailConnected) && (
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          {urgentCount > 0 && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              backgroundColor: "#FF3B3022", borderRadius: 999,
              paddingHorizontal: 10, paddingVertical: 4,
              borderWidth: 1, borderColor: "#FF3B3044",
            }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#FF3B30" }} />
              <Text style={{ color: "#FF3B30", fontWeight: "800", fontSize: 12 }}>
                {tt("home.urgentCount", { n: urgentCount })}
              </Text>
            </View>
          )}
          {candidateCount > 0 && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              backgroundColor: t.accent + "22", borderRadius: 999,
              paddingHorizontal: 10, paddingVertical: 4,
              borderWidth: 1, borderColor: t.accent + "44",
            }}>
              <Feather name="mail" size={11} color={t.accent} />
              <Text style={{ color: t.accent, fontWeight: "800", fontSize: 12 }}>
                {tt("home.newFromInbox", { n: candidateCount })}
              </Text>
            </View>
          )}
          {!emailConnected && (
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 5,
              backgroundColor: t.surface2, borderRadius: 999,
              paddingHorizontal: 10, paddingVertical: 4,
              borderWidth: 1, borderColor: t.hairline,
            }}>
              <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 12 }}>
                {tt("home.fromManualEntries")}
              </Text>
            </View>
          )}
        </View>
      )}
    </MotiView>
  );
}

// ── Action card ───────────────────────────────────────────────────────────────
function ActionCard({ t, item, onPress }) {
  const iconMap = {
    recap: { icon: "bar-chart-2", color: t.accent },
    recommendation: { icon: "scissors", color: "#FF3B30" },
    renewal: { icon: "clock", color: "#FF9F0A" },
    bill: { icon: "file-text", color: "#64D2FF" },
  };
  const { icon, color } = iconMap[item.kind] || { icon: "zap", color: t.accent };

  return (
    <PressableScale
      haptic="selection"
      onPress={onPress}
      style={{
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: t.surface,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: color + "22",
        alignItems: "center", justifyContent: "center",
      }}>
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

// ── Upcoming tabs ─────────────────────────────────────────────────────────────
function UpcomingTabs({ t, subs, bills, onPressItem, onLongPressItem, tt }) {
  const [tab, setTab] = useState("subscriptions");
  const items = tab === "subscriptions" ? subs : bills;

  return (
    <View>
      {/* Tab pills */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {["subscriptions", "bills"].map((key) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderRadius: 999,
              backgroundColor: tab === key ? t.accent : t.surface2,
              borderWidth: 1,
              borderColor: tab === key ? t.accent : t.hairline,
            }}
          >
            <Text style={{
              color: tab === key ? "#fff" : t.subtext,
              fontWeight: "800",
              fontSize: 13,
              textTransform: "capitalize",
            }}>
              {tt(`home.${key}`)} {items.length > 0 && tab === key ? `(${items.length})` : ""}
            </Text>
          </Pressable>
        ))}
      </View>

      {items.length === 0 ? (
        <View style={{
          padding: 20, borderRadius: 16,
          backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline,
          alignItems: "center",
        }}>
          <Text style={{ color: t.subtext, fontWeight: "600" }}>
            No {tab} yet
          </Text>
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          {items.map((x, i) => (
            <ListItem
              key={`${x.kind}-${x.id}`}
              merchant={x.name}
              subtitle={x.subtitle}
              amount={x.amount}
              currency={x.currency}
              domain={x.domain}
              sharedCount={x.sharedCount}
              isShared={x.isShared}
              billIconKey={x.billIconKey}
              index={i}
              onPress={() => onPressItem(x)}
              onLongPress={() => onLongPressItem?.(x)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function Home() {
  const t = useTheme();
  const r = useRouter();
  const toast = useToast();
  const { t: tt } = useTranslation();

  const recordingActive = useRecordingStore((s) => s.active);
  const recordingPersona = useRecordingStore((s) => s.persona);
  const hydrateRecording = useRecordingStore((s) => s.hydrate);

  const {
    subs, bills, mail,
    loadMail, loadProfile, user, profile,
    fetchSubs, loadSubsLocal, loadBills,
    getActionFeed, getRecurring, notificationSettings,
    savings, updateSub, updateBill, deleteSub, deleteBill,
  } = useStore();

  const emailStateHydrate = useEmailImportStore((s) => s.hydrate);
  const connectedProvider = useEmailImportStore((s) => s.connectedProvider);
  const lastScanAt = useEmailImportStore((s) => s.lastScanAt);
  const lastStats = useEmailImportStore((s) => s.lastStats);
  const candidates = useEmailImportStore((s) => s.candidates);

  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const syncFromAppState = useOnboardingStore((s) => s.syncFromAppState);
  const markStep = useOnboardingStore((s) => s.markStep);
  const enableDemo = useOnboardingStore((s) => s.enableDemo);
  const disableDemo = useOnboardingStore((s) => s.disableDemo);
  const dismissChecklist = useOnboardingStore((s) => s.dismissChecklist);
  const dismissed = useOnboardingStore((s) => s.dismissed);
  const steps = useOnboardingStore((s) => s.steps);
  const demoMode = useOnboardingStore((s) => s.demoMode);
  const isDone = useOnboardingStore((s) => s.isChecklistDone);

  const [now, setNow] = useState(() => new Date());
  const [proofOpen, setProofOpen] = useState(false);
  const [proofItem, setProofItem] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contextItem, setContextItem] = useState(null);
  const [celebration, setCelebration] = useState(null);

  const openProof = (x) => { setProofItem(x); setProofOpen(true); };

  useEffect(() => {
    hydrateOnboarding?.();
    emailStateHydrate?.();
    hydrateRecording?.();
    track("app_opened");
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMail?.();
      await loadBills?.();
      await loadProfile?.();
      if (user) await fetchSubs?.();
      else await loadSubsLocal?.();
    } catch (e) {
      if (__DEV__) console.warn("[home] refresh failed:", e?.message);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    const timeout = setTimeout(() => setInitialLoading(false), 30_000);

    (async () => {
      try {
        // Phase 1: local reads only — fast, no network, unblocks render immediately
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

      // Phase 2: cloud sync deferred until after animations settle
      // so the navigation transition isn't competing with network I/O
      if (user) {
        InteractionManager.runAfterInteractions(() => {
          fetchSubs?.().catch((e) => {
            if (__DEV__) console.warn("[home] background sync failed:", e?.message);
          });
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
    () => recordingActive && recordingPersona
      ? recordingPersona.recurring || []
      : getRecurring?.() || [],
    [recordingActive, recordingPersona, getRecurring, subs, bills]
  );

  useEffect(() => {
    syncFromAppState?.({
      hasAnyRecurring: recurring.length > 0,
      remindersEnabled: !!notificationSettings?.renewalsEnabled,
    });
  }, [recurring, notificationSettings]);

  const actionFeed = useMemo(() => getActionFeed?.() || [], [getActionFeed, subs, bills]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const next30 = useMemo(() => {
    const cutoff = Date.now() + 30 * 86400000;
    return recurring
      .filter((x) => x.nextDate && new Date(x.nextDate).getTime() <= cutoff)
      .reduce((s, x) => s + (Number(x.effectiveAmount) || 0), 0);
  }, [recurring]);

  const urgentCount = useMemo(() =>
    recurring.filter((x) => {
      const d = daysUntil(x.nextDate);
      return d !== null && d <= 3;
    }).length,
  [recurring]);

  // Split upcoming into subs vs bills with shared data
  const upcomingSubs = useMemo(() =>
    recurring.filter((x) => x.kind === "subscription").slice(0, 10).map((x) => ({
      kind: x.kind, id: x.id,
      name: x.title || x.merchant || "",
      amount: x.effectiveAmount,
      currency: x.currency || "USD",
      cadence: x.cadence,
      subtitle: `${x.cadence} · renews ${x.nextDate || "—"}`,
      nextDate: x.nextDate,
      domain: x.domain || x.fromDomain || "",
      sharedCount: Number(x.sharedCount ?? 1) || 1,
      isShared: x.isShared === true,
    })),
  [recurring]);

  const upcomingBills = useMemo(() =>
    recurring.filter((x) => x.kind === "bill").slice(0, 10).map((x) => ({
      kind: x.kind, id: x.id,
      name: x.title || x.merchant || x.name || "",
      amount: x.effectiveAmount,
      currency: x.currency || "USD",
      subtitle: `bill · due ${x.nextDate || "—"}`,
      nextDate: x.nextDate,
      domain: x.domain || "",
      sharedCount: Number(x.sharedCount ?? 1) || 1,
      isShared: x.isShared === true,
      billIconKey: x.iconKey || "bill",
    })),
  [recurring]);

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
          paddingBottom: 92,
          gap: SPACING.cardGap,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <BiBRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <BiBRefreshBanner refreshing={refreshing} />
        {/* ── HERO ── */}
        <HeroSection
          t={t}
          displayName={displayName}
          urgentCount={urgentCount}
          candidateCount={candidateCount}
          emailConnected={emailConnected}
          greetingKey={greetingKey}
          tt={tt}
          onSearch={() => r.push("/search")}
        />

        {initialLoading ? (
          <HomeSkeleton />
        ) : (
          <>

        {/* ── EMAIL REVIEW BANNER — above the fold when detections exist ── */}
        {candidateCount > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 220, delay: 0 }}
          >
            <Pressable
              onPress={() => r.push("/account/connect-email/review")}
              style={({ pressed }) => ({
                borderRadius: 16,
                overflow: "hidden",
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <LinearGradient
                colors={[t.accent, "#6366F1"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Feather name="mail" size={18} color="#fff" />
                  <View>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                      Review {candidateCount} new email detection{candidateCount !== 1 ? "s" : ""}
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 1 }}>
                      Tap to confirm from your inbox scan
                    </Text>
                  </View>
                </View>
                <Feather name="arrow-right" size={18} color="#fff" />
              </LinearGradient>
            </Pressable>
          </MotiView>
        )}

        {/* ── MONTHLY DIGEST — month label + view all + share ── */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 220, delay: 60 }}
        >
          <MonthlyDigestCard
            recurring={recurring}
            subs={subs}
            bills={bills}
            currency="USD"
            emailConnected={emailConnected}
            onOpenRecap={() => r.push("/(tabs)/insights?recap=1")}
            onViewAll={() => r.push("/recurring")}
          />
        </MotiView>

        {/* ── SAVINGS TRACKER — only when something has been cancelled ── */}
        {(savings?.totalSaved > 0) && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 220, delay: 90 }}
          >
            <Pressable
              onPress={() => r.push("/recurring")}
              style={({ pressed }) => ({
                borderRadius: 18,
                overflow: "hidden",
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <LinearGradient
                colors={["#064E3B", "#065F46"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: 16,
                  paddingHorizontal: 18,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: "#34D39944",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ fontSize: 24 }}>🎉</Text>
                  <View>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                      You've saved {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(savings.totalSaved)}/mo
                    </Text>
                    <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 12, marginTop: 2 }}>
                      From {savings.entries?.length || 0} cancelled subscription{savings.entries?.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </View>
                <Feather name="arrow-right" size={16} color="rgba(255,255,255,0.6)" />
              </LinearGradient>
            </Pressable>
          </MotiView>
        )}

        {/* ── SETUP CHECKLIST (hides when dismissed) ── */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 220, delay: 120 }}
        >
          <SetupChecklistCard
            steps={steps}
            demoMode={demoMode}
            dismissed={dismissed}
            isDone={isDone?.()}
            onDismiss={dismissChecklist}
            onEnableDemo={enableDemo}
            onDisableDemo={disableDemo}
            onMarkReviewedUpcoming={() => markStep?.("reviewedUpcoming", true)}
          />
        </MotiView>
   

        {/* ── QUICK ADD — full width ── */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 220, delay: 180 }}
        >
          <Button
            title={tt("home.addRecurring")}
            onPress={() => r.push("/add-recurring")}
            left={<Feather name="plus" size={16} color="#fff" />}
          />
        </MotiView>
        {/* ── NEXT ACTIONS ── */}
        {actionFeed.length > 0 && (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "spring", damping: 18, mass: 0.35, stiffness: 220, delay: 240 }}
          >
            <HomeSection title={tt("home.nextActions")}>
              <VStack gap={8}>
                {actionFeed.slice(0, 4).map((a, idx) => (
                  <ActionCard
                    key={`${a.kind}-${idx}`}
                    t={t}
                    item={a}
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

        {/* ── UPCOMING — tabbed ── */}
        <HomeSection title={tt("home.upcoming")}>
          {upcomingSubs.length === 0 && upcomingBills.length === 0 ? (
            <Card>
              <EmptyStateCard
                icon="zap"
                title={tt("home.noRecurringYet")}
                body={tt("home.noRecurringBody")}
                primary={{
                  title: emailConnected ? tt("home.scanInbox") : tt("home.connectInbox"),
                  icon: emailConnected ? "search" : "link",
                  onPress: () => r.push(emailConnected ? "/progressive-scan" : "/(onboarding)/connect"),
                }}
                secondary={{
                  title: tt("home.addManually"),
                  icon: "plus",
                  onPress: () => r.push("/add-recurring"),
                }}
              />
            </Card>
          ) : (
            <Card style={{ paddingHorizontal: 0, paddingTop: 14, paddingBottom: 4 }}>
              <View style={{ paddingHorizontal: 14 }}>
                <UpcomingTabs
                  t={t}
                  subs={upcomingSubs}
                  bills={upcomingBills}
                  tt={tt}
                  onPressItem={(x) => {
                    markStep?.("reviewedUpcoming", true);
                    r.push({ pathname: "/brand", params: { domain: x.domain || "", name: x.name || "" } });
                  }}
                  onLongPressItem={(x) => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    setContextItem(x);
                  }}
                />
              </View>

            </Card>
          )}
        </HomeSection>

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