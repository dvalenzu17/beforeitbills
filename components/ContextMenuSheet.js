// components/ContextMenuSheet.js
import React from "react";
import { Modal, View, Text, Pressable, Share } from "react-native";
import { useTheme } from "../lib/theme";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { formatMoney } from "../lib/utils";

/**
 * Cross-platform action sheet triggered by long press.
 *
 * Props:
 *   visible    - boolean
 *   item       - { name, amount, currency, cadence, kind, id }
 *   onClose    - fn
 *   onEdit     - fn
 *   onArchive  - fn
 *   onCancel   - fn | null (pass null to hide "Cancel subscription" action; bills don't have this)
 *   onDelete   - fn | null
 */
export default function ContextMenuSheet({ visible, item, onClose, onEdit, onArchive, onCancel, onDelete }) {
  const t = useTheme();
  const { t: tt } = useTranslation();

  if (!item) return null;

  const name = item.name || item.merchant || item.title || "";
  const amount = Number(item.effectiveAmount ?? item.amount ?? 0);
  const currency = item.currency || "USD";
  const cadence = item.cadence || "";
  const isBill = item.kind === "bill";

  async function handleShare() {
    onClose();
    const detail = amount > 0
      ? `${formatMoney(amount, currency)}${cadence ? `/${cadence}` : ""}`
      : "";
    const text = detail ? `${name} · ${detail}` : name;
    try {
      await Share.share({ message: text });
    } catch (e) {
      if (__DEV__) console.warn("[ContextMenu] share failed:", e?.message);
    }
  }

  function wrap(fn) {
    return () => { onClose(); fn?.(); };
  }

  const actions = [
    {
      icon: "edit-2",
      label: tt("recurring_screen.swipeEdit"),
      color: t.text,
      onPress: wrap(onEdit),
    },
    {
      icon: "archive",
      label: tt("recurring_screen.swipeArchive"),
      color: "#F59E0B",
      onPress: wrap(onArchive),
    },
    // Cancel subscription - subs only
    !isBill && onCancel ? {
      icon: "x-circle",
      label: tt("recurring_screen.contextCancel"),
      color: "#FF3B30",
      onPress: wrap(onCancel),
    } : null,
    {
      icon: "share-2",
      label: tt("common.share"),
      color: t.text,
      onPress: handleShare,
    },
    onDelete ? {
      icon: "trash-2",
      label: tt("recurring_screen.swipeDelete"),
      color: "#EF4444",
      onPress: wrap(onDelete),
    } : null,
  ].filter(Boolean);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={tt("common.cancel")}
      >
        {/* Sheet - inner Pressable prevents backdrop tap from propagating through */}
        <Pressable onPress={() => {}}>
          <View style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingBottom: 34,
          }}>
            {/* Drag handle */}
            <View style={{
              width: 36, height: 4, borderRadius: 99,
              backgroundColor: t.hairline,
              alignSelf: "center",
              marginTop: 10, marginBottom: 16,
            }} />

            {/* Item header */}
            <View style={{
              paddingHorizontal: 20, paddingBottom: 14,
              borderBottomWidth: 1, borderBottomColor: t.hairline,
            }}>
              <Text
                style={{ color: t.text, fontWeight: "900", fontSize: 17 }}
                numberOfLines={1}
              >
                {name}
              </Text>
              {amount > 0 ? (
                <Text style={{ color: t.subtext, marginTop: 4, fontWeight: "600" }}>
                  {formatMoney(amount, currency)}{cadence ? ` · ${cadence}` : ""}
                </Text>
              ) : null}
            </View>

            {/* Actions */}
            {actions.map((a, i) => (
              <Pressable
                key={i}
                onPress={a.onPress}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: 16,
                  paddingHorizontal: 20, paddingVertical: 15,
                  backgroundColor: pressed ? t.surface2 : "transparent",
                })}
              >
                <Feather name={a.icon} size={20} color={a.color} />
                <Text style={{ color: a.color, fontWeight: "700", fontSize: 16 }}>{a.label}</Text>
              </Pressable>
            ))}

            {/* Cancel dismiss */}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={tt("common.cancel")}
              style={({ pressed }) => ({
                marginHorizontal: 16, marginTop: 8,
                padding: 15, borderRadius: 18,
                backgroundColor: pressed ? t.hairline : t.surface2,
                alignItems: "center",
              })}
            >
              <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>
                {tt("common.cancel")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
