// app/(onboarding)/confirm.js
import React, { useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { setOnboardingDone } from "../../lib/onboardingGate";
import { Screen, HeaderRow, MattePanel, Pill } from "../../components/_ui";

export default function Confirm() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  const candidates = useEmailImportStore((s) => s.candidates || s.detectedItems || []);

  const [selected, setSelected] = useState(() => {
    return new Set(candidates.map((c) => c.id || c.localId || String(c.merchant)));
  });

  const count = useMemo(() => selected.size, [selected]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getItemId(item) {
    return item.id || item.localId || String(item.merchant);
  }

  function getItemName(item) {
    return item.merchant || item.title || item.name || "Unknown";
  }

  function getItemProof(item) {
    return (
      item.proof ||
      item.subject ||
      item.evidence?.[0]?.subject ||
      `${item.cadence || "monthly"} · ${item.currency || "USD"} ${item.amount ?? ""}`
    );
  }

  const proceed = () => {
    const selectedCandidates = candidates.filter((c) => selected.has(getItemId(c)));
    useEmailImportStore.getState().setConfirmedCandidates?.(selectedCandidates);
    r.push("/(onboarding)/goals");
  };

  async function skip() {
    await setOnboardingDone(true);
    // Gate in _layout.js navigates to /(tabs) when onboardingDone flips via USER_UPDATED
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("Confirm results") || "Confirm results"}
          subtitle={tt("Pick what looks correct") || "Pick what looks correct"}
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(onboarding)/expectations"))}
        />

        <View style={{ height: 14 }} />

        <MattePanel title={tt("Detected items") || "Detected items"} icon="check-square">
          {candidates.length === 0 ? (
            <>
              <Text style={{ color: t.subtext, fontWeight: "600", lineHeight: 18 }}>
                {tt("No items detected from your inbox yet.") ||
                  "No items detected from your inbox yet."}
              </Text>
              <Text style={{ color: t.subtext, marginTop: 8, fontWeight: "600", lineHeight: 18 }}>
                {tt("You can add subscriptions manually from the home screen.") ||
                  "You can add subscriptions manually from the home screen."}
              </Text>
            </>
          ) : (
            <>
              <Text style={{ color: t.subtext, fontWeight: "600", lineHeight: 18 }}>
                {tt("We found these from your inbox. Keep the real ones, remove the noise.") ||
                  "We found these from your inbox. Keep the real ones, remove the noise."}
              </Text>

              <View style={{ height: 12 }} />

              {candidates.map((item) => {
                const id = getItemId(item);
                const active = selected.has(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggle(id)}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      backgroundColor: t.surface2,
                      borderWidth: 1,
                      borderColor: t.hairline,
                      marginTop: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <Text style={{ color: t.text, fontWeight: "800" }}>
                        {getItemName(item)}
                      </Text>
                      <Pill
                        active={active}
                        label={active ? (tt("Keep") || "Keep") : (tt("Skip") || "Skip")}
                        onPress={() => toggle(id)}
                      />
                    </View>
                    <Text style={{ color: t.subtext, marginTop: 6, fontWeight: "600" }}>
                      {getItemProof(item)}
                    </Text>
                  </Pressable>
                );
              })}
            </>
          )}
        </MattePanel>

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title={
              candidates.length > 0
                ? (tt("Continue") || "Continue") + ` (${count})`
                : (tt("Continue") || "Continue")
            }
            onPress={proceed}
            left={<Feather name="arrow-right" size={16} color="#fff" />}
          />
          <Button title={tt("Skip") || "Skip"} variant="ghost" onPress={skip} />
        </View>
      </Screen>
    </SafeAreaView>
  );
}