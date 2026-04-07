// components/ConfidenceBreakdownSheet.js
import React, { useMemo, useRef } from "react";
import { Animated, Modal, PanResponder, Pressable, View, Text } from "react-native";
import Glass from "./Glass";
import { useTheme } from "../lib/theme";
import { SPACING } from "../lib/ui/tokens";
function scoreSignals(c) {
  const from = String(c?.evidence?.from || "").toLowerCase();
  const subject = String(c?.evidence?.subject || "").toLowerCase();

  let score = 0;
  const parts = [];

  // heuristics: if backend provides signals, use that as “explainers”
  if (c?.matchType === "sender") {
    score += 40; parts.push({ label: "Sender match", delta: +40 });
  } else if (from) {
    score += 25; parts.push({ label: "Domain match", delta: +25 });
  }

  if (c?.keywordHit || (subject && c?.merchant && subject.includes(String(c.merchant).toLowerCase()))) {
    score += 20; parts.push({ label: "Keyword match", delta: +20 });
  }

  if (Number.isFinite(Number(c?.amount))) {
    score += 10; parts.push({ label: "Amount detected", delta: +10 });
  }

  if (c?.cadenceGuess) {
    score += 10; parts.push({ label: "Cadence detected", delta: +10 });
  }

  // conflicts
  if (c?.conflict === true) {
    score -= 30; parts.push({ label: "Conflicting signals", delta: -30 });
  }

  score = Math.max(0, Math.min(100, score));
  return { score, parts };
}

export default function ConfidenceBreakdownSheet({ visible, onClose, candidate }) {
  const t = useTheme();

  const calc = useMemo(() => scoreSignals(candidate), [candidate]);
  const finalScore = candidate?.confidence ?? calc.score;

  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80) {
        onClose?.();
        translateY.setValue(0);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }} onPress={onClose}>
        <Pressable onPress={() => {}} style={{ padding: SPACING.screen }}>
          <Animated.View style={{ transform: [{ translateY }] }} {...panResponder.panHandlers}>
            {/* Drag handle */}
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }} />
            </View>
            <Glass style={{ borderRadius: 22, padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
              <Text style={{ color: t.text, fontWeight: "950", fontSize: 18 }}>Confidence</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ color: t.subtext, fontWeight: "900" }}>✕</Text>
              </Pressable>
            </View>

            <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
              We calculate this from signals like sender/domain/keywords/amount. Nothing random.
            </Text>

            <View style={{ marginTop: 12, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: t.hairline, backgroundColor: "rgba(0,0,0,0.18)" }}>
              <Text style={{ color: t.text, fontWeight: "950", fontSize: 28 }}>{finalScore}</Text>
              <Text style={{ color: t.subtext, marginTop: 2 }}>out of 100</Text>
            </View>

            <View style={{ marginTop: 12, gap: 8 }}>
              {(calc.parts || []).map((p, i) => (
                <View key={`${p.label}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: t.text, fontWeight: "800" }}>{p.label}</Text>
                  <Text style={{ color: t.subtext, fontWeight: "900" }}>{p.delta > 0 ? `+${p.delta}` : `${p.delta}`}</Text>
                </View>
              ))}
            </View>

            <Text style={{ color: t.subtext, marginTop: 12, fontSize: 12 }}>
              If confidence is low, you can edit before confirming   that’s the point.
            </Text>
            </Glass>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
