// app/(onboarding)/expectations.js
// 8-screen onboarding redesign:
//   1. Hook         – stop-the-scroll stat
//   2. Problem      – pain-point empathy
//   3. Personalize  – interactive problem picker
//   4. Solution     – responds to their pick
//   5. Outcomes     – features → real benefits
//   6. Magic        – animated live demo
//   7. Quick Win    – add one subscription in 5 seconds
//   8. CTA          – free trial offer

import React, { useRef, useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Dimensions,
  Pressable,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  ZoomIn,
} from "react-native-reanimated";
import { MotiView } from "moti";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { useTheme } from "../../lib/theme";
import { useOnboardingStore } from "../../lib/onboardingStore";
import { usePurchasesStore } from "../../lib/purchasesStore";
import { useStore } from "../../lib/store";
import { setOnboardingDone } from "../../lib/onboardingGate";
import { track } from "../../lib/analytics";

const { width: W } = Dimensions.get("window");
const TOTAL = 8;

// ─── Static data ──────────────────────────────────────────────────────────────

const PROBLEMS = [
  { id: "forgot",  icon: "eye-off",      color: "#6366F1" },
  { id: "trials",  icon: "clock",        color: "#F59E0B" },
  { id: "prices",  icon: "trending-up",  color: "#EF4444" },
  { id: "clarity", icon: "grid",         color: "#10B981" },
];

const SOLUTIONS = {
  forgot:  { icon: "search",   color: "#6366F1" },
  trials:  { icon: "shield",   color: "#F59E0B" },
  prices:  { icon: "bell",     color: "#EF4444" },
  clarity: { icon: "layers",   color: "#10B981" },
};

const OUTCOMES = [
  { icon: "dollar-sign", color: "#10B981" },
  { icon: "zap",         color: "#6366F1" },
  { icon: "bell-off",    color: "#F59E0B" },
  { icon: "trash-2",     color: "#EF4444" },
];

const MOCK_ITEMS = [
  { name: "Netflix",       amount: "$17.99", badge: "price",  badgeColor: "#EF4444", icon: "tv"        },
  { name: "Spotify",       amount: "$9.99",  badge: null,                            icon: "music"     },
  { name: "Amazon Prime",  amount: "$14.99", badge: "trial",  badgeColor: "#F59E0B", icon: "package"   },
  { name: "Adobe",         amount: "$14.99", badge: "forgot", badgeColor: "#6366F1", icon: "file-text" },
  { name: "iCloud+",       amount: "$2.99",  badge: null,                            icon: "cloud"     },
];

const QUICK_SERVICES = [
  { id: "netflix",  name: "Netflix",          amount: "$17.99", icon: "tv"          },
  { id: "spotify",  name: "Spotify",          amount: "$9.99",  icon: "music"       },
  { id: "amazon",   name: "Amazon Prime",     amount: "$14.99", icon: "package"     },
  { id: "apple",    name: "Apple One",        amount: "$21.95", icon: "smartphone"  },
  { id: "disney",   name: "Disney+",          amount: "$13.99", icon: "film"        },
  { id: "youtube",  name: "YouTube Premium",  amount: "$13.99", icon: "play-circle" },
];

const PRO_BULLETS = [
  { icon: "mail",        key: "ob.cta.bullet1", fallback: "Auto-detect from Gmail"      },
  { icon: "bell",        key: "ob.cta.bullet2", fallback: "Price increase alerts"       },
  { icon: "clock",       key: "ob.cta.bullet3", fallback: "Trial radar"                 },
  { icon: "bar-chart-2", key: "ob.cta.bullet4", fallback: "Monthly insights digest"     },
  { icon: "zap",         key: "ob.cta.bullet5", fallback: "Unlimited scan depth"        },
];

// ─── Slide 1: Hook ────────────────────────────────────────────────────────────

