// components/CelebrationSheet.js
import React, { useMemo } from "react";
import { Dimensions, Modal, Pressable, Text, View } from "react-native";
import { MotiView } from "moti";
import { useTheme } from "../lib/theme";

const { width: W, height: H } = Dimensions.get("window");

const COLORS = [
  "#7DD3FC", // brand accent / sky blue
  "#F59E0B", // amber
  "#34D399", // green
  "#F472B6", // pink
  "#A78BFA", // purple
  "#FB923C", // orange
  "#FACC15", // yellow
  "#60A5FA", // blue
];

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function buildParticles(n = 60) {
  return Array.from({ length: n }, (_, i) => ({
    key: i,
    x: rand(0, W),
    drift: rand(-60, 60),
    size: rand(5, 13),
    round: Math.random() > 0.4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: rand(1400, 2800),
    delay: rand(0, 700),
    spin: rand(180, 720) * (Math.random() > 0.5 ? 1 : -1),
  }));
}

function fmtMoney(amount, currency) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${Number(amount).toFixed(2)}`;
  }
}

export default function CelebrationSheet({ visible, onDismiss, entry }) {
  const t = useTheme();

  // Stable particles - regenerate only when sheet opens
  const particles = useMemo(() => buildParticles(60), [visible]);

  if (!visible || !entry) return null;

  const monthly = fmtMoney(entry.monthlyAmount, entry.currency);
  const annual  = fmtMoney(Math.round(entry.monthlyAmount * 12 * 100) / 100, entry.currency);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.72)" }}
        onPress={onDismiss}
      >
        {/* Confetti particles */}
        <View style={{ ...StyleSheet.absoluteFillObject }} pointerEvents="none">
          {particles.map((p) => (
            <MotiView
              key={p.key}
              from={{
                translateY: -20,
                translateX: p.x,
                rotate: "0deg",
                opacity: 1,
              }}
              animate={{
                translateY: H + 60,
                translateX: p.x + p.drift,
                rotate: `${p.spin}deg`,
                opacity: 0,
              }}
              transition={{
                type: "timing",
                duration: p.duration,
                delay: p.delay,
              }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: p.size,
                height: p.size,
                borderRadius: p.round ? p.size / 2 : 2,
                backgroundColor: p.color,
              }}
            />
          ))}
        </View>

        {/* Bottom sheet card */}
        <MotiView
          from={{ translateY: 80, opacity: 0 }}
          animate={{ translateY: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 20, mass: 0.6, stiffness: 260, delay: 120 }}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: t.surface,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            paddingTop: 32,
            paddingBottom: 48,
            paddingHorizontal: 28,
            alignItems: "center",
            gap: 8,
            borderTopWidth: 1,
            borderColor: t.hairline,
          }}
        >
          {/* Drag handle */}
          <View
            style={{
              position: "absolute",
              top: 10,
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: t.hairline,
            }}
          />

          <Text style={{ fontSize: 52, marginBottom: 4 }}>🎉</Text>

          <Text
            style={{
              color: t.text,
              fontSize: 26,
              fontWeight: "900",
              textAlign: "center",
              lineHeight: 32,
            }}
          >
            You just saved!
          </Text>

          <Text
            style={{
              color: t.accent,
              fontSize: 34,
              fontWeight: "900",
              letterSpacing: -0.5,
            }}
          >
            {monthly}/mo
          </Text>

          <Text style={{ color: t.subtext, fontSize: 15, marginBottom: 4 }}>
            That's {annual} a year back in your pocket.
          </Text>

          {entry.name ? (
            <View
              style={{
                backgroundColor: t.surface2,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderWidth: 1,
                borderColor: t.hairline,
              }}
            >
              <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 13 }}>
                {entry.name} cancelled
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => ({
              marginTop: 16,
              backgroundColor: t.accent,
              borderRadius: 16,
              paddingVertical: 15,
              paddingHorizontal: 52,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#0B0F17", fontWeight: "900", fontSize: 16 }}>
              Done
            </Text>
          </Pressable>
        </MotiView>
      </Pressable>
    </Modal>
  );
}

// Inline StyleSheet.absoluteFillObject equivalent to avoid extra import
const StyleSheet = {
  absoluteFillObject: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
};
