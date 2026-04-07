// components/LimitReachedSheet.js
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Modal, PanResponder, Pressable, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Glass from "./Glass";
import Button from "./Button";
import { useTheme } from "../lib/theme";
import { FREE_RECURRING_LIMIT } from "../lib/limits";
import { SPACING } from "../lib/ui/tokens";

export default function LimitReachedSheet({
  // support BOTH names so callers don’t break
  visible,
  open,
  onClose,
  onUpgrade,
  count = 0,
  limit = FREE_RECURRING_LIMIT,
}) {
  const t = useTheme();
  const router = useRouter();
  const slide = useRef(new Animated.Value(0)).current;

  const isVisible = !!(typeof visible === "boolean" ? visible : open);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: isVisible ? 1 : 0,
      duration: isVisible ? 220 : 180,
      useNativeDriver: true,
    }).start();
  }, [isVisible, slide]);

  const translateY = useMemo(
    () =>
      slide.interpolate({
        inputRange: [0, 1],
        outputRange: [420, 0],
      }),
    [slide]
  );

  const swipeY = useRef(new Animated.Value(0)).current;
  const swipePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) swipeY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80) {
        onClose?.();
        swipeY.setValue(0);
      } else {
        Animated.spring(swipeY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  // IMPORTANT: don’t mount anything if not visible
  if (!isVisible) return null;

  function handleUpgrade() {
    // Paywall UX consistency: always go somewhere.
    try { onClose?.(); } catch {}
    if (typeof onUpgrade === "function") return onUpgrade();
    router.push("/account/upgrade");
  }

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        }}
      >
        {/* Stop press propagation */}
        <Pressable onPress={() => {}} style={{ padding: SPACING.screen }}>
          <Animated.View style={{ transform: [{ translateY }, { translateY: swipeY }] }} {...swipePan.panHandlers}>
            {/* Drag handle */}
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            </View>
            <Glass style={{ borderRadius: 22, padding: 16 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: t.text, fontWeight: "900", fontSize: 18 }}>
                    Limit reached
                  </Text>
                  <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
                    Free plan tracks up to{" "}
                    <Text style={{ color: t.text, fontWeight: "900" }}>{limit}</Text>{" "}
                    recurring items. You’re at{" "}
                    <Text style={{ color: t.text, fontWeight: "900" }}>{count}</Text>.
                  </Text>
                </View>

                <Pressable onPress={onClose} hitSlop={12}>
                  <Text style={{ color: t.subtext, fontSize: 18 }}>✕</Text>
                </Pressable>
              </View>

              <View style={{ marginTop: 14, gap: 10 }}>
                <Button
                  title="Upgrade to Pro"
                  onPress={handleUpgrade}
                  left={<Feather name="zap" size={16} color="#0B0B10" />}
                />
                <Button
                  title="Not now"
                  variant="secondary"
                  onPress={onClose}
                  left={<Feather name="x" size={16} color="#FFFFFF" />}
                />
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={{ color: t.subtext, fontSize: 12, lineHeight: 16 }}>
                  Pro unlocks unlimited items + export + advanced scan + IMAP (optional).
                </Text>
              </View>
            </Glass>
          </Animated.View>
        </Pressable>

      </Pressable>
    </Modal>
  );
}
