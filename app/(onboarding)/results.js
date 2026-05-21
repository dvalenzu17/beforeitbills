// app/(onboarding)/results.js
import React, { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import Button from "../../components/Button";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { setOnboardingDone } from "../../lib/onboardingGate";
import { fmtMoney, cadenceToSuffix, fmtDateShort } from "../../lib/formatters";
import { Screen, HeaderRow, MattePanel } from "../../components/_ui";
import { useRecordingStore } from "../../lib/recordingMode";
import { track } from "../../lib/analytics";

export default function Results() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();

  const recordingActive = useRecordingStore((s) => s.active);
  const recordingPersona = useRecordingStore((s) => s.persona);

  const realItems = useEmailImportStore((s) => s.candidates) || [];

  // In recording mode, display the persona's subs as if they were scan results
  const items = useMemo(() => {
    if (recordingActive && recordingPersona) {
      return recordingPersona.subs.map((s) => ({
        id: s.id,
        merchant: s.title,
        amount: s.amount,
        currency: s.currency,
        cadence: s.cadence,
        nextRenewal: s.nextRenewal,
      }));
    }
    return realItems;
  }, [recordingActive, recordingPersona, realItems]);

  const count = items.length;
  const top = useMemo(() => items.slice(0, 6), [items]);

  useEffect(() => {
    if (recordingActive) return;
    track("scan_completed", { count });
    if (count > 0) track("subscription_found", { count });
  }, []);

  async function finish() {
    if (recordingActive) {
      // Skip onboarding gate mutation - just go to the main app
      r.replace("/(tabs)/");
      return;
    }
    await setOnboardingDone(true);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("Results") || "Results"}
          subtitle={`${count} ${tt("found") || "found"}`}
          onBack={finish}
        />

        <View style={{ height: 14 }} />

        <MattePanel title={tt("Detected subscriptions") || "Detected subscriptions"} icon="list">
          {count === 0 ? (
            <Text style={{ color: t.subtext, fontWeight: "600", lineHeight: 19 }}>
              {tt("No recurring charges found yet. Try a wider scan range or add one manually.") ||
                "No recurring charges found yet. Try a wider scan range or add one manually."}
            </Text>
          ) : (
            <>
              {top.map((it) => (
                <Pressable
                  key={it.id || it.key || it.merchant}
                  onPress={async () => {
                    if (recordingActive) { r.replace("/(tabs)/"); return; }
                    await setOnboardingDone(true);
                    r.push("/account/connect-email/review");
                  }}
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    backgroundColor: t.surface2,
                    borderWidth: 1,
                    borderColor: t.hairline,
                    marginTop: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontWeight: "800" }}>{it.merchant || it.title || "Subscription"}</Text>
                      <Text style={{ color: t.subtext, fontWeight: "600", marginTop: 4 }}>
                        {fmtMoney?.(it.amount, it.currency) || ""} {cadenceToSuffix?.(it.cadence) || ""}
                        {it.nextRenewal ? ` · ${fmtDateShort?.(it.nextRenewal) || it.nextRenewal}` : ""}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={t.subtext} />
                  </View>
                </Pressable>
              ))}

              {count > 6 ? (
                <Text style={{ color: t.subtext, marginTop: 12, fontWeight: "600" }}>
                  + {count - 6} {tt("more") || "more"}
                </Text>
              ) : null}
            </>
          )}
        </MattePanel>

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title={recordingActive ? "Continue to App" : (tt("Review & confirm") || "Review & confirm")}
            onPress={async () => {
              if (recordingActive) { r.replace("/(tabs)/"); return; }
              await setOnboardingDone(true);
              r.push("/account/connect-email/review");
            }}
            left={<Feather name="check" size={16} color="#fff" />}
          />
          {!recordingActive && (
            <>
              <Button
                title={tt("Manual add") || "Manual add"}
                variant="secondary"
                onPress={async () => { await setOnboardingDone(true); r.push("/manual-add"); }}
                left={<Feather name="plus" size={16} color={t.text} />}
              />
              <Button
                title={tt("Done") || "Done"}
                variant="ghost"
                onPress={finish}
              />
            </>
          )}
        </View>
      </Screen>
    </SafeAreaView>
  );
}