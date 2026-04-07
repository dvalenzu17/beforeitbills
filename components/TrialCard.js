// components/TrialRadarCard.js
import React, { useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import BrandAvatar from "./BrandAvatar";

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const ms = d.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function badgeForDays(days) {
  if (days == null) return { label: "Trial", tone: "muted" };
  if (days <= 0) return { label: "Ends today", tone: "danger" };
  if (days === 1) return { label: "Ends in 1d", tone: "danger" };
  if (days <= 3) return { label: `Ends in ${days}d`, tone: "warn" };
  return { label: `Ends in ${days}d`, tone: "muted" };
}

export default function TrialRadarCard({
  title = "Trials ending soon",
  items = [],
  onPressItem,
  onCancel,
  onRemind,
  onKeep,
}) {
  const t = useTheme();

  const toneStyle = (tone) => {
    if (tone === "danger") return { borderColor: "rgba(255,80,80,0.55)", backgroundColor: "rgba(255,80,80,0.08)" };
    if (tone === "warn") return { borderColor: "rgba(255,190,80,0.55)", backgroundColor: "rgba(255,190,80,0.08)" };
    return { borderColor: t.hairline, backgroundColor: t.surface2 };
  };

  const top = useMemo(() => (items || []).slice(0, 3), [items]);

  if (!top.length) return null;

  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: t.surface,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: t.text, fontWeight: "900" }}>{title}</Text>
        <Text style={{ color: t.subtext, fontWeight: "800" }}>{items.length}</Text>
      </View>

      {top.map((x) => {
        const days = daysUntil(x.trialEndsAt);
        const badge = badgeForDays(days);
        const tone = toneStyle(badge.tone);

        return (
          <Pressable
            key={`${x.id}`}
            onPress={() => onPressItem?.(x)}
            style={{
              padding: 12,
              borderRadius: 18,
              borderWidth: 1,
              ...tone,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <BrandAvatar domain={x.domain} name={x.name} size={42} />

              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: "900" }}>{x.name}</Text>
                <Text style={{ color: t.subtext, marginTop: 3 }}>
                  {x.trialEndsAt ? `Ends ${String(x.trialEndsAt).slice(0, 10)}` : "Trial"}
                  {x.amount ? ` · est. ${x.currency || "USD"} ${x.amount}` : ""}
                </Text>
              </View>

              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: tone.borderColor,
                    backgroundColor: tone.backgroundColor,
                  }}
                >
                  <Text style={{ color: t.text, fontWeight: "900", fontSize: 12 }}>{badge.label}</Text>
                </View>

                <Feather name="chevron-right" size={18} color={t.tertiary} />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Pressable
                onPress={() => onCancel?.(x)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(255,80,80,0.55)",
                  backgroundColor: "rgba(255,80,80,0.10)",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: t.text, fontWeight: "900" }}>Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => onRemind?.(x)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: t.hairline,
                  backgroundColor: t.surface2,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: t.text, fontWeight: "900" }}>Remind</Text>
              </Pressable>

              <Pressable
                onPress={() => onKeep?.(x)}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: t.hairline,
                  backgroundColor: t.surface2,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: t.text, fontWeight: "900" }}>Keep</Text>
              </Pressable>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}