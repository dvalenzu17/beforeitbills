// components/UndoToast.js
import React, { useEffect, useRef } from "react";
import { Animated, Text, View, Pressable } from "react-native";
import { useTheme } from "../lib/theme";
import * as Haptics from "expo-haptics";

export default function UndoToast({ visible, message, onUndo, onHide }) {
  const t = useTheme();
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(a, {
      toValue: visible ? 1 : 0,
      duration: visible ? 180 : 160,
      useNativeDriver: true,
    }).start();
  }, [visible, a]);

  if (!visible) return null;

  const safeHaptic = async (fn) => {
    try {
      await fn();
    } catch {
      // ignore (web/simulator/dev envs where haptics may not work)
    }
  };

  const handleUndo = async () => {
    await safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
    onUndo?.();
  };

  const handleHide = async () => {
    await safeHaptic(() => Haptics.selectionAsync());
    onHide?.();
  };

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: 18,
        transform: [
          {
            translateY: a.interpolate({
              inputRange: [0, 1],
              outputRange: [30, 0],
            }),
          },
        ],
        opacity: a,
      }}
    >
      <View
        style={{
          backgroundColor: t.surface,
          borderWidth: 1,
          borderColor: t.hairline,
          borderRadius: 16,
          paddingVertical: 12,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <Text
          style={{ color: t.text, fontWeight: "800", flex: 1 }}
          numberOfLines={2}
        >
          {message}
        </Text>

        <Pressable
          onPress={handleUndo}
          style={{
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 999,
            backgroundColor: t.accent,
          }}
        >
          <Text style={{ color: "#0B0B10", fontWeight: "900" }}>Undo</Text>
        </Pressable>

        <Pressable onPress={handleHide} hitSlop={10}>
          <Text style={{ color: t.subtext, fontWeight: "900" }}>✕</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
