// app/search.js
import React, { useMemo, useRef, useState } from "react";
import { View, Text, TextInput, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";
import { formatMoney } from "../lib/utils";
import BrandAvatar from "../components/BrandAvatar";

function norm(s) { return String(s || "").trim().toLowerCase(); }
function pickName(x) { return x?.title || x?.merchant || x?.name || ""; }
function pickDomain(x) { return x?.domain || x?.fromDomain || x?.merchantDomain || ""; }

export default function GlobalSearch() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  const getRecurring = useStore((s) => s.getRecurring);
  const subs = useStore((s) => s.subs);
  const bills = useStore((s) => s.bills);

  const [q, setQ] = useState("");

  const all = useMemo(() => getRecurring?.() || [], [getRecurring, subs, bills]);

  const results = useMemo(() => {
    const needle = norm(q);
    if (!needle) return [];
    return all.filter((x) =>
      norm(pickName(x)).includes(needle) || norm(pickDomain(x)).includes(needle)
    );
  }, [all, q]);

  function onSelect(item) {
    const kind = item.kind === "bill" ? "bill" : "subscription";
    r.push(`/recurring/${kind}/${item.id}`);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 }}>
        <Pressable
          onPress={() => r.back()}
          style={{ padding: 10, borderRadius: 14, borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface }}
          accessibilityRole="button"
          accessibilityLabel={tt("common.back") || "Back"}
        >
          <Feather name="arrow-left" size={16} color={t.text} />
        </Pressable>

        <View style={{
          flex: 1, flexDirection: "row", alignItems: "center", gap: 10,
          borderRadius: 18, borderWidth: 1,
          borderColor: q ? t.accent : t.hairline,
          backgroundColor: t.surface, paddingHorizontal: 12, paddingVertical: 10,
        }}>
          <Feather name="search" size={16} color={t.tertiary} />
          <TextInput
            autoFocus
            value={q}
            onChangeText={setQ}
            placeholder={tt("search.placeholder")}
            placeholderTextColor={t.tertiary}
            returnKeyType="search"
            style={{ flex: 1, color: t.text, fontWeight: "700", fontSize: 15 }}
          />
          {!!q && (
            <Pressable onPress={() => setQ("")} hitSlop={8}>
              <Feather name="x" size={16} color={t.tertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {!q ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
          <Feather name="search" size={44} color={t.hairline} />
          <Text style={{ color: t.subtext, fontWeight: "700", textAlign: "center", lineHeight: 22 }}>
            {tt("search.startTyping")}
          </Text>
        </View>
      ) : results.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 }}>
          <Feather name="x-circle" size={44} color={t.hairline} />
          <Text style={{ color: t.subtext, fontWeight: "700", textAlign: "center" }}>
            {tt("search.noResults").replace("{{q}}", q)}
          </Text>
        </View>
      ) : (
        <>
          <Text style={{ color: t.tertiary, fontWeight: "800", fontSize: 12, paddingHorizontal: 20, marginBottom: 8 }}>
            {results.length} {results.length === 1 ? tt("search.result") : tt("search.results")}
          </Text>
          <FlatList
            data={results}
            keyExtractor={(x) => `${x.kind}-${x.id}`}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 8 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <SearchResult item={item} tt={tt} onPress={() => onSelect(item)} />
            )}
          />
        </>
      )}
    </SafeAreaView>
  );
}

function SearchResult({ item, tt, onPress }) {
  const t = useTheme();
  const name = pickName(item);
  const domain = pickDomain(item);
  const amount = Number(item.effectiveAmount ?? item.amount ?? 0);
  const currency = item.currency || "USD";
  const cadence = item.cadence || "";
  const isBill = item.kind === "bill";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatMoney(amount, currency)}`}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 12,
        padding: 12, borderRadius: 18,
        borderWidth: 1, borderColor: t.hairline,
        backgroundColor: pressed ? t.surface2 : t.surface,
      })}
    >
      <BrandAvatar domain={domain} name={name} size={44} billIconKey={isBill ? "bill" : undefined} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }} numberOfLines={1}>{name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
          <View style={{
            paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
            backgroundColor: isBill ? "#64D2FF22" : t.accent + "22",
          }}>
            <Text style={{ fontSize: 10, fontWeight: "800", color: isBill ? "#64D2FF" : t.accent }}>
              {isBill ? tt("search.kindBill") : tt("search.kindSubscription")}
            </Text>
          </View>
          {cadence ? (
            <Text style={{ color: t.subtext, fontSize: 12, fontWeight: "600" }}>{cadence}</Text>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: t.text, fontWeight: "800" }}>{formatMoney(amount, currency)}</Text>
        <Feather name="chevron-right" size={14} color={t.tertiary} style={{ marginTop: 4 }} />
      </View>
    </Pressable>
  );
}
