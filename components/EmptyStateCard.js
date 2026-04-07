// components/EmptyStateCard.js
import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import Button from "./Button";
import { SPACING } from "../lib/ui/tokens";
export default function EmptyStateCard({
  title,
  body,
  primary,
  secondary,
  tertiary,
  icon = "search",
}) {
  const t = useTheme();

  return (
    <View
      style={{
        borderRadius: 22,
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: t.surface,
        padding: SPACING.screen,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Feather name={icon} size={18} color={t.text} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>{title}</Text>
          {!!body && <Text style={{ color: t.subtext, marginTop: 4, lineHeight: 18 }}>{body}</Text>}
        </View>
      </View>

      {!!primary && (
        <Button
          title={primary.title}
          onPress={primary.onPress}
          left={primary.icon ? <Feather name={primary.icon} size={16} color="#fff" /> : null}
        />
      )}

      {!!secondary && (
        <Button
          title={secondary.title}
          variant="secondary"
          onPress={secondary.onPress}
          left={secondary.icon ? <Feather name={secondary.icon} size={16} color={t.text} /> : null}
        />
      )}

      {!!tertiary && (
        <Button
          title={tertiary.title}
          variant="ghost"
          onPress={tertiary.onPress}
        />
      )}
    </View>
  );
}