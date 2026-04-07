// components/Button.js
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../lib/theme";

export default function Button({
  title = "Continue",
  onPress,
  variant = "primary", // 'primary' | 'secondary' | 'ghost' | 'danger'
  disabled = false,
  haptic = "none",
  style,
  textStyle,
  left,
  right,
}) {
  const t = useTheme();

  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";
  const isGhost = variant === "ghost";
  const isDanger = variant === "danger";

  const backgroundColor = isPrimary
    ? t.accent
    : isSecondary
    ? t.surface2
    : isDanger
    ? "#8E2C2C"
    : "transparent";

  const borderColor = isSecondary
    ? t.hairline
    : isDanger
    ? "#B94A4A"
    : "transparent";

  const textColor = isPrimary || isDanger
    ? "#FFFFFF"
    : t.text;

    const shadow = (isPrimary || isDanger) ? t.shadowSm : null;


  return (
    <TouchableOpacity
      activeOpacity={0.86}
      disabled={disabled}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      onPress={async () => {
        if (disabled) return;

        try {
          if (haptic === "selection") await Haptics.selectionAsync();
          if (haptic === "impactLight") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (haptic === "impactMedium") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (haptic === "success") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (haptic === "warning") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          if (haptic === "error") await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}

        onPress?.();
      }}
      style={[
        {
          backgroundColor,
          borderColor,
          borderWidth: isSecondary || isDanger ? 1 : 0,
          borderRadius: t.r16 ?? 16,
          minHeight: 52,
          paddingHorizontal: 18,
          paddingVertical: 14,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.45 : 1,
        },
        shadow,
        style,
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {left ? <View>{left}</View> : null}
        <Text
          style={[
            {
              color: textColor,
              fontWeight: "900",
              fontSize: 15,
              letterSpacing: 0.2,
            },
            textStyle,
          ]}
        >
          {title}
        </Text>
        {right ? <View>{right}</View> : null}
      </View>
    </TouchableOpacity>
  );
}
