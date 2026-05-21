// app/recurring.js
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Alert, View, Text, TextInput, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";
import { Feather } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";

import { SPACING } from "@/lib/ui/tokens";
import { useTheme } from "../lib/theme";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/utils";

import BrandAvatar from "../components/BrandAvatar";
import ProofModal from "../components/ProofModal";
import EmptyStateCard from "../components/EmptyStateCard";
import { BiBRefreshControl, BiBRefreshBanner } from "../components/BiBRefreshControl";
import CelebrationSheet from "../components/CelebrationSheet";
import ContextMenuSheet from "../components/ContextMenuSheet";

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function pickDomain(x) {
  return x?.domain || x?.fromDomain || x?.merchantDomain || x?.brandDomain || x?.senderDomain || "";
}

function pickName(x) {
  return x?.title || x?.name || x?.merchant || x?.brand || x?.fromName || "Unknown";
}

function getAmount(x) {
  return Number(x?.effectiveAmount ?? x?.amount ?? x?.monthlyAmount ?? 0) || 0;
}

function getCurrency(x) {
  return x?.currency || "USD";
}

function getNextDate(x) {
  return x?.nextDate || x?.next_charge_at || x?.nextChargeAt || null;
}

function getStatus(x) {
  if (x?.active === false) return "cancelled";
  const s = norm(x?.status || x?.state || "");
  if (s.includes("trial")) return "trial";
  if (s.includes("pause")) return "paused";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("active")) return "active";
  return s || "active";
}

function getConfidence(x) {
  const c = x?.confidence;
  if (c == null) return null;
  const n = Number(c);
  if (Number.isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

function itemKey(x) {
  return `${x?.kind || "k"}-${x?.id || ""}`;
}

function FilterSection({ label, children }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: "#888", fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 }}>{label}</Text>
      {children}
    </View>
  );
}

function FilterRow({ children }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}

function FilterCheck({ t, active, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row", alignItems: "center", gap: 6,
        paddingVertical: 8, paddingHorizontal: 12,
        borderRadius: 10, borderWidth: 1,
        borderColor: active ? t.accent : t.hairline,
        backgroundColor: active ? t.accent + "18" : t.surface2,
      }}
    >
      <View style={{
        width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
        borderColor: active ? t.accent : t.tertiary,
        backgroundColor: active ? t.accent : "transparent",
        alignItems: "center", justifyContent: "center",
      }}>
        {active ? <Feather name="check" size={10} color="#fff" /> : null}
      </View>
      <Text style={{ color: active ? t.accent : t.text, fontWeight: "700", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

function Chip({ active, label, onPress, icon }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? t.accent : t.hairline,
        backgroundColor: active ? t.accent : t.surface2,
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
      }}
    >
      {icon ? <Feather name={icon} size={12} color={active ? "#fff" : t.text} /> : null}
      <Text style={{ color: active ? "#fff" : t.text, fontWeight: "800", fontSize: 12 }}>{label}</Text>
    </Pressable>
  );
}

// Row used in both normal and drag modes
function Row({ item, onPress, onLongPress, dragHandle, isActive }) {
  const t = useTheme();
  const name = pickName(item);
  const domain = pickDomain(item);
  const amount = getAmount(item);
  const currency = getCurrency(item);
  const cadence = item?.cadence || item?.interval || "mo";
  const next = getNextDate(item);
  const status = getStatus(item);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: SPACING.screen,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isActive ? t.accent : t.hairline,
        backgroundColor: isActive ? (t.accent + "18") : t.surface,
      }}
    >
      <BrandAvatar domain={domain} name={name} size={46} />

      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>{name}</Text>
        <Text style={{ color: t.subtext, marginTop: 3, fontWeight: "600" }}>
          {domain || cadence}
          {next ? ` · next ${String(next).slice(0, 10)}` : ""}
          {status ? ` · ${status}` : ""}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ color: t.text, fontWeight: "800" }}>
          {formatMoney?.(amount, currency) ?? `${amount} ${currency}`}
        </Text>
        <Text style={{ color: t.subtext, marginTop: 3, fontWeight: "600" }}>/ {cadence}</Text>
      </View>

      {dragHandle ? (
        <Pressable
          onLongPress={dragHandle}
          delayLongPress={100}
          hitSlop={8}
          style={{ padding: 4 }}
        >
          <Feather name="menu" size={18} color={t.tertiary} />
        </Pressable>
      ) : (
        <Feather name="chevron-right" size={18} color={t.tertiary} />
      )}
    </Pressable>
  );
}

