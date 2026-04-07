// components/SharedBadge.js
import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

export default function SharedBadge({ count = 2, style }) {
  const t = useTheme();
  const n = Math.max(2, Number(count || 2));

  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: t.hairline,
          backgroundColor: "rgba(255,255,255,0.06)",
        },
        style,
      ]}
    >
      <Feather name="users" size={14} color={t.text} />
      <Text style={{ color: t.text, fontWeight: "900", fontSize: 12 }}>
        Shared ×{n}
      </Text>
    </View>
  );
}
