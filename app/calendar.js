// app/calendar.js
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { SPACING } from "../lib/ui/tokens";
import Screen from "../components/Screen";
import Card from "../components/Card";
import PressableScale from "../components/PressableScale";

import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";
import { formatMoney, normalizeCadence, stepByCadence } from "../lib/utils";

function pad2(n) { return String(n).padStart(2, "0"); }
function toISODate(d) {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
function startOfMonthUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}
function addMonthsUTC(date, m) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() + m);
  return d;
}
function daysInMonthUTC(date) {
  const y = date.getUTCFullYear();
  const mo = date.getUTCMonth();
  return new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
}
function weekdayOfFirstUTC(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).getUTCDay();
}
function prettyMonthTitle(d) {
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}
function chipStyle(t, active) {
  return {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: active ? "rgba(155,135,245,0.8)" : t.hairline,
    backgroundColor: active ? "rgba(155,135,245,0.14)" : "rgba(255,255,255,0.05)",
  };
}

export default function CalendarView() {
  const t = useTheme();
  const r = useRouter();

  const getRecurring = useStore((s) => s.getRecurring);
  const subs = useStore((s) => s.subs || []);
  const bills = useStore((s) => s.bills || []);

  const [filter, setFilter] = useState("all");
  const [selectedDay, setSelectedDay] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const now = useMemo(() => new Date(), []);

  const visibleMonths = useMemo(() => {
    const m0 = startOfMonthUTC(new Date());
    const m1 = addMonthsUTC(m0, 1);
    return [m0, m1];
  }, []);

  const recurring = useMemo(
    () => getRecurring?.() || [],
    [getRecurring, subs, bills]
  );

  const events = useMemo(() => {
    const horizonDays = 90;
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + horizonDays)
    );

    const out = [];

    for (const item of recurring) {
      if (!item?.nextDate) continue;

      const kind = item.kind;
      const cadence =
        kind === "bill"
          ? "monthly"
          : normalizeCadence(item.cadence || "monthly");

      let d = new Date(`${item.nextDate}T00:00:00Z`);
      let guard = 0;

      while (d <= end && guard < 60) {
        const iso = toISODate(d);

        out.push({
          iso,
          kind,
          type: kind === "bill" ? "bill" : "sub",
          id: item.id,
          title: item.title || item.merchant || item.name || "Unknown",
          domain: item.domain || item.fromDomain || "",
          name: item.merchant || item.title || item.name || "",
          amount: Number(item.effectiveAmount || item.amount || 0),
          currency: item.currency || "USD",
          cadence,
        });

        d = stepByCadence(d, cadence);
        guard++;
      }
    }

    // trial events — use canonical trial_end field from store
    for (const s of subs || []) {
      const trialEnd = s?.trial_end || null;
      const isTrial = !!(s?.is_trial || s?.isTrial);

      if (!isTrial || !trialEnd) continue;

      const d = new Date(`${trialEnd}T00:00:00Z`);
      const iso = toISODate(d);

      out.push({
        iso,
        kind: "subscription",
        type: "trial",
        id: s.id,
        title: s.merchant || "Trial",
        domain: s.domain || s.fromDomain || "",
        name: s.merchant || "",
        amount: Number(s.amount || 0),
        currency: s.currency || "USD",
        cadence: normalizeCadence(s.cadence || "monthly"),
      });
    }

    return out;
  }, [recurring, subs, now]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "subs") return events.filter((e) => e.type === "sub");
    if (filter === "bills") return events.filter((e) => e.type === "bill");
    if (filter === "trials") return events.filter((e) => e.type === "trial");
    return events;
  }, [events, filter]);

  const dayAgg = useMemo(() => {
    const m = new Map();
    for (const e of filteredEvents) {
      const cur = m.get(e.iso) || { count: 0, total: 0 };
      cur.count++;
      cur.total += Number(e.amount || 0);
      m.set(e.iso, cur);
    }
    return m;
  }, [filteredEvents]);

  const maxDayTotal = useMemo(() => {
    let mx = 0;
    dayAgg.forEach((v) => { if (v.total > mx) mx = v.total; });
    return mx || 1;
  }, [dayAgg]);

  const next30Cashflow = useMemo(() => {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
    const end = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30)
    );
    let sum = 0;
    for (const e of filteredEvents) {
      const d = new Date(`${e.iso}T00:00:00Z`);
      if (d >= start && d <= end) sum += Number(e.amount || 0);
    }
    return sum;
  }, [filteredEvents, now]);

  const selectedEvents = useMemo(() => {
    if (!selectedDay) return [];
    return filteredEvents
      .filter((e) => e.iso === selectedDay)
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [filteredEvents, selectedDay]);

  function openDay(iso) {
    setSelectedDay(iso);
    setModalOpen(true);
  }

  function goEvent(e) {
    setModalOpen(false);
    // Navigate to brand page — the correct route that exists in this codebase.
    // Pass domain if available, fall back to name. BrandPage filters recurring by both.
    r.push({
      pathname: "/brand",
      params: {
        domain: e.domain || "",
        name: e.name || e.title || "",
      },
    });
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <PressableScale
          onPress={() => r.back()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0,0,0,0.25)",
            borderWidth: 1,
            borderColor: t.hairline,
            marginRight: 12,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={t.text} />
        </PressableScale>

        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 26, fontWeight: "800" }}>Calendar</Text>
          <Text style={{ color: t.subtext, marginTop: 2 }}>
            What's hitting your wallet day by day.
          </Text>
        </View>
      </View>

      <Card style={{ padding: 18, borderRadius: 22 }}>
        <Text style={{ color: t.subtext, fontWeight: "700" }}>Cashflow next 30 days</Text>
        <Text style={{ color: t.text, fontSize: 30, fontWeight: "800", marginTop: 6 }}>
          {formatMoney(next30Cashflow, "USD")}
        </Text>

        <View style={{ height: 16 }} />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {["all", "subs", "bills", "trials"].map((f) => (
            <Pressable key={f} onPress={() => setFilter(f)} style={chipStyle(t, filter === f)}>
              <Text style={{ color: t.text, fontWeight: filter === f ? "800" : "600" }}>
                {f === "all" ? "All" : f === "subs" ? "Subs" : f === "bills" ? "Bills" : "Trials"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </Card>

      <ScrollView contentContainerStyle={{ paddingBottom: 110, gap: 16, paddingTop: 6 }}>
        {visibleMonths.map((m) => (
          <MonthBlock
            key={toISODate(m)}
            monthStart={m}
            t={t}
            dayAgg={dayAgg}
            maxDayTotal={maxDayTotal}
            onPressDay={openDay}
          />
        ))}
      </ScrollView>

      <Modal visible={modalOpen} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setModalOpen(false)} />

        <View style={[styles.sheet, { backgroundColor: t.card, borderColor: t.hairline }]}>
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.25)",
              alignSelf: "center",
              marginBottom: 12,
            }}
          />

          <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>
            {selectedDay}
          </Text>

          <View style={{ height: 12 }} />

          <FlatList
            data={selectedEvents}
            keyExtractor={(e, i) => `${e.iso}-${e.id}-${i}`}
            renderItem={({ item }) => (
              <PressableScale
                onPress={() => goEvent(item)}
                style={{
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: t.hairline,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: t.text, fontWeight: "700", fontSize: 16 }}>
                  {item.title}
                </Text>
                <Text style={{ color: t.subtext, fontSize: 13, marginTop: 4 }}>
                  {formatMoney(item.amount, item.currency)}
                </Text>
              </PressableScale>
            )}
          />
        </View>
      </Modal>
    </Screen>
  );
}

