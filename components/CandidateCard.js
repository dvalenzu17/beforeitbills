import React, { useRef } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Feather } from "@expo/vector-icons";
import Card from "@/components/Card";
import BrandAvatar from "@/components/BrandAvatar";
import { useTheme } from "@/lib/theme";

function normalizeMerchant(name) {
  if (!name) return "Subscription";
  // By the time a candidate reaches the card, the name should already be clean
  // (normaliseSub + cleanMerchantName in emailImportStore). This is a display-only
  // safety net for any stragglers.
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function formatRelative(dateStr) {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  const now = new Date();

  const diffDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "Charging soon";
  if (diffDays === 1) return "Next charge tomorrow";
  if (diffDays < 7) return `Next charge in ${diffDays} days`;
  if (diffDays < 30) return `Next charge in ${Math.floor(diffDays / 7)} weeks`;

  return `Next charge ${date.toLocaleDateString()}`;
}


export default function CandidateCard({ c, onConfirm, onReject, onEdit }) {

  const t = useTheme();

  const merchant = normalizeMerchant(c?.merchant);
  const domain = c?.domain || "";
  const amount = Number(c?.amount || 0).toFixed(2);
  const cadence = c?.cadenceGuess || "monthly";
  const nextCharge = formatRelative(c?.nextDateGuess);
  const suspicious = Number(amount) >= 40;
  const evidenceSubject = c?.rawSubject || null;

  const slide = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function animateOut(direction, cb) {

    Animated.parallel([
      Animated.timing(slide, {
        toValue: direction === "right" ? 500 : -500,
        duration: 250,
        useNativeDriver: true
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(cb);
  }

  function renderLeft() {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          paddingLeft: 20,
          backgroundColor: "#22C55E",
          borderRadius: 16
        }}
      >
        <Text style={{ color: "white", fontWeight: "900" }}>
          ✓ Confirm
        </Text>
      </View>
    );
  }

  function renderRight() {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "flex-end",
          paddingRight: 20,
          backgroundColor: "#EF4444",
          borderRadius: 16
        }}
      >
        <Text style={{ color: "white", fontWeight: "900" }}>
          ✕ Reject
        </Text>
      </View>
    );
  }

  return (
    <Swipeable
      renderLeftActions={renderLeft}
      renderRightActions={renderRight}
      onSwipeableLeftOpen={() => animateOut("right", onConfirm)}
      onSwipeableRightOpen={() => animateOut("left", onReject)}
    >
      <Animated.View
        style={{
          transform: [{ translateX: slide }],
          opacity
        }}
      >
        <Pressable
          accessibilityLabel={`${merchant} subscription`}
        >

          <Card style={{ paddingVertical: 14, paddingHorizontal: 16 }}>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>

              <BrandAvatar domain={domain} name={merchant} size={42} />

              <View style={{ flex: 1 }}>

                <Text
                  style={{
                    color: t.text,
                    fontSize: 16,
                    fontWeight: "700"
                  }}
                >
                  {merchant}
                </Text>

                <Text
                  style={{
                    color: t.subtext,
                    fontSize: 14,
                    marginTop: 2
                  }}
                >
                  ${amount} · {cadence}
                </Text>

                {suspicious && (
                  <Text style={{ fontSize: 12, color: "#E67E22", marginTop: 2 }}>
                    ⚠ Unusual amount — verify before confirming
                  </Text>
                )}

                {nextCharge && (
                  <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2 }}>
                    {nextCharge}
                  </Text>
                )}

                {evidenceSubject ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Feather name="mail" size={10} color={t.tertiary} />
                    <Text style={{ color: t.tertiary, fontSize: 11 }} numberOfLines={1}>
                      {evidenceSubject}
                    </Text>
                  </View>
                ) : null}

              </View>

              <Pressable
                onPress={onEdit}
                hitSlop={8}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  backgroundColor: t.surface2,
                  borderWidth: 1,
                  borderColor: t.hairline,
                }}
              >
                <Feather name="edit-2" size={14} color={t.subtext} />
              </Pressable>

            </View>

          </Card>

        </Pressable>
      </Animated.View>
    </Swipeable>
  );
}