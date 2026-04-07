// components/ScanProgressCard.js
import React, { useMemo } from "react";
import { View, Text } from "react-native";
import Card from "@/components/Card";
import { useTheme } from "@/lib/theme";

export default function ScanProgressCard({ progress }) {
  const t = useTheme();

  const pct = useMemo(() => {
    // No perfect total; show a soft progress based on batches.
    // If user scanned 0 → 0%. If scanning → 30–90%. Done handled by hiding card.
    const scanned = Number(progress?.scanned || 0);
    if (!scanned) return 25;
    if (scanned < 200) return 40;
    if (scanned < 600) return 65;
    if (scanned < 1200) return 80;
    return 90;
  }, [progress?.scanned]);

  if (!progress) return null;

  return (
    <Card style={{ padding: 16 }}>
      <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
        {progress.phase || "Scanning…"}
      </Text>
      <Text style={{ marginTop: 6, color: t.subtext, lineHeight: 18 }}>
        {progress.note || "Working through your inbox"}
      </Text>

      <View style={{ marginTop: 12, flexDirection: "row", gap: 14 }}>
        <Metric label="Checked" value={progress.scanned ?? 0} t={t} />
        <Metric label="Found" value={progress.found ?? 0} t={t} />
        <Metric label="Batches" value={progress.pages ?? 0} t={t} />
      </View>

      <View style={{ marginTop: 12, height: 10, backgroundColor: t.soft, borderRadius: 999, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: t.text, opacity: 0.85 }} />
      </View>

      <Text style={{ marginTop: 8, color: t.tertiary, fontWeight: "800", fontSize: 12 }}>
        Lookback: {progress.daysBack || 0} days
      </Text>
    </Card>
  );
}

function Metric({ label, value, t }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.subtext, fontWeight: "800", fontSize: 12 }}>{label}</Text>
      <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>{value}</Text>
    </View>
  );
}
