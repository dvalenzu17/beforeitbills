// components/SpotlightTutorial.js
//
// Guided spotlight overlay. Pass it a list of steps, each with:
//   - targetRef: ref attached to the element to highlight
//   - title: short heading
//   - body: explanation text
//   - icon: Feather icon name
//
// Everything outside the spotlight is dimmed with a blur overlay.
// An animated pulse ring draws the eye to the target.
// Tapping "Next" or the backdrop advances the step.

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  Dimensions,
  StyleSheet,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing,
  FadeIn,
  FadeOut,
  ZoomIn,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";

const { width: W, height: H } = Dimensions.get("window");
const PADDING = 18; // spotlight padding around target

export default function SpotlightTutorial({ steps, visible, onDone }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [layout, setLayout] = useState(null); // { x, y, width, height }

  const pulse = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);

  const step = steps[stepIndex];

  // Measure target element position
  useEffect(() => {
    if (!visible || !step?.targetRef?.current) return;

    step.targetRef.current.measure((fx, fy, w, h, px, py) => {
      setLayout({ x: px, y: py, width: w, height: h });
    });
  }, [stepIndex, visible]);

  // Pulse animation
  useEffect(() => {
    if (!visible) return;
    pulse.value = 0;
    tooltipOpacity.value = 0;

    pulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );

    tooltipOpacity.value = withTiming(1, { duration: 300 });
  }, [stepIndex, visible]);

  const pulseStyle = useAnimatedStyle(() => {
    if (!layout) return {};
    return {
      position: "absolute",
      left: layout.x - PADDING,
      top: layout.y - PADDING,
      width: layout.width + PADDING * 2,
      height: layout.height + PADDING * 2,
      borderRadius: 20,
      borderWidth: 2.5,
      borderColor: "rgba(99,102,241,1)",
      opacity: interpolate(pulse.value, [0, 0.5, 1], [0.9, 0.4, 0]),
      transform: [
        {
          scale: interpolate(pulse.value, [0, 1], [1, 1.06]),
        },
      ],
    };
  });

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
  }));

  function advance() {
    if (stepIndex < steps.length - 1) {
      setLayout(null);
      tooltipOpacity.value = withTiming(0, { duration: 150 }, () => {
        setStepIndex((i) => i + 1);
      });
    } else {
      onDone?.();
    }
  }

  function skip() {
    onDone?.();
  }

  if (!visible) return null;

  // Tooltip positioning - prefer below target, flip above if too close to bottom
  let tooltipTop = null;
  let tooltipBottom = null;
  let arrowUp = true;

  if (layout) {
    const below = layout.y + layout.height + PADDING + 12;
    const above = layout.y - PADDING - 12;
    const tooltipHeight = 140;

    if (below + tooltipHeight < H - 40) {
      tooltipTop = below;
      arrowUp = true;
    } else {
      tooltipBottom = H - above;
      arrowUp = false;
    }
  }

  const isLast = stepIndex === steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      {/* Dimmed backdrop with blur */}
      <BlurView
        intensity={20}
        tint="dark"
        style={StyleSheet.absoluteFill}
      />

      {/* Dark overlay with cutout - we fake the cutout by placing a clear rect */}
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />
        {/* Cutout - white rect that makes the target element visible */}
        {layout ? (
          <View
            style={{
              position: "absolute",
              left: layout.x - PADDING,
              top: layout.y - PADDING,
              width: layout.width + PADDING * 2,
              height: layout.height + PADDING * 2,
              borderRadius: 18,
              backgroundColor: "transparent",
              // Fake the cutout by removing the overlay color in this area
              // We use a negative margin trick since RN can't clip paths natively
              shadowColor: "#6366F1",
              shadowOpacity: 0.6,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 0 },
              elevation: 12,
            }}
          />
        ) : null}
      </View>

      {/* Spotlight highlight - elevated above the backdrop */}
      {layout ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: layout.x - PADDING,
            top: layout.y - PADDING,
            width: layout.width + PADDING * 2,
            height: layout.height + PADDING * 2,
            borderRadius: 18,
            borderWidth: 2,
            borderColor: "rgba(99,102,241,0.8)",
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        />
      ) : null}

      {/* Pulse ring */}
      <Animated.View pointerEvents="none" style={pulseStyle} />

      {/* Tooltip card */}
      {layout ? (
        <Animated.View
          style={[
            tooltipStyle,
            {
              position: "absolute",
              left: 20,
              right: 20,
              ...(tooltipTop != null ? { top: tooltipTop } : {}),
              ...(tooltipBottom != null ? { bottom: tooltipBottom } : {}),
            },
          ]}
          entering={FadeIn.duration(200)}
        >
          {/* Arrow */}
          {arrowUp ? (
            <View
              style={{
                alignSelf: "flex-start",
                marginLeft: Math.max(
                  12,
                  Math.min(layout.x + layout.width / 2 - 20 - 8, W - 60)
                ),
                width: 0,
                height: 0,
                borderLeftWidth: 9,
                borderRightWidth: 9,
                borderBottomWidth: 10,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderBottomColor: "rgba(30,30,50,0.97)",
              }}
            />
          ) : null}

          <View
            style={{
              backgroundColor: "rgba(30,30,50,0.97)",
              borderRadius: 18,
              padding: 20,
              gap: 10,
              borderWidth: 1,
              borderColor: "rgba(99,102,241,0.3)",
            }}
          >
            {/* Icon + title row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: "rgba(99,102,241,0.25)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name={step.icon} size={16} color="#A5B4FC" />
              </View>
              <Text
                style={{
                  color: "#fff",
                  fontWeight: "900",
                  fontSize: 16,
                  flex: 1,
                }}
              >
                {step.title}
              </Text>
            </View>

            {/* Body */}
            <Text
              style={{
                color: "rgba(255,255,255,0.75)",
                fontSize: 14,
                lineHeight: 20,
                fontWeight: "500",
              }}
            >
              {step.body}
            </Text>

            {/* Step counter + buttons */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 4,
              }}
            >
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontWeight: "600" }}>
                {stepIndex + 1} / {steps.length}
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {!isLast ? (
                  <Pressable onPress={skip} hitSlop={8}>
                    <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontWeight: "600" }}>
                      Skip
                    </Text>
                  </Pressable>
                ) : null}

                <Pressable
                  onPress={advance}
                  style={{
                    backgroundColor: "#6366F1",
                    paddingHorizontal: 18,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                    {isLast ? "Got it" : "Next"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Arrow below */}
          {!arrowUp ? (
            <View
              style={{
                alignSelf: "flex-start",
                marginLeft: Math.max(
                  12,
                  Math.min(layout.x + layout.width / 2 - 20 - 8, W - 60)
                ),
                width: 0,
                height: 0,
                borderLeftWidth: 9,
                borderRightWidth: 9,
                borderTopWidth: 10,
                borderLeftColor: "transparent",
                borderRightColor: "transparent",
                borderTopColor: "rgba(30,30,50,0.97)",
              }}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </Modal>
  );
}