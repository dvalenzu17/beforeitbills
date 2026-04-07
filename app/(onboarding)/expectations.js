// app/(onboarding)/expectations.js
//
// Onboarding flow:
//   Screen 1-3: clean story slides (what it does, how it works, privacy)
//   Screen 4:   the actual connect screen with a SpotlightTutorial overlay
//               walking the user through each element step by step
//   Final:      big choice — Connect Gmail vs Add manually

import React, { useRef, useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  ScrollView,
  Dimensions,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";

import { useTheme } from "../../lib/theme";
import { useOnboardingStore } from "../../lib/onboardingStore";
import { track } from "../../lib/analytics";
import SpotlightTutorial from "../../components/SpotlightTutorial";

const { width: W } = Dimensions.get("window");

// ─── Story slides (screens 1-3) ───────────────────────────────────────────────

const STORY_SLIDES = [
  {
    id: "what",
    icon: "bell",
    iconColor: "#6366F1",
    title: "Know what's billing before it happens",
    body: "BeforeItBills scans your inbox for renewal and billing emails, then shows you everything coming up before your card gets charged.",
    note: null,
  },
  {
    id: "how",
    icon: "zap",
    iconColor: "#F59E0B",
    title: "Here is how it works",
    steps: [
      { n: "1", icon: "mail",       text: "Connect your Gmail inbox" },
      { n: "2", icon: "search",     text: "We scan for billing emails only" },
      { n: "3", icon: "calendar",   text: "You see every upcoming charge with dates and amounts" },
      { n: "4", icon: "check",      text: "Decide to cancel, pause, or keep before it bills" },
    ],
    note: "We never make payments or move money. Visibility only.",
  },
  {
    id: "privacy",
    icon: "shield",
    iconColor: "#10B981",
    title: "Your inbox stays private",
    bullets: [
      { icon: "eye",      text: "Read-only access, we cannot send, delete, or change anything" },
      { icon: "filter",   text: "Only billing and subscription emails are processed" },
      { icon: "x-circle", text: "We never store your emails or share your data" },
    ],
    note: "Disconnect anytime from Account settings.",
  },
];

// ─── Spotlight steps for the guided demo ─────────────────────────────────────
// targetRef is attached in the GuidedConnectScreen below

function makeSpotlightSteps(refs) {
  return [
    {
      targetRef: refs.connectBtn,
      icon: "mail",
      title: "Connect your inbox here",
      body: "Tap this button to link your Gmail. We request read-only access — nothing else.",
    },
    {
      targetRef: refs.manualBtn,
      icon: "plus",
      title: "Or add subscriptions yourself",
      body: "Prefer not to connect? Enter your subscriptions manually and we will track them for you.",
    },
    {
      targetRef: refs.connectBtn,
      icon: "lock",
      title: "Your data stays yours",
      body: "We only scan billing emails. No bank access, no payment data, no email storage.",
    },
  ];
}

// ─── Guided connect screen (screen 4) ────────────────────────────────────────

function GuidedConnectScreen({ t, onConnectGmail, onManual }) {
  const connectBtnRef = useRef(null);
  const manualBtnRef = useRef(null);
  const [showSpotlight, setShowSpotlight] = useState(false);

  const spotlightSteps = makeSpotlightSteps({
    connectBtn: connectBtnRef,
    manualBtn: manualBtnRef,
  });

  // Start the spotlight after a short delay so layout is measured
  useEffect(() => {
    const t = setTimeout(() => setShowSpotlight(true), 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, paddingHorizontal: 24, paddingTop: 16 }}>
      <Animated.Text
        entering={FadeInDown.duration(350)}
        style={{
          fontSize: 26,
          fontWeight: "900",
          color: t.text,
          marginBottom: 8,
          lineHeight: 32,
        }}
      >
        Ready to get started
      </Animated.Text>

      <Animated.Text
        entering={FadeInDown.delay(80).duration(350)}
        style={{
          fontSize: 15,
          color: t.subtext,
          fontWeight: "600",
          marginBottom: 32,
          lineHeight: 22,
        }}
      >
        Choose how you want to add your subscriptions.
      </Animated.Text>

      {/* Gmail connect button */}
      <Animated.View entering={FadeInUp.delay(160).duration(350)}>
        <TouchableOpacity
          ref={connectBtnRef}
          onPress={onConnectGmail}
          activeOpacity={0.88}
          style={{
            borderRadius: 20,
            overflow: "hidden",
            marginBottom: 14,
            shadowColor: "#6366F1",
            shadowOpacity: 0.25,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          }}
        >
          <LinearGradient
            colors={["#6366F1", "#4F46E5"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 20,
              paddingHorizontal: 22,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "rgba(255,255,255,0.18)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="mail" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 17, fontWeight: "900" }}>
                Connect Gmail
              </Text>
              <Text
                style={{
                  color: "rgba(255,255,255,0.72)",
                  fontSize: 13,
                  fontWeight: "600",
                  marginTop: 2,
                }}
              >
                Automatic detection from your inbox
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.6)" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Manual button */}
      <Animated.View entering={FadeInUp.delay(240).duration(350)}>
        <TouchableOpacity
          ref={manualBtnRef}
          onPress={onManual}
          activeOpacity={0.85}
          style={{
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: t.hairline,
            backgroundColor: t.surface,
            paddingVertical: 20,
            paddingHorizontal: 22,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: t.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Feather name="plus" size={22} color={t.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: 17, fontWeight: "900" }}>
              Add manually
            </Text>
            <Text
              style={{
                color: t.subtext,
                fontSize: 13,
                fontWeight: "600",
                marginTop: 2,
              }}
            >
              Enter your subscriptions yourself
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={t.tertiary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Spotlight tutorial overlay */}
      <SpotlightTutorial
        steps={spotlightSteps}
        visible={showSpotlight}
        onDone={() => setShowSpotlight(false)}
      />
    </View>
  );
}

// ─── Story slide renderer ─────────────────────────────────────────────────────

function StorySlide({ slide, t }) {
  return (
    <View style={{ width: W, paddingHorizontal: 28, paddingTop: 8 }}>
      {/* Icon */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={{
          width: 64,
          height: 64,
          borderRadius: 18,
          backgroundColor: slide.iconColor + "18",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <Feather name={slide.icon} size={28} color={slide.iconColor} />
      </Animated.View>

      {/* Title */}
      <Animated.Text
        entering={FadeInDown.delay(60).duration(320)}
        style={{
          fontSize: 26,
          fontWeight: "900",
          color: t.text,
          lineHeight: 32,
          marginBottom: 16,
        }}
      >
        {slide.title}
      </Animated.Text>

      {/* Plain body */}
      {slide.body ? (
        <Animated.Text
          entering={FadeInDown.delay(120).duration(320)}
          style={{
            fontSize: 16,
            color: t.subtext,
            lineHeight: 24,
            fontWeight: "600",
          }}
        >
          {slide.body}
        </Animated.Text>
      ) : null}

      {/* Numbered steps */}
      {slide.steps ? (
        <View style={{ gap: 16, marginTop: 4 }}>
          {slide.steps.map((s, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(100 + i * 60).duration(300)}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: slide.iconColor + "20",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <Feather name={s.icon} size={15} color={slide.iconColor} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: t.text,
                  fontWeight: "600",
                  lineHeight: 22,
                  paddingTop: 6,
                }}
              >
                {s.text}
              </Text>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* Bullet list */}
      {slide.bullets ? (
        <View style={{ gap: 16, marginTop: 4 }}>
          {slide.bullets.map((b, i) => (
            <Animated.View
              key={i}
              entering={FadeInDown.delay(100 + i * 60).duration(300)}
              style={{ flexDirection: "row", alignItems: "flex-start", gap: 14 }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: slide.iconColor + "18",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                <Feather name={b.icon} size={15} color={slide.iconColor} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontSize: 15,
                  color: t.text,
                  fontWeight: "600",
                  lineHeight: 22,
                  paddingTop: 6,
                }}
              >
                {b.text}
              </Text>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* Note */}
      {slide.note ? (
        <Animated.View
          entering={FadeInDown.delay(400).duration(300)}
          style={{
            marginTop: 28,
            padding: 14,
            borderRadius: 14,
            backgroundColor: slide.iconColor + "0F",
            borderWidth: 1,
            borderColor: slide.iconColor + "22",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <Feather name="info" size={14} color={slide.iconColor} style={{ marginTop: 2 }} />
          <Text
            style={{
              flex: 1,
              color: slide.iconColor,
              fontSize: 13,
              fontWeight: "700",
              lineHeight: 19,
            }}
          >
            {slide.note}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function Expectations() {
  const t = useTheme();
  const r = useRouter();
  const markStep = useOnboardingStore((s) => s.markStep);
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const totalSlides = STORY_SLIDES.length + 1; // +1 for guided connect slide
  const isGuidedSlide = index === STORY_SLIDES.length;

  function scrollTo(i) {
    scrollRef.current?.scrollTo({ x: i * W, animated: true });
    setIndex(i);
  }

  function next() {
    if (index < totalSlides - 1) scrollTo(index + 1);
  }

  function skip() {
    track("onboarding_story_skipped", { from: index });
    scrollTo(STORY_SLIDES.length); // jump to guided connect slide
  }

  function onScrollEnd(e) {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    setIndex(i);
  }

  function goConnect() {
    markStep?.("expectations");
    track("onboarding_chose_connect");
    r.push("/(onboarding)/scan-setup");
  }

  function goManual() {
    markStep?.("expectations");
    track("onboarding_chose_manual");
    r.push("/(onboarding)/done");
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
          paddingBottom: 6,
        }}
      >
        {/* Progress dots */}
        <View style={{ flexDirection: "row", gap: 6 }}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 22 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === index ? t.accent : t.hairline,
              }}
            />
          ))}
        </View>

        {/* Skip — hide on last slide */}
        {!isGuidedSlide ? (
          <Pressable onPress={skip} hitSlop={12}>
            <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 14 }}>
              Skip
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
        scrollEnabled={!isGuidedSlide} // lock scroll when spotlight is active
        style={{ flex: 1 }}
      >
        {/* Story slides */}
        {STORY_SLIDES.map((slide) => (
          <View key={slide.id} style={{ width: W, flex: 1 }}>
            <StorySlide slide={slide} t={t} />
          </View>
        ))}

        {/* Guided connect slide */}
        <View style={{ width: W, flex: 1 }}>
          <GuidedConnectScreen
            t={t}
            onConnectGmail={goConnect}
            onManual={goManual}
          />
        </View>
      </ScrollView>

      {/* Bottom CTA — only on story slides */}
      {!isGuidedSlide ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24, paddingTop: 10 }}>
          <Pressable
            onPress={next}
            style={({ pressed }) => ({
              backgroundColor: t.accent,
              borderRadius: 18,
              paddingVertical: 17,
              alignItems: "center",
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
              {index === STORY_SLIDES.length - 1 ? "Get started" : "Continue"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}