function HookSlide({ t, tt }) {
  return (
    <View style={{ width: W, flex: 1, paddingHorizontal: 28, paddingTop: 20 }}>
      <Animated.View
        entering={FadeIn.duration(400)}
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          backgroundColor: "#6366F118",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 28,
        }}
      >
        <Feather name="credit-card" size={32} color="#6366F1" />
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(60).duration(350)}
        style={{ fontSize: 72, fontWeight: "900", color: "#6366F1", lineHeight: 78 }}
      >
        {tt("ob.hook.stat") || "12"}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(120).duration(350)}
        style={{ fontSize: 22, fontWeight: "900", color: t.text, marginTop: 4, lineHeight: 28 }}
      >
        {tt("ob.hook.statLabel") || "subscriptions"}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(200).duration(350)}
        style={{ fontSize: 16, color: t.subtext, fontWeight: "600", marginTop: 16, lineHeight: 24 }}
      >
        {tt("ob.hook.statSub") || "The average person pays for 12 subscriptions."}
      </Animated.Text>

      <Animated.View
        entering={FadeInDown.delay(320).duration(350)}
        style={{
          marginTop: 22,
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: "#EF444418",
          borderWidth: 1,
          borderColor: "#EF444430",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Feather name="alert-circle" size={16} color="#EF4444" />
        <Text style={{ flex: 1, color: "#EF4444", fontWeight: "800", fontSize: 15, lineHeight: 21 }}>
          {tt("ob.hook.halfForgotten") || "Half are forgotten."}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Slide 2: Problem ─────────────────────────────────────────────────────────

const PAIN_POINTS = [
  { icon: "eye-off",     color: "#6366F1", key: "ob.problem.p1", fallback: "You get charged and don't even know what it's for."                        },
  { icon: "repeat",      color: "#F59E0B", key: "ob.problem.p2", fallback: "Trials flip to paid while you're looking the other way."                   },
  { icon: "trending-up", color: "#EF4444", key: "ob.problem.p3", fallback: "Your Netflix went up $3. You found out on your bank statement."             },
  { icon: "copy",        color: "#10B981", key: "ob.problem.p4", fallback: "You're paying for duplicates. Two cloud plans. Three streaming services."   },
];

function ProblemSlide({ t, tt }) {
  return (
    <View style={{ width: W, flex: 1, paddingHorizontal: 28, paddingTop: 8 }}>
      <Animated.Text
        entering={FadeInDown.duration(350)}
        style={{ fontSize: 28, fontWeight: "900", color: t.text, lineHeight: 34, marginBottom: 6 }}
      >
        {tt("ob.problem.title") || "Sound familiar?"}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(60).duration(350)}
        style={{ fontSize: 15, color: t.subtext, fontWeight: "600", marginBottom: 22, lineHeight: 22 }}
      >
        {tt("ob.problem.subtitle") || "You're not disorganized. Subscriptions are designed to be hard to track."}
      </Animated.Text>

      <View style={{ gap: 10 }}>
        {PAIN_POINTS.map((p, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(80 + i * 70).duration(320)}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 14,
              padding: 14,
              borderRadius: 16,
              backgroundColor: p.color + "0E",
              borderWidth: 1,
              borderColor: p.color + "22",
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: p.color + "22",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Feather name={p.icon} size={16} color={p.color} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 14,
                color: t.text,
                fontWeight: "700",
                lineHeight: 20,
                paddingTop: 7,
              }}
            >
              {tt(p.key) || p.fallback}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ─── Slide 3: Personalize (interactive) ──────────────────────────────────────

const PROBLEM_LABELS = [
  { key: "ob.personalize.opt1", fallback: "I'm paying for things I forgot about"      },
  { key: "ob.personalize.opt2", fallback: "Trial traps keep hitting me"               },
  { key: "ob.personalize.opt3", fallback: "My prices keep creeping up"                },
  { key: "ob.personalize.opt4", fallback: "I just want one place to see everything"   },
];

function PersonalizeSlide({ t, tt, picked, onPick }) {
  return (
    <View style={{ width: W, flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
      <Animated.Text
        entering={FadeInDown.duration(350)}
        style={{ fontSize: 28, fontWeight: "900", color: t.text, lineHeight: 34, marginBottom: 6 }}
      >
        {tt("ob.personalize.title") || "What hits closest to home?"}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(60).duration(350)}
        style={{ fontSize: 15, color: t.subtext, fontWeight: "600", marginBottom: 24, lineHeight: 22 }}
      >
        {tt("ob.personalize.subtitle") || "We'll focus on what matters most to you."}
      </Animated.Text>

      <View style={{ gap: 12 }}>
        {PROBLEMS.map((p, i) => {
          const isOn = picked === p.id;
          return (
            <Animated.View key={p.id} entering={FadeInDown.delay(80 + i * 70).duration(320)}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync?.().catch(() => {});
                  onPick(p.id);
                }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: isOn ? p.color + "18" : t.surface,
                  borderWidth: 1.5,
                  borderColor: isOn ? p.color + "55" : t.hairline,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: isOn ? p.color + "28" : t.surface2,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Feather name={p.icon} size={18} color={isOn ? p.color : t.subtext} />
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: isOn ? t.text : t.subtext,
                    fontWeight: isOn ? "800" : "600",
                    lineHeight: 21,
                  }}
                >
                  {tt(PROBLEM_LABELS[i].key) || PROBLEM_LABELS[i].fallback}
                </Text>
                {isOn ? (
                  <Animated.View entering={ZoomIn.duration(200)}>
                    <Feather name="check-circle" size={20} color={p.color} />
                  </Animated.View>
                ) : null}
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Slide 4: Solution ────────────────────────────────────────────────────────

const SOLUTION_COPY = {
  forgot:  {
    titleKey: "ob.solution.title_forgot",  titleFallback: "Never lose track again",
    bodyKey:  "ob.solution.body_forgot",   bodyFallback:  "We scan your inbox and surface every charge — before it hits your card. Even the ones from 2 years ago.",
  },
  trials:  {
    titleKey: "ob.solution.title_trials",  titleFallback: "Beat trial traps before they hit",
    bodyKey:  "ob.solution.body_trials",   bodyFallback:  "We flag every trial about to flip to paid, with the exact date you need to cancel by.",
  },
  prices:  {
    titleKey: "ob.solution.title_prices",  titleFallback: "Catch every price increase",
    bodyKey:  "ob.solution.body_prices",   bodyFallback:  "The moment a billing email shows a higher amount than last time, we alert you instantly.",
  },
  clarity: {
    titleKey: "ob.solution.title_clarity", titleFallback: "Your subscription headquarters",
    bodyKey:  "ob.solution.body_clarity",  bodyFallback:  "Every recurring charge, one screen. Amounts, dates, what to do next. No more hunting.",
  },
};

function SolutionSlide({ t, tt, picked }) {
  const sol  = SOLUTIONS[picked] || SOLUTIONS.forgot;
  const copy = SOLUTION_COPY[picked] || SOLUTION_COPY.forgot;

  return (
    <View style={{ width: W, flex: 1, paddingHorizontal: 28, paddingTop: 20 }}>
      <Animated.View
        entering={ZoomIn.duration(380)}
        style={{
          width: 84,
          height: 84,
          borderRadius: 24,
          backgroundColor: sol.color + "18",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 28,
          borderWidth: 1,
          borderColor: sol.color + "30",
        }}
      >
        <Feather name={sol.icon} size={36} color={sol.color} />
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(80).duration(350)}
        style={{ fontSize: 28, fontWeight: "900", color: t.text, lineHeight: 34, marginBottom: 16 }}
      >
        {tt(copy.titleKey) || copy.titleFallback}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(160).duration(350)}
        style={{ fontSize: 16, color: t.subtext, fontWeight: "600", lineHeight: 25 }}
      >
        {tt(copy.bodyKey) || copy.bodyFallback}
      </Animated.Text>

      <Animated.View
        entering={FadeInUp.delay(320).duration(350)}
        style={{
          marginTop: 32,
          padding: 16,
          borderRadius: 16,
          backgroundColor: sol.color + "0E",
          borderWidth: 1,
          borderColor: sol.color + "22",
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Feather name="check" size={15} color={sol.color} />
        <Text style={{ flex: 1, fontSize: 14, color: sol.color, fontWeight: "800", lineHeight: 20 }}>
          {tt("ob.solution.note") || "Built for this. Works in 60 seconds."}
        </Text>
      </Animated.View>
    </View>
  );
}

// ─── Slide 5: Outcomes ────────────────────────────────────────────────────────

const OUTCOME_COPY = [
  { key: "ob.outcomes.o1", fallback: "Know your exact monthly burn before it leaves your account" },
  { key: "ob.outcomes.o2", fallback: "Cancel what you forgot about — in under 60 seconds"         },
  { key: "ob.outcomes.o3", fallback: "Never miss a trial ending or a quiet price increase"         },
  { key: "ob.outcomes.o4", fallback: "Stop paying for services you don't use anymore"             },
];

function OutcomesSlide({ t, tt }) {
  return (
    <View style={{ width: W, flex: 1, paddingHorizontal: 28, paddingTop: 8 }}>
      <Animated.Text
        entering={FadeInDown.duration(350)}
        style={{ fontSize: 28, fontWeight: "900", color: t.text, lineHeight: 34, marginBottom: 6 }}
      >
        {tt("ob.outcomes.title") || "Not features. Results."}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(60).duration(350)}
        style={{ fontSize: 15, color: t.subtext, fontWeight: "600", marginBottom: 28, lineHeight: 22 }}
      >
        {tt("ob.outcomes.subtitle") || "Here's what actually changes for you."}
      </Animated.Text>

      <View style={{ gap: 18 }}>
        {OUTCOMES.map((o, i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(80 + i * 80).duration(330)}
            style={{ flexDirection: "row", alignItems: "flex-start", gap: 16 }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                backgroundColor: o.color + "18",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Feather name={o.icon} size={20} color={o.color} />
            </View>
            <Text
              style={{
                flex: 1,
                fontSize: 16,
                color: t.text,
                fontWeight: "700",
                lineHeight: 23,
                paddingTop: 10,
              }}
            >
              {tt(OUTCOME_COPY[i].key) || OUTCOME_COPY[i].fallback}
            </Text>
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

// ─── Slide 6: Magic (animated live demo) ─────────────────────────────────────

const BADGE_COPY = {
  price:  { key: "ob.magic.priceBadge",  fallback: "↑ Price increase"        },
  trial:  { key: "ob.magic.trialBadge",  fallback: "⚠ Trial ending soon"     },
  forgot: { key: "ob.magic.forgotBadge", fallback: "Forgotten 18 months"      },
};

function MagicSlide({ t, tt, isActive }) {
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setRevealed(0);
      return;
    }
    const timers = MOCK_ITEMS.map((_, i) =>
      setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), 300 + i * 500)
    );
    return () => timers.forEach(clearTimeout);
  }, [isActive]);

  return (
    <View style={{ width: W, flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
      <Animated.Text
        entering={FadeInDown.duration(350)}
        style={{ fontSize: 28, fontWeight: "900", color: t.text, lineHeight: 34, marginBottom: 8 }}
      >
        {tt("ob.magic.title") || "Here's what it looks like"}
      </Animated.Text>

      <Animated.View
        entering={FadeInDown.delay(80).duration(350)}
        style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 20 }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "#10B981",
          }}
        />
        <Text style={{ color: "#10B981", fontWeight: "700", fontSize: 13 }}>
          {tt("ob.magic.liveDemo") || "Live preview"}
        </Text>
      </Animated.View>

      <View
        style={{
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.hairline,
          backgroundColor: t.surface,
          overflow: "hidden",
          minHeight: 60,
        }}
      >
        {MOCK_ITEMS.map((item, i) => {
          if (i >= revealed) return null;
          const bc = item.badge ? BADGE_COPY[item.badge] : null;
          return (
            <MotiView
              key={item.name}
              from={{ opacity: 0, translateX: -16 }}
              animate={{ opacity: 1, translateX: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 270 }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 13,
                paddingHorizontal: 16,
                borderBottomWidth: i < MOCK_ITEMS.length - 1 ? 1 : 0,
                borderBottomColor: t.hairline,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: t.surface2,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name={item.icon} size={16} color={t.subtext} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: "800", fontSize: 14 }}>{item.name}</Text>
                {bc ? (
                  <Text style={{ color: item.badgeColor, fontWeight: "700", fontSize: 12, marginTop: 2 }}>
                    {tt(bc.key) || bc.fallback}
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: t.text, fontWeight: "900", fontSize: 15 }}>{item.amount}</Text>
            </MotiView>
          );
        })}
      </View>
    </View>
  );
}

// ─── Slide 7: Quick Win ───────────────────────────────────────────────────────

function QuickWinSlide({ t, tt, picked, onPick }) {
  return (
    <View style={{ width: W, flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
      <Animated.Text
        entering={FadeInDown.duration(350)}
        style={{ fontSize: 28, fontWeight: "900", color: t.text, lineHeight: 34, marginBottom: 6 }}
      >
        {tt("ob.quickwin.title") || "Add one you recognize"}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(60).duration(350)}
        style={{ fontSize: 15, color: t.subtext, fontWeight: "600", marginBottom: 22, lineHeight: 22 }}
      >
        {tt("ob.quickwin.subtitle") || "Tap any you pay for. Takes 5 seconds."}
      </Animated.Text>

      <Animated.View
        entering={FadeInDown.delay(120).duration(350)}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}
      >
        {QUICK_SERVICES.map((s) => {
          const isOn = picked?.id === s.id;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                Haptics.impactAsync?.(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onPick(isOn ? null : s);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 14,
                paddingVertical: 11,
                borderRadius: 14,
                backgroundColor: isOn ? "#6366F118" : t.surface,
                borderWidth: 1.5,
                borderColor: isOn ? "#6366F155" : t.hairline,
              }}
            >
              <Feather name={s.icon} size={14} color={isOn ? "#6366F1" : t.subtext} />
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: isOn ? "800" : "600",
                  color: isOn ? "#6366F1" : t.text,
                }}
              >
                {s.name}
              </Text>
              {isOn ? (
                <Animated.View entering={ZoomIn.duration(200)}>
                  <Feather name="check" size={13} color="#6366F1" />
                </Animated.View>
              ) : null}
            </Pressable>
          );
        })}
      </Animated.View>

      {picked ? (
        <Animated.View
          entering={FadeInUp.delay(100).duration(350)}
          style={{
            marginTop: 24,
            padding: 18,
            borderRadius: 18,
            backgroundColor: "#10B98114",
            borderWidth: 1,
            borderColor: "#10B98130",
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <Text style={{ fontSize: 26 }}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#10B981", fontWeight: "900", fontSize: 16 }}>
              {tt("ob.quickwin.addedTitle") || "There it is."}
            </Text>
            <Text style={{ color: "#10B981", fontWeight: "600", fontSize: 13, marginTop: 2 }}>
              {tt("ob.quickwin.addedBody") || "That's your first win. Imagine dozens more."}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── Slide 8: CTA ─────────────────────────────────────────────────────────────

function CTASlide({ t, tt, onConnect, onNotNow, loading }) {
  return (
    <View style={{ width: W, flex: 1, paddingHorizontal: 24, paddingTop: 8 }}>
      {/* Brand header */}
      <Animated.View
        entering={FadeIn.duration(350)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 }}
      >
        <Image
          source={require("../../assets/BeforeItBillsLogo.png")}
          style={{ width: 38, height: 38, borderRadius: 10 }}
          resizeMode="contain"
        />
        <View>
          <Text style={{ fontSize: 15, fontWeight: "900", color: t.text }}>BeforeItBills</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              marginTop: 1,
            }}
          >
            <View
              style={{
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: "#6366F1",
              }}
            >
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 }}>
                PRO
              </Text>
            </View>
            <Text style={{ fontSize: 12, color: t.subtext, fontWeight: "600" }}>
              {tt("ob.cta.trialPill") || "· 7-day free trial"}
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInDown.delay(60).duration(350)}
        style={{ fontSize: 24, fontWeight: "900", color: t.text, lineHeight: 30, marginBottom: 6 }}
      >
        {tt("ob.cta.title") || "Start seeing everything"}
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(120).duration(350)}
        style={{ fontSize: 14, color: t.subtext, fontWeight: "600", marginBottom: 20, lineHeight: 20 }}
      >
        {tt("ob.cta.subtitle") || "You found your first subscription in seconds. Wait until we scan your whole inbox."}
      </Animated.Text>

      {/* What's unlocked */}
      <Animated.View
        entering={FadeInDown.delay(180).duration(350)}
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#6366F122",
          backgroundColor: "#6366F108",
          paddingVertical: 14,
          paddingHorizontal: 16,
          marginBottom: 20,
          gap: 11,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "800", color: "#6366F1", letterSpacing: 0.8, marginBottom: 2 }}>
          {tt("ob.cta.unlockedLabel") || "WHAT YOU UNLOCK"}
        </Text>
        {PRO_BULLETS.map((b, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                backgroundColor: "#6366F120",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Feather name="check" size={12} color="#6366F1" />
            </View>
            <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: t.text }}>
              {tt(b.key) || b.fallback}
            </Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={{ gap: 10 }}>
        <TouchableOpacity
          onPress={onConnect}
          disabled={loading}
          activeOpacity={0.88}
          style={{
            borderRadius: 18,
            overflow: "hidden",
            shadowColor: "#6366F1",
            shadowOpacity: loading ? 0 : 0.3,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: loading ? 0 : 6,
            opacity: loading ? 0.75 : 1,
          }}
        >
          <LinearGradient
            colors={["#6366F1", "#4F46E5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ paddingVertical: 17, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : null}
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
              {loading
                ? (tt("ob.cta.loading") || "Processing…")
                : (tt("ob.cta.trial") || "Start free 7-day trial")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <Text style={{ textAlign: "center", color: t.tertiary ?? t.subtext, fontSize: 12, fontWeight: "600" }}>
          {tt("ob.cta.trialSub") || "Then $4.99/month. Cancel anytime."}
        </Text>

        <Pressable
          onPress={onNotNow}
          disabled={loading}
          style={({ pressed }) => ({
            alignItems: "center",
            paddingVertical: 10,
            opacity: pressed || loading ? 0.5 : 1,
          })}
        >
          <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 15 }}>
            {tt("ob.cta.notNow") || "Not now"}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Success overlay ──────────────────────────────────────────────────────────

function SuccessOverlay({ t, tt, visible, onGetStarted }) {
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
        {/* Logo + Pro badge */}
        <Animated.View
          entering={ZoomIn.duration(400)}
          style={{ alignItems: "center", marginBottom: 24 }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: 24,
              overflow: "hidden",
              marginBottom: 12,
              shadowColor: "#6366F1",
              shadowOpacity: 0.25,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: 8,
            }}
          >
            <Image
              source={require("../../assets/BeforeItBillsLogo.png")}
              style={{ width: 88, height: 88 }}
              resizeMode="cover"
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 18, fontWeight: "900", color: t.text }}>BeforeItBills</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, backgroundColor: "#6366F1" }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "900", letterSpacing: 0.5 }}>PRO</Text>
            </View>
          </View>
        </Animated.View>

        {/* Headline */}
        <Animated.Text
          entering={FadeInDown.delay(200).duration(350)}
          style={{ fontSize: 36, fontWeight: "900", color: t.text, textAlign: "center", lineHeight: 42, marginBottom: 8 }}
        >
          {tt("ob.success.title") || "You're Pro! 🎉"}
        </Animated.Text>

        <Animated.View
          entering={FadeInDown.delay(280).duration(350)}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
            backgroundColor: "#10B98120",
            borderWidth: 1,
            borderColor: "#10B98140",
            marginBottom: 32,
          }}
        >
          <Text style={{ color: "#10B981", fontWeight: "800", fontSize: 14 }}>
            {tt("ob.success.pill") || "7-day free trial started"}
          </Text>
        </Animated.View>

        {/* Unlocked features */}
        <Animated.View
          entering={FadeInDown.delay(360).duration(350)}
          style={{
            width: "100%",
            borderRadius: 18,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface,
            paddingVertical: 16,
            paddingHorizontal: 18,
            gap: 12,
            marginBottom: 32,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: "800", color: t.subtext, letterSpacing: 0.8, marginBottom: 2 }}>
            {tt("ob.success.unlockedLabel") || "NOW UNLOCKED"}
          </Text>
          {PRO_BULLETS.map((b, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  backgroundColor: "#10B98120",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Feather name="check" size={13} color="#10B981" />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: t.text }}>
                {tt(b.key) || b.fallback}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* CTA */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={{ width: "100%" }}>
          <TouchableOpacity
            onPress={onGetStarted}
            activeOpacity={0.88}
            style={{
              borderRadius: 18,
              overflow: "hidden",
              shadowColor: "#6366F1",
              shadowOpacity: 0.3,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 6 },
              elevation: 6,
            }}
          >
            <LinearGradient
              colors={["#6366F1", "#4F46E5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingVertical: 18, alignItems: "center" }}
            >
              <Text style={{ color: "#fff", fontWeight: "900", fontSize: 17 }}>
                {tt("ob.success.cta") || "Get started"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Expectations() {
  const t = useTheme();
  const { t: tt } = useTranslation();
  const markStep = useOnboardingStore((s) => s.markStep);
  const loadOfferings  = usePurchasesStore((s) => s.loadOfferings);
  const purchasePkg    = usePurchasesStore((s) => s.purchasePackage);
  const addSub         = useStore((s) => s.addSub);
  const scrollRef = useRef(null);

  const [index, setIndex]                   = useState(0);
  const [pickedProblem, setPickedProblem]   = useState(null);
  const [quickWinPicked, setQuickWinPicked] = useState(null);
  const [purchasing, setPurchasing]         = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);

  function scrollTo(i) {
    scrollRef.current?.scrollTo({ x: i * W, animated: true });
    setIndex(i);
  }

  function next() {
    // Slide 3 (index 2) requires a selection before advancing
    if (index === 2 && !pickedProblem) {
      Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    if (index < TOTAL - 1) scrollTo(index + 1);
  }

  function skip() {
    track("onboarding_story_skipped", { from: index });
    scrollTo(TOTAL - 1);
  }

  function onScrollEnd(e) {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    setIndex(i);
  }

  async function goTrial() {
    markStep?.("expectations");
    track("onboarding_start_trial", { pickedProblem, quickWin: quickWinPicked?.id });
    setPurchasing(true);
    try {
      const offerings = await loadOfferings();
      const pkg = offerings?.current?.availablePackages?.[0] ?? null;
      if (!pkg) {
        // No native module (Expo Go) or no offerings — show success anyway for demo
        setPurchaseSuccess(true);
        return;
      }
      const result = await purchasePkg(pkg);
      if (result.ok) {
        Haptics.notificationAsync?.(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setPurchaseSuccess(true);
      }
      // user cancelled → stay on CTA, do nothing
    } catch {
      // silent — stay on CTA
    } finally {
      setPurchasing(false);
    }
  }

  async function goNotNow() {
    track("onboarding_not_now");
    await setOnboardingDone(true);
  }

  async function goGetStarted() {
    track("onboarding_trial_get_started");

    // Add BeforeItBills Pro as a trial subscription in recurring expenses
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);
      const trialEndISO = trialEnd.toISOString().split("T")[0];

      await addSub({
        merchant: "BeforeItBills",
        amount: 4.99,
        currency: "USD",
        cadence: "monthly",
        nextRenewal: trialEndISO,
        is_trial: true,
        trial_end: trialEndISO,
        source: "manual",
        active: true,
        confidence: 1.0,
      });
    } catch {
      // non-fatal — onboarding continues regardless
    }

    await setOnboardingDone(true);
  }

  const isCTA = index === TOTAL - 1;

  function nextLabel() {
    if (index === TOTAL - 2) return tt("ob.getStarted") || "Get started";
    if (index === 2 && !pickedProblem) return tt("ob.pickOne") || "Pick one to continue";
    return tt("ob.next") || "Next";
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Top bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: 8,
        }}
      >
        {/* Progress dots */}
        <View style={{ flexDirection: "row", gap: 5 }}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 20 : 6,
                height: 6,
                borderRadius: 3,
                backgroundColor:
                  i === index ? t.accent : i < index ? t.accent + "55" : t.hairline,
              }}
            />
          ))}
        </View>

        {/* Skip — hide on CTA slide */}
        {!isCTA ? (
          <Pressable onPress={skip} hitSlop={12}>
            <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 14 }}>
              {tt("ob.skip") || "Skip"}
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onScrollEnd}
        style={{ flex: 1 }}
      >
        <View style={{ width: W, flex: 1 }}>
          <HookSlide t={t} tt={tt} />
        </View>
        <View style={{ width: W, flex: 1 }}>
          <ProblemSlide t={t} tt={tt} />
        </View>
        <View style={{ width: W, flex: 1 }}>
          <PersonalizeSlide t={t} tt={tt} picked={pickedProblem} onPick={setPickedProblem} />
        </View>
        <View style={{ width: W, flex: 1 }}>
          <SolutionSlide t={t} tt={tt} picked={pickedProblem || "forgot"} />
        </View>
        <View style={{ width: W, flex: 1 }}>
          <OutcomesSlide t={t} tt={tt} />
        </View>
        <View style={{ width: W, flex: 1 }}>
          <MagicSlide t={t} tt={tt} isActive={index === 5} />
        </View>
        <View style={{ width: W, flex: 1 }}>
          <QuickWinSlide t={t} tt={tt} picked={quickWinPicked} onPick={setQuickWinPicked} />
        </View>
        <View style={{ width: W, flex: 1 }}>
          <CTASlide t={t} tt={tt} onConnect={goTrial} onNotNow={goNotNow} loading={purchasing} />
        </View>
      </ScrollView>

      <SuccessOverlay t={t} tt={tt} visible={purchaseSuccess} onGetStarted={goGetStarted} />

      {/* Bottom Next button — hidden on CTA slide (has its own inline CTAs) */}
      {!isCTA ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 }}>
          <Pressable
            onPress={next}
            style={({ pressed }) => ({
              backgroundColor:
                index === 2 && !pickedProblem ? t.hairline : t.accent,
              borderRadius: 18,
              paddingVertical: 17,
              alignItems: "center",
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
              {nextLabel()}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
