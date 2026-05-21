// components/PressableScale.js
import React from "react";
import { MotiPressable } from "moti/interactions";
import * as Haptics from "expo-haptics";

export default function PressableScale({
  onPress,
  onLongPress,
  children,
  style,
  disabled = false,
  haptic = "selection", // "selection" | "impactLight" | "impactMedium" | "none"
  scaleTo = 0.98,
  testID,
  accessible,
  accessibilityRole,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
}) {
  return (
    <MotiPressable
      testID={testID}
      disabled={disabled}
      accessible={accessible}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      onLongPress={onLongPress}
      onPress={() => {
        if (disabled) return;
        // Fire haptic without awaiting - handler must not be blocked
        try {
          if (haptic === "selection") Haptics.selectionAsync();
          if (haptic === "impactLight")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          if (haptic === "impactMedium")
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
          // ignore
        }
        onPress?.();
      }}
      animate={({ pressed }) => {
        "worklet";
        return {
          scale: pressed ? scaleTo : 1,
          opacity: pressed ? 0.92 : 1,
        };
      }}
      transition={{
        type: "spring",
        damping: 18,
        mass: 0.35,
        stiffness: 250,
      }}
      style={style}
    >
      {children}
    </MotiPressable>
  );
}
