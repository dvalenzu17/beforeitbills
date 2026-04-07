// components/ui/Tile.js
import React from "react";
import { View } from "react-native";
import { useTheme } from "../../lib/theme";

export default function Tile({ children, style }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface2,
          borderRadius: t.r16 ?? 16,
          borderWidth: 1,
          borderColor: t.hairline,
          padding: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