function SwipeableRow({ item, onPress, onLongPress, onEdit, onArchive, onDelete }) {
  const swipeRef = useRef(null);
  const { t: tt } = useTranslation();

  function close() {
    swipeRef.current?.close();
  }

  function renderLeftActions() {
    return (
      <Pressable
        onPress={() => { close(); onEdit(); }}
        style={{
          justifyContent: "center",
          alignItems: "center",
          width: 72,
          marginRight: 8,
          borderRadius: 20,
          backgroundColor: "#7DD3FC",
        }}
      >
        <Feather name="edit-2" size={18} color="#0B0F17" />
        <Text style={{ color: "#0B0F17", fontSize: 11, fontWeight: "800", marginTop: 4 }}>
          {tt("recurring_screen.swipeEdit")}
        </Text>
      </Pressable>
    );
  }

  function renderRightActions() {
    return (
      <View style={{ flexDirection: "row", gap: 8, marginLeft: 8 }}>
        <Pressable
          onPress={() => { close(); onArchive(); }}
          style={{
            justifyContent: "center",
            alignItems: "center",
            width: 72,
            borderRadius: 20,
            backgroundColor: "#F59E0B",
          }}
        >
          <Feather name="archive" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800", marginTop: 4 }}>
            {tt("recurring_screen.swipeArchive")}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => { close(); onDelete(); }}
          style={{
            justifyContent: "center",
            alignItems: "center",
            width: 72,
            borderRadius: 20,
            backgroundColor: "#EF4444",
          }}
        >
          <Feather name="trash-2" size={18} color="#fff" />
          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800", marginTop: 4 }}>
            {tt("recurring_screen.swipeDelete")}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      friction={2}
      onSwipeableWillOpen={() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      }
    >
      <Row item={item} onPress={onPress} onLongPress={onLongPress} />
    </Swipeable>
  );
}

