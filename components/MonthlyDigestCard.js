// components/MonthlyDigestCard.js
import React, { useMemo } from "react";
import { View, Text, Share, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import Tile from "./ui/Tile";
import Card from "./Card";
import Button from "./Button";
import { formatMoney } from "../lib/utils";
import { useTheme } from "../lib/theme";

function cadenceFactor(c) {
  return c === "yearly" ? 1 / 12 : c === "quarterly" ? 1 / 3 : c === "weekly" ? 4.345 : 1;
}

function shareDivisor(x) {
  if (!x?.shared) return 1;
  const n = Number(x?.sharedCount ?? 1);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function monthLabel(d = new Date()) {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
  } catch {
    const months = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December",
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
}

export default function MonthlyDigestCard({
  recurring = [],
  subs = [],
  bills = [],
  currency = "USD",
  emailConnected = false,
  onOptimize,
  onViewAll,
}) {
  const t = useTheme();

  const now = useMemo(() => new Date(), []);
  const mk = useMemo(() => monthLabel(now), [now]);

  const monthlySpend = useMemo(() => {
    return (recurring || []).reduce((sum, x) => {
      const amt = Number(x?.effectiveAmount ?? x?.amount ?? 0) || 0;
      const div = shareDivisor(x);
      const cf = cadenceFactor(x?.cadence || "monthly");
      return sum + (amt / div) * cf;
    }, 0);
  }, [recurring]);

  const changes = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    let n = 0;
    for (const x of [...(subs || []), ...(bills || [])]) {
      const ts = x?.updatedAt || x?.createdAt || x?.lastSeenAt || x?.last_seen_at || x?.detectedAt;
      if (!ts) continue;
      const d = new Date(ts);
      if (!Number.isNaN(d.getTime()) && d >= cutoff) n++;
    }
    return n;
  }, [subs, bills]);

  const dueNext30 = useMemo(() => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + 30);

    let sum = 0;
    for (const x of recurring || []) {
      if (x?.active === false) continue;
      if (!x?.nextDate) continue;
      const d = new Date(`${x.nextDate}T00:00:00`);
      if (d >= today && d <= cutoff) sum += Number(x?.effectiveAmount ?? x?.amount) || 0;
    }
    return sum;
  }, [recurring]);

  const shareText = useMemo(() => {
    const total = formatMoney(monthlySpend, currency);
    const due = formatMoney(dueNext30, currency);
    const ch = changes ? `${changes} updates` : "no changes";
    return `BeforeItBills · ${mk}\nMonthly spend: ${total}\nNext 30 days: ${due}\nChanges: ${ch}`;
  }, [mk, monthlySpend, dueNext30, changes, currency]);

  async function onShare() {
    try {
      await Share.share({ message: shareText });
    } catch {}
  }

  return (
    <Card style={{ padding: 16 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="zap" size={16} color={t.subtext} />
          <Text style={{ color: t.subtext, fontWeight: "900" }}>Monthly digest · {mk}</Text>
        </View>

        <Pressable
          onPress={onShare}
          hitSlop={10}
          style={{
            padding: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface,
          }}
        >
          <Feather name="share-2" size={16} color={t.subtext} />
        </Pressable>
      </View>

      {/* Main value */}
      <Text style={{ color: t.text, fontWeight: "900", fontSize: 22, marginTop: 10 }}>
        {formatMoney(monthlySpend, currency)} <Text style={{ color: t.tertiary, fontWeight: "900", fontSize: 16 }}>/ mo</Text>
      </Text>

      <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18, fontWeight: "700" }}>
        {emailConnected
          ? `Expected in the next 30 days: ${formatMoney(dueNext30, currency)}.`
          : "Connect an inbox to auto-detect renewals, trials, and price changes."}
      </Text>

      {/* Tiles */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <Tile style={{ flex: 1 }}>
          <Text style={{ color: t.subtext, fontWeight: "900" }}>You’ll pay</Text>
          <Text style={{ color: t.text, fontWeight: "900", marginTop: 6, fontSize: 16 }}>
            {formatMoney(dueNext30, currency)}
          </Text>
        </Tile>

        <Tile style={{ flex: 1 }}>
          <Text style={{ color: t.subtext, fontWeight: "900" }}>What changed</Text>
          <Text style={{ color: t.text, fontWeight: "900", marginTop: 6, fontSize: 16 }}>
            {changes ? `${changes} updates` : "No changes"}
          </Text>
        </Tile>
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Optimize"
            onPress={onOptimize}
            left={<Feather name="scissors" size={16} color="#fff" />}
          />
        </View>

        <View style={{ flex: 1 }}>
          <Button
            title="View all"
            variant="secondary"
            onPress={onViewAll}
            left={<Feather name="list" size={16} color={t.subtext} />}
          />
        </View>
      </View>
    </Card>
  );
}
