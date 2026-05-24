"use client";
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../lib/theme";

/**
 * OnThisDayCard
 *
 * Shown when the user has been on BIB for ≥ 1 year.
 * Dismissible per calendar day via the onDismiss callback
 * (caller stores dismissed date in AsyncStorage).
 */
export default function OnThisDayCard({ data, tt, onDismiss }) {
  const t = useTheme();
  if (!data) return null;

  const { monthlySpendThen, monthlySpendNow, netChange } = data;

  const fmt = (n) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })
      .format(Math.abs(n));

  let changeText;
  if (Math.abs(netChange) < 0.5) {
    changeText = tt("onThisDay.unchanged");
  } else if (netChange > 0) {
    changeText = tt("onThisDay.increased", { delta: fmt(netChange) });
  } else {
    changeText = tt("onThisDay.decreased", { delta: fmt(netChange) });
  }

  const isGood   = netChange <= 0;
  const bgColors = isGood ? ["#064E3B", "#065F46"] : ["#44403C", "#57534E"];
  const border   = isGood ? "#34D39944" : "#A78BFA44";
  const accent   = isGood ? "#34D399" : "#A78BFA";

  return (
    <View style={{ borderRadius: 18, overflow: "hidden" }}>
      <LinearGradient
        colors={bgColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          padding: 16,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: border,
          gap: 10,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="clock" size={14} color={accent} />
            <Text style={{ color: accent, fontWeight: "700", fontSize: 12, letterSpacing: 0.5 }}>
              {tt("onThisDay.title").toUpperCase()}
            </Text>
          </View>
          {onDismiss && (
            <Pressable onPress={onDismiss} hitSlop={10}>
              <Feather name="x" size={15} color="rgba(255,255,255,0.4)" />
            </Pressable>
          )}
        </View>

        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15, lineHeight: 20 }}>
          {tt("onThisDay.spendThen", { amount: fmt(monthlySpendThen) })}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
          {tt("onThisDay.spendNow", { amount: fmt(monthlySpendNow) })}
        </Text>
        <Text style={{ color: accent, fontWeight: "700", fontSize: 13 }}>
          {changeText}
        </Text>
      </LinearGradient>
    </View>
  );
}
