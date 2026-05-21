// components/ScanProgressCard.js
import React, { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

const PROVIDER_LABEL = {
  gmail:   "Gmail",
  yahoo:   "Yahoo Mail",
  outlook: "Outlook",
  icloud:  "iCloud Mail",
  other:   "Email",
};

function useElapsed() {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return elapsed;
}

function formatElapsed(s) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function PulsingDot({ color }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color, opacity: anim }} />
  );
}

export default function ScanProgressCard({ progress }) {
  const t = useTheme();
  const elapsed = useElapsed();

  if (!progress) return null;

  const isFetching = progress.status === "fetching";
  const providerLabel = PROVIDER_LABEL[progress.provider] ?? "Email";
  const daysBack = progress.daysBack;

  const accentColor = t.accent ?? "#6C63FF";

  return (
    <View style={{
      backgroundColor: t.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: t.hairline,
      overflow: "hidden",
    }}>
      {/* Top row */}
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 11,
          backgroundColor: accentColor + "18",
          borderWidth: 1, borderColor: accentColor + "33",
          alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Feather name="mail" size={16} color={accentColor} />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: t.text }}>
            {isFetching ? "Processing results…" : `Scanning ${providerLabel}`}
          </Text>
          <Text style={{ fontSize: 12, fontWeight: "500", color: t.subtext, marginTop: 1 }}>
            {isFetching ? "Building your subscription list" : "Reading your billing emails"}
          </Text>
        </View>

        {/* Active badge */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 5,
          paddingHorizontal: 8, paddingVertical: 4,
          borderRadius: 99, backgroundColor: accentColor + "18",
          borderWidth: 1, borderColor: accentColor + "33",
        }}>
          <PulsingDot color={accentColor} />
          <Text style={{ fontSize: 10, fontWeight: "800", color: accentColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Live
          </Text>
        </View>
      </View>

      {/* Stats row */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderTopWidth: 1, borderTopColor: t.hairline,
        flexDirection: "row", gap: 8,
      }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 9, fontWeight: "800", color: t.subtext, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Elapsed
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "900", color: t.text, marginTop: 2 }}>
            {formatElapsed(elapsed)}
          </Text>
        </View>

        {daysBack ? (
          <>
            <View style={{ width: 1, backgroundColor: t.hairline }} />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Text style={{ fontSize: 9, fontWeight: "800", color: t.subtext, textTransform: "uppercase", letterSpacing: 0.5 }}>
                Lookback
              </Text>
              <Text style={{ fontSize: 16, fontWeight: "900", color: t.text, marginTop: 2 }}>
                {daysBack >= 365 ? `${Math.round(daysBack / 365)}yr` : `${daysBack}d`}
              </Text>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}
