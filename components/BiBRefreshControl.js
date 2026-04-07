// components/BiBRefreshControl.js
//
// Branded pull-to-refresh for BeforeItBills.
//
// Usage:
//   <ScrollView refreshControl={<BiBRefreshControl refreshing={r} onRefresh={fn} />}>
//     <BiBRefreshBanner refreshing={r} />   ← first child, animates a 52dp slot
//     ...content
//   </ScrollView>

import React, { useEffect, useRef } from "react";
import { Animated, RefreshControl, View, Text } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { useTranslation } from "react-i18next";

// ── Spinning ring + card icon ─────────────────────────────────────────────

function BiBIcon({ size = 36 }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const loop = useRef(null);

  useEffect(() => {
    loop.current = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      })
    );
    loop.current.start();
    return () => loop.current?.stop();
  }, []);

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const r = size / 2 - 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Rotating dashed ring */}
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          transform: [{ rotate }],
        }}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#7DD3FC"
            strokeWidth="2"
            strokeDasharray="5 3"
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Static credit-card icon in center */}
      <Feather name="credit-card" size={size * 0.42} color="#7DD3FC" />
    </View>
  );
}

// ── Banner (first child of ScrollView) ───────────────────────────────────

export function BiBRefreshBanner({ refreshing }) {
  const t = useTheme();
  const { t: tt } = useTranslation();
  const heightAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: refreshing ? 58 : 0,
        duration: 260,
        useNativeDriver: false,
      }),
      Animated.timing(opacityAnim, {
        toValue: refreshing ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
    ]).start();
  }, [refreshing]);

  return (
    <Animated.View
      style={{
        height: heightAnim,
        opacity: opacityAnim,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 18,
          paddingVertical: 9,
          borderRadius: 999,
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: "rgba(125,211,252,0.25)",
        }}
      >
        <BiBIcon size={28} />
        <Text
          style={{
            color: "#7DD3FC",
            fontWeight: "800",
            fontSize: 13,
            letterSpacing: 0.2,
          }}
        >
          {tt("common.syncing")}
        </Text>
      </View>
    </Animated.View>
  );
}

// ── RefreshControl wrapper (use as refreshControl prop) ───────────────────

export function BiBRefreshControl({ refreshing, onRefresh, ...rest }) {
  const t = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={t.accent}
      colors={[t.accent]}
      progressBackgroundColor={t.surface}
      {...rest}
    />
  );
}
