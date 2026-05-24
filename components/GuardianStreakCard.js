"use client";
import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../lib/theme";

/**
 * GuardianStreakCard
 *
 * Shows the server-side guardian streak (consecutive weeks of email scanning).
 * Milestone toasts are handled by the parent (home screen) using AsyncStorage.
 */
export default function GuardianStreakCard({ streak, tt }) {
  const t = useTheme();
  const r = useRouter();

  if (!streak) return null;

  const { streakCount, isBroken } = streak;

  if (isBroken) {
    return (
      <Pressable
        onPress={() => r.push("/import-mail")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          padding: 14,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.hairline,
          backgroundColor: t.surface2,
        }}
      >
        <View style={{
          width: 34, height: 34, borderRadius: 10,
          backgroundColor: "#EF4444" + "22",
          alignItems: "center", justifyContent: "center",
        }}>
          <Feather name="shield-off" size={16} color="#EF4444" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 14 }}>
            {tt("guardian.lapsed")}
          </Text>
          <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2 }}>
            {tt("guardian.lapsedBody")}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={t.subtext} />
      </Pressable>
    );
  }

  const label = streakCount === 1
    ? tt("guardian.weekStreak", { n: streakCount })
    : tt("guardian.weekStreakPlural", { n: streakCount });

  // Colour scales with streak length
  let shieldColor, bgColor;
  if (streakCount >= 52)     { shieldColor = "#F59E0B"; bgColor = "#F59E0B22"; }
  else if (streakCount >= 12) { shieldColor = "#7C3AED"; bgColor = "#7C3AED22"; }
  else if (streakCount >= 4)  { shieldColor = "#3B82F6"; bgColor = "#3B82F622"; }
  else                         { shieldColor = "#6B7280"; bgColor = t.surface2; }

  return (
    <View style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: shieldColor + "33",
      backgroundColor: bgColor,
    }}>
      <View style={{
        width: 34, height: 34, borderRadius: 10,
        backgroundColor: shieldColor + "22",
        alignItems: "center", justifyContent: "center",
      }}>
        <Feather name="shield" size={16} color={shieldColor} />
      </View>
      <Text style={{ color: t.text, fontWeight: "700", fontSize: 14, flex: 1 }}>
        {label}
      </Text>
    </View>
  );
}
