// app/(onboarding)/results.js
import React, { useEffect, useMemo, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable, Share } from "react-native";
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

// Monthly-equivalent amount for any cadence (mirrors store.monthlyFactor).
function toMonthly(amount, cadence) {
  const n = Number(amount) || 0;
  const c = String(cadence || "monthly").toLowerCase();
  if (c.includes("year") || c.includes("annual")) return n / 12;
  if (c.includes("quarter")) return n / 3;
  if (c.includes("biweek") || c.includes("bi-week") || c.includes("fortnight")) return n * 2.1725;
  if (c.includes("week")) return n * 4.345;
  return n;
}

// Eased count-up so the headline number animates in (the "gut-punch" moment).
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) { setVal(0); return; }
    let raf;
    const start = Date.now();
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

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
    // Normalise candidate fields (candidates carry cadenceGuess/nextDateGuess).
    return realItems.map((s) => ({
      ...s,
      cadence: s.cadence || s.cadenceGuess || "monthly",
      nextRenewal: s.nextRenewal || s.nextDateGuess || null,
    }));
  }, [recordingActive, recordingPersona, realItems]);

  const count = items.length;
  const currency = items[0]?.currency || "USD";

  const monthlyTotal = useMemo(
    () => items.reduce((sum, it) => sum + toMonthly(it.amount, it.cadence), 0),
    [items]
  );
  const yearlyTotal = monthlyTotal * 12;

  // The single priciest line (monthly-equivalent) — the "you forgot about this" hook.
  const biggest = useMemo(() => {
    if (!items.length) return null;
    return [...items].sort((a, b) => toMonthly(b.amount, b.cadence) - toMonthly(a.amount, a.cadence))[0];
  }, [items]);

  const top = useMemo(() => items.slice(0, 6), [items]);
  const animatedMonthly = useCountUp(monthlyTotal);

  useEffect(() => {
    if (recordingActive) return;
    track("scan_completed", { count });
    if (count > 0) {
      track("subscription_found", { count });
      track("subscription_detected", { count });
    }
  }, []);

  async function finish() {
    if (recordingActive) {
      r.replace("/(tabs)/");
      return;
    }
    await setOnboardingDone(true);
  }

  async function goReview() {
    if (recordingActive) { r.replace("/(tabs)/"); return; }
    await setOnboardingDone(true);
    r.push("/account/connect-email/review");
  }

  async function shareResult() {
    try {
      const monthly = fmtMoney(monthlyTotal, currency);
      const yearly = fmtMoney(yearlyTotal, currency);
      const message =
        count > 0
          ? `I just found ${monthly}/mo (${yearly}/yr) across ${count} subscriptions I'd forgotten about 👀 — scanned my inbox with BeforeItBills.`
          : `I scanned my inbox for forgotten subscriptions with BeforeItBills.`;
      await Share.share({ message });
      track("result_shared", { count });
    } catch {
      // user cancelled or share unavailable — non-fatal
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("ob.resultsTitle") || "Here's the damage"}
          subtitle={`${count} ${tt("found") || "found"}`}
          onBack={finish}
        />

        <View style={{ height: 14 }} />

        {count > 0 ? (
          <>
            {/* The money shot */}
            <View
              style={{
                padding: 22,
                borderRadius: 24,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.hairline,
                alignItems: "center",
                ...t.shadowMd,
              }}
            >
              <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
                {tt("ob.resultsMonthlyLabel") || "You're spending"}
              </Text>
              <Text style={{ color: t.text, fontWeight: "900", fontSize: 46, marginTop: 6 }}>
                {fmtMoney(animatedMonthly, currency)}
              </Text>
              <Text style={{ color: t.subtext, fontWeight: "700", marginTop: 2, fontSize: 15 }}>
                {tt("ob.perMonthOn") || "per month"} · {fmtMoney(yearlyTotal, currency)}/yr
              </Text>

              {biggest ? (
                <View
                  style={{
                    marginTop: 16,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: t.surface2,
                    borderWidth: 1,
                    borderColor: t.hairline,
                  }}
                >
                  <Text style={{ color: t.text, fontWeight: "700", fontSize: 13 }}>
                    {tt("ob.resultsPriciest") || "Priciest"}: {biggest.merchant || "—"} ·{" "}
                    {fmtMoney(toMonthly(biggest.amount, biggest.cadence), currency)}/mo
                  </Text>
                </View>
              ) : null}

              <View style={{ height: 16 }} />
              <Button
                title={tt("ob.shareResult") || "Share my result"}
                variant="secondary"
                onPress={shareResult}
                left={<Feather name="share-2" size={16} color={t.text} />}
              />
            </View>

            <View style={{ height: 14 }} />

            <MattePanel title={tt("Detected subscriptions") || "Detected subscriptions"} icon="list">
              {top.map((it) => (
                <Pressable
                  key={it.id || it.fingerprint || it.merchant}
                  onPress={goReview}
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
            </MattePanel>
          </>
        ) : (
          <MattePanel title={tt("Detected subscriptions") || "Detected subscriptions"} icon="list">
            <Text style={{ color: t.subtext, fontWeight: "600", lineHeight: 19 }}>
              {tt("No recurring charges found yet. Try a wider scan range or add one manually.") ||
                "No recurring charges found yet. Try a wider scan range or add one manually."}
            </Text>
          </MattePanel>
        )}

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title={recordingActive ? "Continue to App" : (tt("Review & confirm") || "Review & confirm")}
            onPress={goReview}
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
