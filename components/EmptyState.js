// components/EmptyState.js
import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import Button from "./Button";

export default function EmptyState({
  icon = "inbox",
  title = "Nothing here yet",
  description = "Add your first item to get started.",
  primaryLabel = "Add",
  onPrimary,
  secondaryLabel,
  onSecondary,
}) {
  const t = useTheme();

  return (
    <View
      style={{
        padding: 18,
        borderRadius: 22,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.hairline,
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
        alignItems: "center",
      }}
    >
      <View
        style={{
          width: 54,
          height: 54,
          borderRadius: 18,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.hairline,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        }}
      >
        <Feather name={icon} size={20} color={t.text} />
      </View>

      <Text style={{ color: t.text, fontWeight: "800", fontSize: 16, textAlign: "center" }}>
        {title}
      </Text>
      <Text style={{ color: t.subtext, fontWeight: "600", marginTop: 8, lineHeight: 18, textAlign: "center" }}>
        {description}
      </Text>

      <View style={{ width: "100%", marginTop: 14, gap: 10 }}>
        <Button title={primaryLabel} onPress={onPrimary} />
        {secondaryLabel ? <Button title={secondaryLabel} variant="secondary" onPress={onSecondary} /> : null}
      </View>
    </View>
  );
}
