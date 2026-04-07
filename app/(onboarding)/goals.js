// app/(onboarding)/goals.js
import React, { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { setOnboardingDone } from "../../lib/onboardingGate";
import { Screen, HeaderRow, MattePanel } from "../../components/_ui";

const GOALS = [
  { id: "save", title: "Cut wasted spend", body: "Spot recurring charges you forgot." },
  { id: "trials", title: "Avoid trial traps", body: "See trials before they flip to paid." },
  { id: "prices", title: "Catch price increases", body: "We flag when a subscription jumps." },
];

export default function Goals() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  const [selected, setSelected] = useState(() => new Set(["save"]));
  const selectedCount = useMemo(() => selected.size, [selected]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function skip() {
    await setOnboardingDone(true);
    // Gate in _layout.js navigates to /(tabs) when onboardingDone flips via USER_UPDATED
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("Your goals") || "Your goals"}
          subtitle={tt("Tailor your experience") || "Tailor your experience"}
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(onboarding)/confirm"))}
        />

        <View style={{ height: 14 }} />

        <MattePanel title={tt("Pick what matters") || "Pick what matters"} icon="target">
          {GOALS.map((g) => {
            const on = selected.has(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => toggle(g.id)}
                style={{
                  padding: 12,
                  borderRadius: 16,
                  backgroundColor: on ? "rgba(255,255,255,0.06)" : t.surface2,
                  borderWidth: 1,
                  borderColor: on ? "rgba(255,255,255,0.14)" : t.hairline,
                  marginTop: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ color: t.text, fontWeight: "800" }}>{tt(g.title) || g.title}</Text>
                    <Text style={{ color: t.subtext, marginTop: 6, fontWeight: "600" }}>
                      {tt(g.body) || g.body}
                    </Text>
                  </View>
                  <Feather name={on ? "check-circle" : "circle"} size={18} color={on ? t.accent : t.subtext} />
                </View>
              </Pressable>
            );
          })}
        </MattePanel>

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title={(tt("Continue") || "Continue") + ` (${selectedCount})`}
            onPress={() => r.push("/(onboarding)/notifications")}
            left={<Feather name="arrow-right" size={16} color="#fff" />}
          />
          <Button title={tt("Skip") || "Skip"} variant="ghost" onPress={skip} />
        </View>
      </Screen>
    </SafeAreaView>
  );
}