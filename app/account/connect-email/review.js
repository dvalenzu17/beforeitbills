import React, { useMemo, useState } from "react";
import { View, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import Screen from "@/components/Screen";
import NavHeader from "@/components/NavHeader";
import Card from "@/components/Card";
import CandidateCard from "@/components/CandidateCard";
import UndoToast from "@/components/UndoToast";

import { useTheme } from "@/lib/theme";
import { useEmailImportStore } from "@/lib/emailImportStore";
import { createRecurringFromCandidate } from "@/lib/recurringAdapter";
import { useStore } from "@/lib/store";
import { track } from "@/lib/analytics";

import { SPACING } from "@/lib/ui/tokens";
import { VStack } from "@/components/ui/Stack";
import * as T from "@/components/ui/Text";

function toMonthly(amount, cadence) {
  const n = Number(amount || 0);
  switch (cadence) {
    case "weekly":      return (n * 52) / 12;
    case "quarterly":   return n / 3;
    case "semi-annual": return n / 6;
    case "yearly":      return n / 12;
    default:            return n; // monthly or unknown
  }
}

export default function ReviewQueue() {

  const router = useRouter();
  const { t } = useTranslation();
  const theme = useTheme();

  const candidates = useEmailImportStore((x) => x.candidates);
  const markHandled = useEmailImportStore((x) => x.markHandled);
  const restoreCandidate = useEmailImportStore((x) => x.restoreCandidate);
  const deleteRecurring = useStore((s) => s.deleteRecurring);

  // Confirmed email subscriptions from the main store.
  // Shown in the "Already tracking" section so the user sees the full picture.
  // Manual subscriptions are excluded — they belong on the subscriptions list only.
  const allSubscriptions = useStore((s) => s.subscriptions);
  const alreadyTracking = useMemo(() =>
    (allSubscriptions || []).filter(
      (s) => s.active && !s.isSuggested && s.source !== "manual"
    ),
    [allSubscriptions]
  );

  const empty = useMemo(() => !candidates || candidates.length === 0, [candidates]);

  // Total monthly equivalent: confirmed active non-manual subs + new candidates.
  const totalMonthly = useMemo(() => {
    const confirmedSpend = alreadyTracking.reduce(
      (sum, s) => sum + toMonthly(s.amount, s.cadence),
      0
    );
    const candidatesSpend = (candidates || []).reduce(
      (sum, c) => sum + toMonthly(c.amount, c.cadenceGuess),
      0
    );
    return confirmedSpend + candidatesSpend;
  }, [alreadyTracking, candidates]);

  const [undo, setUndo] = useState(null);
  const [undoOpen, setUndoOpen] = useState(false);

  function showUndo(payload) {
    setUndo(payload);
    setUndoOpen(true);
    setTimeout(() => setUndoOpen(false), 9000);
  }

  async function confirmCandidate(c) {
    const res = await createRecurringFromCandidate(c);
    const createdId = res?.id || res?.item?.id || null;
    const createdKind = res?.item?.kind ?? "subscription";

    track("email_candidate_confirmed", { merchant: c.merchant });
    await markHandled(c.fingerprint);

    if (createdId) {
      router.push(`/recurring/${createdKind}/${createdId}`);
    }

    showUndo({
      message: `Added ${c.merchant || "subscription"}`,
      candidate: c,
      createdKind,
      createdId,
    });
  }

  async function rejectCandidate(c) {
    track("email_candidate_rejected", { merchant: c.merchant });
    await markHandled(c.fingerprint);
    showUndo({
      message: `Removed ${c.merchant || "candidate"}`,
      candidate: c,
    });
  }

  async function onUndo() {
    if (!undo) return;
    if (undo.createdKind && undo.createdId) {
      try {
        await deleteRecurring?.(undo.createdKind, undo.createdId);
      } catch (e) {
        if (__DEV__) console.warn("[review] undo deleteRecurring failed:", e?.message);
      }
    }
    await restoreCandidate?.(undo.candidate);
    setUndoOpen(false);
    setUndo(null);
  }

  return (
    <Screen>

      <NavHeader
        title={t("reviewQueue.title")}
        subtitle={t("reviewQueue.subtitle")}
        onBack={() => router.canGoBack?.() ? router.back() : router.replace("/account/connect-email/connected")}
      />

      <ScrollView
        stickyHeaderIndices={[0]}
        contentContainerStyle={{
          padding: SPACING.screen,
          gap: 10,
          paddingBottom: 120
        }}
      >

        {/* Sticky summary bar — only shown when there are candidates to swipe */}
        {!empty && (
          <View
            style={{
              backgroundColor: theme.bg,
              paddingBottom: 6
            }}
          >

            <Text
              style={{
                textAlign: "center",
                color: theme.subtext,
                fontSize: 13,
                fontWeight: "600"
              }}
            >
              {t("reviewQueue.swipeHint")}
            </Text>

            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                paddingHorizontal: 12
              }}
            >
              <Text style={{ color: theme.tertiary, fontSize: 12 }}>
                {t("reviewQueue.rejectLabel")}
              </Text>
              <Text style={{ color: theme.tertiary, fontSize: 12 }}>
                {t("reviewQueue.confirmLabel")}
              </Text>
            </View>

            <Text
              style={{
                textAlign: "center",
                color: theme.tertiary,
                fontSize: 12
              }}
            >
              {t("reviewQueue.detectedSummary", {
                count: candidates.length,
                monthly: totalMonthly.toFixed(2),
              })}
            </Text>

          </View>
        )}

        {/* ── Section 1: New detections ──────────────────────────────────── */}
        {!empty && (
          <VStack gap={10}>

            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: theme.subtext,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                paddingHorizontal: 4,
              }}
            >
              {t("reviewQueue.newDetectionsTitle", { count: candidates.length })}
            </Text>

            {candidates.map((c) => (
              <CandidateCard
                key={c.fingerprint}
                c={c}
                onConfirm={() => confirmCandidate(c)}
                onReject={() => rejectCandidate(c)}
                onEdit={() =>
                  router.push(
                    `/account/connect-email/edit?fp=${encodeURIComponent(
                      c.fingerprint
                    )}`
                  )
                }
              />
            ))}

          </VStack>
        )}

        {/* Empty state — all new detections handled */}
        {empty && (
          <Card style={{ padding: SPACING.screen }}>
            <T.H2>{t("reviewQueue.allDismissedTitle")}</T.H2>
            <T.Sub style={{ marginTop: 6 }}>
              {t("reviewQueue.allDismissedBody")}
            </T.Sub>
            <Text
              style={{
                marginTop: 10,
                textAlign: "center",
                color: theme.subtext,
                fontSize: 13
              }}
            >
              {t("reviewQueue.addManuallyHint")}
            </Text>
          </Card>
        )}

        {/* ── Section 2: Already tracking ────────────────────────────────── */}
        {alreadyTracking.length > 0 && (
          <VStack gap={6}>

            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: theme.subtext,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                paddingHorizontal: 4,
                marginTop: 8,
              }}
            >
              {t("reviewQueue.alreadyTrackingTitle", { count: alreadyTracking.length })}
            </Text>

            {alreadyTracking.map((s) => (
              <View key={s.id} style={{ opacity: 0.55 }}>
                <Card style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text
                      style={{
                        color: theme.subtext,
                        fontSize: 14,
                        fontWeight: "600",
                        flex: 1,
                      }}
                      numberOfLines={1}
                    >
                      {s.merchant}
                    </Text>
                    <Text style={{ color: theme.tertiary, fontSize: 13 }}>
                      {Number(s.amount || 0).toFixed(2)}
                    </Text>
                  </View>
                </Card>
              </View>
            ))}

          </VStack>
        )}

        <Text
          style={{
            textAlign: "center",
            fontSize: 11,
            color: theme.tertiary,
            marginTop: 12
          }}
        >
          {t("reviewQueue.privacyNote")}
        </Text>

      </ScrollView>

      <UndoToast
        visible={undoOpen}
        message={undo?.message || ""}
        onUndo={onUndo}
        onHide={() => setUndoOpen(false)}
      />

    </Screen>
  );
}
