// components/ConflictResolutionSheet.js
import React, { useMemo } from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { useTheme } from "../lib/theme";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { formatMoney } from "../lib/utils";

function relativeTime(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  if (isNaN(diff) || diff < 0) return null;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function SubSummary({ sub, label, isWinner, t, tt }) {
  const amount = Number(sub?.amount ?? sub?.renewal_amount ?? 0);
  const currency = sub?.currency || "USD";
  const cadence = sub?.cadence || sub?.billing_interval || "monthly";
  const merchant = sub?.merchant || "Unknown";
  const updatedAt = sub?.updatedAt || sub?.updated_at;

  return (
    <View style={{
      flex: 1,
      padding: 14,
      borderRadius: 18,
      borderWidth: isWinner ? 2 : 1,
      borderColor: isWinner ? t.accent : t.hairline,
      backgroundColor: isWinner ? t.accent + "11" : t.surface2,
      gap: 6,
    }}>
      <Text style={{ color: t.tertiary, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </Text>
      <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }} numberOfLines={1}>
        {merchant}
      </Text>
      <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 14 }}>
        {formatMoney(amount, currency)}
        <Text style={{ color: t.tertiary, fontWeight: "600", fontSize: 12 }}>/{cadence}</Text>
      </Text>
      {updatedAt ? (
        <Text style={{ color: t.tertiary, fontSize: 11, fontWeight: "600" }}>
          {relativeTime(updatedAt)}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Shows one conflict at a time.
 *
 * Props:
 *   conflicts       - array of { id, local, remote }
 *   onKeepLocal(id) - user chose their version
 *   onKeepRemote(id) - user chose the other device's version
 *   onSkip(id)      - dismiss without resolving (comes back next sync)
 */
export default function ConflictResolutionSheet({ conflicts, onKeepLocal, onKeepRemote, onSkip }) {
  const t = useTheme();
  const { t: tt } = useTranslation();

  const conflict = conflicts?.[0] ?? null;
  const remaining = conflicts?.length ?? 0;
  const visible = remaining > 0 && !!conflict;

  const localNewer = useMemo(() => {
    if (!conflict) return false;
    const lt = conflict.local?.updatedAt ? new Date(conflict.local.updatedAt).getTime() : 0;
    const rt = conflict.remote?.updatedAt ? new Date(conflict.remote.updatedAt).getTime() : 0;
    return lt >= rt;
  }, [conflict]);

  if (!visible) return null;

  const merchantName = conflict.remote?.merchant || conflict.local?.merchant || tt("conflict.unknownItem");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => onSkip?.(conflict.id)}
    >
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View style={{
          backgroundColor: t.surface,
          borderTopLeftRadius: 26,
          borderTopRightRadius: 26,
          paddingBottom: 40,
        }}>
          {/* Handle */}
          <View style={{
            width: 36, height: 4, borderRadius: 99,
            backgroundColor: t.hairline,
            alignSelf: "center",
            marginTop: 10, marginBottom: 18,
          }} />

          {/* Header */}
          <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 8,
                backgroundColor: "#FF9F0A22",
                alignItems: "center", justifyContent: "center",
              }}>
                <Feather name="alert-triangle" size={14} color="#FF9F0A" />
              </View>
              <Text style={{ color: "#FF9F0A", fontWeight: "900", fontSize: 13 }}>
                {remaining > 1
                  ? tt("conflict.titlePlural").replace("{{n}}", remaining)
                  : tt("conflict.title")}
              </Text>
            </View>
            <Text style={{ color: t.text, fontWeight: "900", fontSize: 19 }} numberOfLines={1}>
              {merchantName}
            </Text>
            <Text style={{ color: t.subtext, marginTop: 4, fontWeight: "600", lineHeight: 20 }}>
              {tt("conflict.subtitle")}
            </Text>
          </View>

          {/* Side-by-side comparison */}
          <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
            <SubSummary
              sub={conflict.local}
              label={tt("conflict.thisDevice")}
              isWinner={localNewer}
              t={t}
              tt={tt}
            />
            <SubSummary
              sub={conflict.remote}
              label={tt("conflict.otherDevice")}
              isWinner={!localNewer}
              t={t}
              tt={tt}
            />
          </View>

          {/* Actions */}
          <View style={{ paddingHorizontal: 20, gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => onKeepLocal?.(conflict.id)}
                accessibilityRole="button"
                accessibilityLabel={tt("conflict.keepMine")}
                style={({ pressed }) => ({
                  flex: 1, padding: 14, borderRadius: 16, alignItems: "center",
                  backgroundColor: pressed ? t.accent + "CC" : t.accent,
                })}
              >
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 15 }}>
                  {tt("conflict.keepMine")}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => onKeepRemote?.(conflict.id)}
                accessibilityRole="button"
                accessibilityLabel={tt("conflict.useTheirs")}
                style={({ pressed }) => ({
                  flex: 1, padding: 14, borderRadius: 16, alignItems: "center",
                  borderWidth: 1, borderColor: t.hairline,
                  backgroundColor: pressed ? t.surface2 : t.surface,
                })}
              >
                <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }}>
                  {tt("conflict.useTheirs")}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => onSkip?.(conflict.id)}
              accessibilityRole="button"
              accessibilityLabel={tt("conflict.skipForNow")}
              style={({ pressed }) => ({
                padding: 12, alignItems: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: t.tertiary, fontWeight: "700", fontSize: 14 }}>
                {tt("conflict.skipForNow")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