function MonthBlock({ monthStart, t, dayAgg, maxDayTotal, onPressDay }) {
  const firstWeekday = weekdayOfFirstUTC(monthStart);
  const totalDays = daysInMonthUTC(monthStart);
  const todayIso = toISODate(new Date());

  const cells = [];

  for (let i = 0; i < firstWeekday; i++) cells.push(null);

  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(
      Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), d)
    );
    cells.push(date);
  }

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: t.text, fontWeight: "800", fontSize: 18 }}>
        {prettyMonthTitle(monthStart)}
      </Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((d, idx) => {
          const iso = d ? toISODate(d) : null;
          const agg = iso ? dayAgg.get(iso) : null;
          const isToday = iso === todayIso;

          return (
            <Pressable
              key={idx}
              disabled={!d}
              onPress={() => iso && onPressDay(iso)}
              style={{ width: "14.2857%", aspectRatio: 1, padding: 6 }}
            >
              <View
                style={{
                  flex: 1,
                  borderRadius: 18,
                  borderWidth: 1,
                  borderColor: isToday ? "rgba(155,135,245,0.95)" : t.hairline,
                  backgroundColor: isToday
                    ? "rgba(155,135,245,0.30)"
                    : "rgba(255,255,255,0.04)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {d && (
                  <>
                    <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>
                      {d.getUTCDate()}
                    </Text>

                    {agg?.count ? (
                      <View style={{ flexDirection: "row", gap: 3, marginTop: 4 }}>
                        {Array(Math.min(agg.count, 3))
                          .fill(0)
                          .map((_, i) => (
                            <View
                              key={i}
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: 2,
                                backgroundColor: "rgba(155,135,245,0.9)",
                              }}
                            />
                          ))}
                      </View>
                    ) : null}
                  </>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    maxHeight: "70%",
    borderRadius: 26,
    borderWidth: 1,
    padding: SPACING.screen,
  },
});