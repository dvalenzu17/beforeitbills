// components/Glass.js
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { MotiView } from "moti";
import { useTheme } from "../lib/theme";
import { SPACING } from "../lib/ui/tokens";

export default function Glass({
  children,
  style,
  intensity = 16, // ↓ softer blur by default
  tint = "dark",
  animated = true,
  delay = 0,
}) {
  const t = useTheme();

  const Container = animated ? MotiView : View;
  const containerProps = animated
    ? {
        from: { opacity: 0, translateY: 6 }, // ↓ less movement
        animate: { opacity: 1, translateY: 0 },
        transition: {
          type: "timing",   // ↓ remove springy feel
          duration: 220,
          delay,
        },
      }
    : {};

  const blurProps =
    Platform.OS === "android"
      ? { experimentalBlurMethod: "dimezisBlurView" }
      : {};

  return (
    <Container {...containerProps} style={styles.shell}>
      <BlurView
        tint={tint}
        intensity={intensity}
        {...blurProps}
        style={[
          styles.blur,
          {
            borderColor: t.hairline, // ↓ hairline only
            borderRadius: t.radius,
          },
          style,
        ]}
      >
        {/* Matte overlay: prevents glow/fog */}
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: t.card,
              opacity: 0.18, // ↓ THIS is the big glow killer
              borderRadius: t.radius,
            },
          ]}
        />
        <View style={styles.inner}>{children}</View>
      </BlurView>
    </Container>
  );
}

const styles = StyleSheet.create({
  shell: { borderRadius: 16 },
  blur: { overflow: "hidden", borderWidth: 1 },
  inner: { padding: SPACING.screen },
});
