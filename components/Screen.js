// components/Screen.js
import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../lib/theme";

export default function Screen({
  children,
  style,
  contentStyle,
  edges = ["top", "left", "right"],
}) {
  const t = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: t.bg }, style]}>
      {/* subtle depth background */}
      <LinearGradient
        colors={[t.bg, t.bg2]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* soft “ambient glow” blobs (premium, not neon) */}
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            top: -240,
            left: -140,
            backgroundColor: t.accent,
            opacity: 0.14,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.blob,
          {
            bottom: -260,
            right: -180,
            backgroundColor: t.accent2,
            opacity: 0.10,
          },
        ]}
      />

      <SafeAreaView style={[styles.safe, contentStyle]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 16, paddingTop: 10 },
  blob: {
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: 9999,
  },
});