export default function RecurringScreen() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();
  const params = useLocalSearchParams();

  const getRecurring = useStore((s) => s.getRecurring);
  const subs = useStore((s) => s.subs);
  const bills = useStore((s) => s.bills);
  const user = useStore((s) => s.user);
  const fetchSubs = useStore((s) => s.fetchSubs);
  const loadSubsLocal = useStore((s) => s.loadSubsLocal);
  const updateSub = useStore((s) => s.updateSub);
  const deleteSub = useStore((s) => s.deleteSub);
  const updateBill = useStore((s) => s.updateBill);
  const deleteBill = useStore((s) => s.deleteBill);
  const sortOrder = useStore((s) => s.sortOrder);
  const setSortOrder = useStore((s) => s.setSortOrder);

  const recurring = useMemo(() => getRecurring?.() || [], [getRecurring, subs, bills]);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [trialOnly, setTrialOnly] = useState(params?.filter === "trials");
  const [status, setStatus] = useState("all");
  const [celebration, setCelebration] = useState(null);
  const [conf, setConf] = useState("all");
  const [sort, setSort] = useState("amount");
  const [filtersOpen, setFiltersOpen] = useState(params?.filter === "trials");

  const [proofOpen, setProofOpen] = useState(false);
  const [proofItem, setProofItem] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [contextItem, setContextItem] = useState(null);

  const isDragMode = sort === "custom";

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (user) await fetchSubs?.();
      else await loadSubsLocal?.();
    } catch (e) {
      if (__DEV__) console.warn("[recurring] refresh failed:", e?.message);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  const isTrulyEmpty = (recurring?.length || 0) === 0;

  const filtered = useMemo(() => {
    const qq = norm(q);

    let list = (recurring || []).filter((x) => {
      const name = norm(pickName(x));
      const domain = norm(pickDomain(x));
      const matchQ = !qq || name.includes(qq) || domain.includes(qq);

      const matchKind =
        kind === "all" ? true :
        kind === "bill" ? x?.kind === "bill" :
        x?.kind !== "bill";

      const st = getStatus(x);
      const matchStatus = status === "all" ? true : st === status;
      const matchTrial = !trialOnly ? true : st === "trial" || !!x?.trialEndsAt || !!x?.trial_end_at;

      const c = getConfidence(x);
      const matchConf =
        conf === "all" ? true :
        conf === "high" ? (c == null ? false : c >= 0.75) :
        conf === "low" ? (c == null ? false : c < 0.75) :
        true;

      return matchQ && matchKind && matchStatus && matchTrial && matchConf;
    });

    if (sort === "custom" && sortOrder.length > 0) {
      const posMap = new Map(sortOrder.map((k, i) => [k, i]));
      list.sort((a, b) => {
        const pa = posMap.has(itemKey(a)) ? posMap.get(itemKey(a)) : 99999;
        const pb = posMap.has(itemKey(b)) ? posMap.get(itemKey(b)) : 99999;
        return pa - pb;
      });
    } else if (sort === "name") {
      list.sort((a, b) => pickName(a).localeCompare(pickName(b)));
    } else if (sort === "next") {
      list.sort((a, b) => {
        const da = getNextDate(a) ? new Date(getNextDate(a)).getTime() : Number.POSITIVE_INFINITY;
        const db = getNextDate(b) ? new Date(getNextDate(b)).getTime() : Number.POSITIVE_INFINITY;
        return da - db;
      });
    } else if (sort !== "custom") {
      list.sort((a, b) => getAmount(b) - getAmount(a));
    }

    return list;
  }, [recurring, q, kind, trialOnly, status, conf, sort, sortOrder]);

  function handleDragEnd({ data }) {
    const newOrder = data.map(itemKey);
    setSortOrder(newOrder);
  }

  const openProof = (x) => {
    setProofItem({
      ...x,
      name: pickName(x),
      merchant: pickName(x),
      domain: pickDomain(x),
    });
    setProofOpen(true);
  };

  function clearFilters() {
    setQ("");
    setKind("all");
    setTrialOnly(false);
    setStatus("all");
    setConf("all");
    setSort("amount");
  }

  const activeFilterCount = [
    kind !== "all",
    trialOnly,
    status !== "all",
    conf !== "all",
    sort !== "amount",
  ].filter(Boolean).length;

  // Shared row action handlers (used by both normal and drag render paths)
  function makeRowActions(x) {
    return {
      onPress: () => openProof(x),
      onLongPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        setContextItem(x);
      },
      onEdit: () => {
        if (x.kind === "bill") r.push("/bill/" + x.id);
        else r.push("/sub/" + x.id);
      },
      onArchive: async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        const result = x.kind === "bill"
          ? await updateBill?.(x.id, { active: false })
          : await updateSub?.(x.id, { active: false });
        if (result?.savedEntry) setCelebration(result.savedEntry);
      },
      onDelete: () => {
        Alert.alert(
          tt("recurring_screen.deleteAlertTitle"),
          tt("recurring_screen.deleteAlertBody", { name: pickName(x) }),
          [
            { text: tt("common.cancel"), style: "cancel" },
            {
              text: tt("recurring_screen.deleteAlertConfirm"),
              style: "destructive",
              onPress: () => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                if (x.kind === "bill") deleteBill?.(x.id);
                else deleteSub?.(x.id);
              },
            },
          ]
        );
      },
    };
  }

  const header = (
    <View style={{ padding: 16, paddingBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable
          onPress={() => r.back()}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface,
          }}
        >
          <Feather name="arrow-left" size={16} color={t.text} />
        </Pressable>

        <Text style={{ color: t.text, fontSize: 22, fontWeight: "800" }}>
          {tt("recurring_screen.title")}
        </Text>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={() => r.push("/search")}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface,
          }}
        >
          <Feather name="search" size={16} color={t.text} />
        </Pressable>

        <Pressable
          onPress={() => r.push("/add-recurring")}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface,
          }}
        >
          <Feather name="plus" size={16} color={t.text} />
        </Pressable>
      </View>

      {/* Search */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginTop: 12,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: t.hairline,
          backgroundColor: t.surface,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Feather name="search" size={16} color={t.tertiary} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={tt("recurring_screen.searchPlaceholder")}
          placeholderTextColor={t.tertiary}
          style={{ flex: 1, color: t.text, fontWeight: "700" }}
          returnKeyType="search"
        />
        {!!q && (
          <Pressable onPress={() => setQ("")} style={{ padding: 6 }}>
            <Feather name="x" size={16} color={t.tertiary} />
          </Pressable>
        )}
      </View>

      {/* Filter bar: count + toggle button */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
        <Text style={{ color: t.subtext, fontWeight: "800" }}>
          {filtered.length} {tt("recurring_screen.results").replace("{{n}} ", "")}
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {activeFilterCount > 0 && (
            <Pressable
              onPress={clearFilters}
              style={{
                paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999,
                borderWidth: 1, borderColor: "#FF3B3055",
                backgroundColor: "#FF3B3011",
                flexDirection: "row", alignItems: "center", gap: 5,
              }}
            >
              <Feather name="x" size={12} color="#FF3B30" />
              <Text style={{ color: "#FF3B30", fontWeight: "800", fontSize: 12 }}>Clear ({activeFilterCount})</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => setFiltersOpen((v) => !v)}
            style={{
              paddingVertical: 7, paddingHorizontal: 12, borderRadius: 999,
              borderWidth: 1,
              borderColor: filtersOpen || activeFilterCount > 0 ? t.accent : t.hairline,
              backgroundColor: filtersOpen || activeFilterCount > 0 ? t.accent + "18" : t.surface2,
              flexDirection: "row", alignItems: "center", gap: 5,
            }}
          >
            <Feather name="sliders" size={13} color={filtersOpen || activeFilterCount > 0 ? t.accent : t.text} />
            <Text style={{ color: filtersOpen || activeFilterCount > 0 ? t.accent : t.text, fontWeight: "800", fontSize: 12 }}>
              Filter{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <View style={{
          marginTop: 10, padding: 14, borderRadius: 16,
          backgroundColor: t.surface, borderWidth: 1, borderColor: t.hairline, gap: 14,
        }}>

          <FilterSection label="Type">
            <FilterRow>
              <FilterCheck t={t} active={kind === "all"} label="All" onPress={() => setKind("all")} />
              <FilterCheck t={t} active={kind === "subscription"} label="Subscriptions" onPress={() => setKind(kind === "subscription" ? "all" : "subscription")} />
              <FilterCheck t={t} active={kind === "bill"} label="Bills" onPress={() => setKind(kind === "bill" ? "all" : "bill")} />
              <FilterCheck t={t} active={trialOnly} label="Trials only" onPress={() => setTrialOnly((v) => !v)} />
            </FilterRow>
          </FilterSection>

          <FilterSection label="Status">
            <FilterRow>
              <FilterCheck t={t} active={status === "all"} label="All" onPress={() => setStatus("all")} />
              <FilterCheck t={t} active={status === "active"} label="Active" onPress={() => setStatus(status === "active" ? "all" : "active")} />
              <FilterCheck t={t} active={status === "paused"} label="Paused" onPress={() => setStatus(status === "paused" ? "all" : "paused")} />
              <FilterCheck t={t} active={status === "cancelled"} label="Cancelled" onPress={() => setStatus(status === "cancelled" ? "all" : "cancelled")} />
            </FilterRow>
          </FilterSection>

          <FilterSection label="Sort by">
            <FilterRow>
              <FilterCheck t={t} active={sort === "amount"} label="Amount" onPress={() => setSort("amount")} />
              <FilterCheck t={t} active={sort === "next"} label="Next date" onPress={() => setSort("next")} />
              <FilterCheck t={t} active={sort === "name"} label="Name" onPress={() => setSort("name")} />
              <FilterCheck
                t={t}
                active={sort === "custom"}
                label="Custom order"
                onPress={() => {
                  if (sort !== "custom") {
                    if (sortOrder.length === 0) setSortOrder(filtered.map(itemKey));
                    setSort("custom");
                  } else {
                    setSort("amount");
                  }
                }}
              />
            </FilterRow>
          </FilterSection>

          <FilterSection label="Confidence">
            <FilterRow>
              <FilterCheck t={t} active={conf === "all"} label="All" onPress={() => setConf("all")} />
              <FilterCheck t={t} active={conf === "high"} label="High" onPress={() => setConf(conf === "high" ? "all" : "high")} />
              <FilterCheck t={t} active={conf === "low"} label="Low" onPress={() => setConf(conf === "low" ? "all" : "low")} />
            </FilterRow>
          </FilterSection>

        </View>
      )}

      {isDragMode && (
        <Text style={{ color: t.accent, fontWeight: "700", fontSize: 12, marginTop: 4, marginLeft: 2 }}>
          {tt("recurring_screen.dragHint")}
        </Text>
      )}
    </View>
  );

  const emptyContent = isTrulyEmpty ? (
    <EmptyStateCard
      icon="repeat"
      title={tt("recurring_screen.nothingTracked")}
      body={tt("recurring_screen.nothingTrackedBody")}
      primary={{
        title: tt("recurring_screen.addRecurring"),
        icon: "plus",
        onPress: () => r.push("/add-recurring"),
      }}
      secondary={{
        title: tt("recurring_screen.connectInbox"),
        icon: "link",
        onPress: () => r.push("/account/connect-email"),
      }}
    />
  ) : filtered.length === 0 ? (
    <EmptyStateCard
      icon="filter"
      title={tt("recurring_screen.noMatches")}
      body={tt("recurring_screen.noMatchesBody")}
      primary={{
        title: tt("recurring_screen.clearFilters"),
        icon: "x-circle",
        onPress: clearFilters,
      }}
      secondary={{
        title: tt("recurring_screen.addRecurring"),
        icon: "plus",
        onPress: () => r.push("/add-recurring"),
      }}
    />
  ) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      {isDragMode ? (
        // ── Drag mode: DraggableFlatList (no swipe, ≡ handle activates drag) ──
        <DraggableFlatList
          data={filtered}
          keyExtractor={(x, idx) => itemKey(x) || String(idx)}
          onDragEnd={handleDragEnd}
          onDragBegin={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})}
          activationDistance={10}
          contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 28, gap: 10 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <BiBRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListHeaderComponent={
            <>
              {header}
              <BiBRefreshBanner refreshing={refreshing} />
            </>
          }
          ListEmptyComponent={<View style={{ padding: 16 }}>{emptyContent}</View>}
          renderItem={({ item: x, drag, isActive }) => (
            <ScaleDecorator>
              <View style={{ marginBottom: 10 }}>
                <Row
                  item={x}
                  onPress={() => openProof(x)}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    setContextItem(x);
                  }}
                  dragHandle={drag}
                  isActive={isActive}
                />
              </View>
            </ScaleDecorator>
          )}
        />
      ) : (
        // ── Normal mode: ScrollView + SwipeableRow ──
        <>
          {header}
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 28, gap: 10 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <BiBRefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          >
            <BiBRefreshBanner refreshing={refreshing} />
            {emptyContent}
            {!isTrulyEmpty && filtered.length > 0 &&
              filtered.map((x, idx) => {
                const actions = makeRowActions(x);
                return (
                  <SwipeableRow
                    key={itemKey(x) || idx}
                    item={x}
                    onPress={actions.onPress}
                    onLongPress={actions.onLongPress}
                    onEdit={actions.onEdit}
                    onArchive={actions.onArchive}
                    onDelete={actions.onDelete}
                  />
                );
              })
            }
          </ScrollView>
        </>
      )}

      <ProofModal visible={proofOpen} item={proofItem} onClose={() => setProofOpen(false)} />
      <CelebrationSheet
        visible={!!celebration}
        entry={celebration}
        onDismiss={() => setCelebration(null)}
      />
      <ContextMenuSheet
        visible={!!contextItem}
        item={contextItem ? {
          name: pickName(contextItem),
          amount: getAmount(contextItem),
          currency: getCurrency(contextItem),
          cadence: contextItem.cadence || "",
          kind: contextItem.kind,
          id: contextItem.id,
        } : null}
        onClose={() => setContextItem(null)}
        onEdit={() => {
          if (!contextItem) return;
          if (contextItem.kind === "bill") r.push("/bill/" + contextItem.id);
          else r.push("/sub/" + contextItem.id);
        }}
        onArchive={async () => {
          if (!contextItem) return;
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
            const result = contextItem.kind === "bill"
              ? await updateBill?.(contextItem.id, { active: false })
              : await updateSub?.(contextItem.id, { active: false });
            if (result?.savedEntry) setCelebration(result.savedEntry);
          } catch (e) {
            if (__DEV__) console.warn("[recurring] context archive failed:", e?.message);
          } finally {
            setContextItem(null);
          }
        }}
        onCancel={contextItem?.kind !== "bill" ? () => {
          if (!contextItem) return;
          r.push({
            pathname: "/cancel-center",
            params: {
              name: pickName(contextItem),
              domain: pickDomain(contextItem),
              cadence: contextItem.cadence || "",
            },
          });
        } : null}
        onDelete={() => {
          if (!contextItem) return;
          Alert.alert(
            tt("recurring_screen.deleteAlertTitle"),
            tt("recurring_screen.deleteAlertBody", { name: pickName(contextItem) }),
            [
              { text: tt("common.cancel"), style: "cancel" },
              {
                text: tt("recurring_screen.deleteAlertConfirm"),
                style: "destructive",
                onPress: () => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
                  if (contextItem.kind === "bill") deleteBill?.(contextItem.id);
                  else deleteSub?.(contextItem.id);
                  setContextItem(null);
                },
              },
            ]
          );
        }}
      />
    </SafeAreaView>
  );
}
