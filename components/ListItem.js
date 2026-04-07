// components/ListItem.js
import React from "react";
import { View, Text } from "react-native";
import PressableScale from "./PressableScale";
import { useTheme } from "../lib/theme";
import { formatMoney } from "../lib/utils";
import BrandAvatar from "./BrandAvatar";
import SharedBadge from "./SharedBadge";
import { SPACING } from "../lib/ui/tokens";

export default function ListItem({
  merchant,
  subtitle,
  amount,
  currency,
  onPress,
  onLongPress,
  index,
  domain,
  sharedCount,
  isShared,
  billIconKey,
}) {
  const t = useTheme();

  const sc = Number(sharedCount ?? 1) || 1;
  const shared = isShared === true || sc > 1;

  return (
    <PressableScale
      haptic="selection"
      onPress={onPress}
      onLongPress={onLongPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: SPACING.rowGap,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 18,
      }}
    >
      <BrandAvatar domain={domain} name={merchant} size={42} billIconKey={billIconKey} />

      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "900", fontSize: 15 }} numberOfLines={1}>
          {merchant}
        </Text>
        {!!subtitle ? (
          <Text style={{ color: t.subtext, marginTop: 3, fontWeight: "700" }} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {shared ? <SharedBadge count={sc} /> : null}

      <Text style={{ color: t.text, fontWeight: "900" }}>
        {formatMoney?.(amount, currency) ?? `${amount} ${currency || ""}`}
      </Text>

      <Text style={{ color: t.tertiary, marginLeft: 6 }}>›</Text>
    </PressableScale>
  );
}