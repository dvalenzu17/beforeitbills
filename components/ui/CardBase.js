// components/ui/CardBase.js
import React from "react";
import { View } from "react-native";
import { useTheme } from "../../lib/theme";

export default function CardBase({ children, style, variant = "default" }) {
  const t = useTheme();

  const bg =
    variant === "soft" ? t.surface2 :
    variant === "glass" ? t.surface :
    t.card || t.surface;

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: t.r20 ?? 20,
          borderWidth: 1,
          borderColor: t.hairline,
          padding: 16,
        },
        t.shadowMd,
        style,
      ]}
    >
      {children}
    </View>
  );
}
