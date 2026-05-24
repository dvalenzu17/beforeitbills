"use client";
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Screen from "../components/Screen";
import { useTheme } from "../lib/theme";
import { useTranslation } from "react-i18next";
import { getNotifications, markNotificationRead } from "../lib/emailImportClient";

// Map notification type → icon + accent colour
const TYPE_META = {
  price_decrease:        { icon: "trending-down", color: "#34D399" },
  dormant:               { icon: "moon",          color: "#A78BFA" },
  shared_subscription:   { icon: "users",         color: "#60A5FA" },
  annual_renewal_14day:  { icon: "calendar",      color: "#F59E0B" },
  price_increase:        { icon: "trending-up",   color: "#EF4444" },
};

function NotificationRow({ item, t, tt, onPress }) {
  const meta  = TYPE_META[item.type] || { icon: "bell", color: t.accent };
  const label = tt(`digest.screen.typeLabels.${item.type}`) || item.type;
  const isUnread = !item.read_at;

  const payload = item.payload || {};
  const merchant = payload.merchant || "";
  const { body } = buildCopy(item.type, payload);

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: t.hairline,
        backgroundColor: isUnread ? meta.color + "08" : "transparent",
      }}
    >
      <View style={{
        width: 36, height: 36, borderRadius: 11,
        backgroundColor: meta.color + "22",
        alignItems: "center", justifyContent: "center",
      }}>
        <Feather name={meta.icon} size={16} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: isUnread ? "700" : "500", fontSize: 14 }}>
          {merchant || label}
        </Text>
        {!!body && (
          <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {body}
          </Text>
        )}
        <Text style={{ color: t.subtext, fontSize: 11, marginTop: 4 }}>
          {label} · {relativeDate(new Date(item.created_at))}
        </Text>
      </View>
      {isUnread && (
        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: meta.color }} />
      )}
    </Pressable>
  );
}

export default function DigestScreen() {
  const t  = useTheme();
  const r  = useRouter();
  const { t: tt } = useTranslation();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getNotifications({ tier: "digest", limit: 50 });
      setNotifications((res?.notifications || []));
    } catch (e) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, []);

  const handlePress = useCallback(async (item) => {
    // Mark as read
    if (!item.read_at) {
      markNotificationRead(item.id).catch(() => {});
      setNotifications(prev =>
        prev.map(n => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    }
    // Navigate to subscription if available
    const sub = item.payload?.subscriptionId;
    if (sub) r.push(`/recurring/subscription/${sub}`);
  }, [r]);

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingBottom: 8 }}>
        <Pressable onPress={() => r.back()} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={t.text} />
        </Pressable>
        <Text style={{ color: t.text, fontWeight: "900", fontSize: 20, flex: 1 }}>
          {tt("digest.screen.heading")}
        </Text>
      </View>

      {loading && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={t.accent} />
        </View>
      )}

      {!loading && !error && notifications.length === 0 && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, gap: 12 }}>
          <Feather name="check-circle" size={40} color={t.subtext} />
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 17, textAlign: "center" }}>
            {tt("digest.screen.empty")}
          </Text>
          <Text style={{ color: t.subtext, fontSize: 14, textAlign: "center" }}>
            {tt("digest.screen.emptyBody")}
          </Text>
        </View>
      )}

      {!loading && !error && notifications.length > 0 && (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <NotificationRow item={item} t={t} tt={tt} onPress={handlePress} />
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}

      {!loading && !!error && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: t.subtext }}>{error}</Text>
          <Pressable onPress={load} style={{ marginTop: 12 }}>
            <Text style={{ color: t.accent, fontWeight: "700" }}>Retry</Text>
          </Pressable>
        </View>
      )}
    </Screen>
  );
}

function buildCopy(type, payload) {
  const m   = payload.merchant || "";
  const sym = "$";
  switch (type) {
    case "price_decrease":
      return { body: `Dropped from ${sym}${(payload.oldAmount || 0).toFixed(2)} to ${sym}${(payload.newAmount || 0).toFixed(2)}` };
    case "dormant":
      return { body: payload.amount ? `Still worth ${sym}${Number(payload.amount).toFixed(2)}/mo?` : "Haven't seen usage signals in 90 days" };
    case "shared_subscription":
      return { body: payload.saving ? `Save ${sym}${Number(payload.saving).toFixed(2)}/mo with a shared plan` : "You and a linked user both pay for this" };
    case "annual_renewal_14day":
      return { body: `Renews in ~14 days${payload.amount ? ` — ${sym}${Number(payload.amount).toFixed(2)}` : ""}` };
    case "price_increase":
      return { body: `${sym}${(payload.oldAmount || 0).toFixed(2)} → ${sym}${(payload.newAmount || 0).toFixed(2)}` };
    default:
      return { body: "" };
  }
}

function relativeDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return "";
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7)  return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
