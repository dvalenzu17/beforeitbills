// app/recurring/[kind]/[id].js
import React, { useMemo, useState } from "react";
import { Alert, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import { useStore } from "../../../lib/store";
import { useTheme } from "../../../lib/theme";

import Button from "../../../components/Button";
import CancelPlaybookCard from "../../../components/CancelPlaybookCard";
import RecurringForm from "../../../components/recurring/RecurringForm";
import CelebrationSheet from "../../../components/CelebrationSheet";

function normalizeInitialFromItem(kind, item) {
  if (!item) return null;

  const isBill = String(kind) === "bill";
  if (isBill) {
    return {
      kind: "bill",
      name: item.name ?? item.title ?? "",
      title: item.name ?? item.title ?? "",
      amount: item.amount ?? "",
      currency: item.currency ?? "USD",
      nextDue: item.nextDue ?? new Date(),
      variable: !!item.variable,
      autopay: !!item.autopay,
      shared: !!item.shared,
      sharedCount: item.sharedCount ?? 1,
      sharedByMe: item.sharedByMe ?? true,
      splitMethod: item.splitMethod ?? (item.myShareAmount != null ? "custom" : "equal"),
      myShareAmount: item.myShareAmount ?? null,
      counterpartyName: item.counterpartyName ?? "",
      active: item.active !== false,
    };
  }

  return {
    kind: "subscription",
    merchant: item.merchant ?? item.title ?? "",
    title: item.merchant ?? item.title ?? "",
    amount: item.amount ?? "",
    currency: item.currency ?? "USD",
    cadence: item.cadence ?? "monthly",
    nextRenewal: item.nextRenewal ?? new Date(),
    is_trial: !!(item.is_trial || item.trial),
    trial_end: item.trial_end ?? new Date(),
    shared: !!item.shared,
    sharedCount: item.sharedCount ?? 1,
    sharedByMe: item.sharedByMe ?? true,
    splitMethod: item.splitMethod ?? (item.myShareAmount != null ? "custom" : "equal"),
    myShareAmount: item.myShareAmount ?? null,
    counterpartyName: item.counterpartyName ?? "",
    active: item.active !== false,
  };
}

export default function RecurringDetail() {
  const { kind, id } = useLocalSearchParams();
  const router = useRouter();
  const t = useTheme();
  const { t: tt } = useTranslation();

  const subs = useStore((s) => s.subs);
  const bills = useStore((s) => s.bills);

  const updateSub = useStore((s) => s.updateSub);
  const deleteSub = useStore((s) => s.deleteSub);
  const updateBill = useStore((s) => s.updateBill);
  const deleteBill = useStore((s) => s.deleteBill);

  const isBill = String(kind) === "bill";
  const [celebration, setCelebration] = useState(null);

  const item = useMemo(() => {
    if (isBill) return (bills || []).find((b) => String(b.id) === String(id));
    return (subs || []).find((s) => String(s.id) === String(id));
  }, [isBill, bills, subs, id]);

  const initialValues = useMemo(() => normalizeInitialFromItem(kind, item), [kind, item]);

  if (!item || !initialValues) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <View style={{ padding: 16 }}>
          <Text style={{ color: t.text, fontWeight: "800" }}>{tt("recurring_screen.notFound")}</Text>
          <Text style={{ color: t.subtext, marginTop: 6, fontWeight: "600" }}>{tt("recurring_screen.notFoundSub")}</Text>
          <View style={{ height: 14 }} />
          <Button title={tt("recurring_screen.goBack")} variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  async function onSubmit(payload) {
    try {
      // Single call - captures savedEntry if active is being set to false
      const result = isBill
        ? await updateBill?.(item.id, {
            active: payload.active,
            amount: payload.amount,
            currency: payload.currency,
            name: payload.title,
            merchant: payload.title,
            dueDay: payload.dueDay,
            nextDue: payload.nextDue,
            variable: payload.variable,
            autopay: payload.autopay,
            shared: payload.shared,
            sharedCount: payload.sharedCount,
            sharedByMe: payload.sharedByMe,
            splitMethod: payload.splitMethod,
            myShareAmount: payload.myShareAmount,
            counterpartyName: payload.counterpartyName,
          })
        : await updateSub?.(item.id, {
            active: payload.active,
            amount: payload.amount,
            currency: payload.currency,
            merchant: payload.merchant,
            title: payload.title,
            cadence: payload.cadence,
            nextRenewal: payload.nextRenewal,
            is_trial: payload.is_trial,
            trial_end: payload.trial_end,
            shared: payload.shared,
            sharedCount: payload.sharedCount,
            sharedByMe: payload.sharedByMe,
            splitMethod: payload.splitMethod,
            myShareAmount: payload.myShareAmount,
            counterpartyName: payload.counterpartyName,
          });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (payload.active === false && result?.savedEntry) {
        setCelebration(result.savedEntry);
        return;
      }

      router.back();
    } catch (e) {
      if (__DEV__) console.warn('[recurring-detail] save failed:', e?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(tt("recurring_screen.saveFailedTitle"), tt("recurring_screen.saveFailedBody"));
    }
  }

  function confirmDelete() {
    const hardDeleteAvailable =
      (isBill && typeof deleteBill === "function") || (!isBill && typeof deleteSub === "function");

    Alert.alert(
      hardDeleteAvailable ? tt("recurring_screen.deleteTitle") : tt("recurring_screen.archiveTitle"),
      hardDeleteAvailable ? tt("recurring_screen.deleteBody") : tt("recurring_screen.archiveBody"),
      [
        { text: tt("recurring_screen.cancelLabel"), style: "cancel" },
        {
          text: hardDeleteAvailable ? tt("recurring_screen.deleteTitle") : tt("recurring_screen.archiveTitle"),
          style: "destructive",
          onPress: async () => {
            try {
              // Archive (soft delete) to trigger savings recording + celebration.
              // Use hard delete only as fallback if archive isn't available.
              let savedEntry = null;
              const archiveResult = isBill
                ? await updateBill?.(item.id, { active: false })
                : await updateSub?.(item.id, { active: false });
              savedEntry = archiveResult?.savedEntry ?? null;

              // Also hard-delete so it disappears from the list
              if (hardDeleteAvailable) {
                if (isBill) await deleteBill(item.id);
                else await deleteSub(item.id);
              }

              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              if (savedEntry) {
                setCelebration(savedEntry);
              } else {
                router.back();
              }
            } catch (e) {
              if (__DEV__) console.warn('[recurring-detail] action failed:', e?.message);
              Alert.alert(tt("recurring_screen.actionFailedTitle"), tt("recurring_screen.actionFailedBody"));
            }
          },
        },
      ]
    );
  }

  return (
    <>
    <CelebrationSheet
      visible={!!celebration}
      entry={celebration}
      onDismiss={() => { setCelebration(null); router.back(); }}
    />
    <RecurringForm
      mode="edit"
      title={isBill ? tt("recurring_screen.billFormTitle") : tt("recurring_screen.subFormTitle")}
      onBack={() => router.back()}
      initialKind={isBill ? "bill" : "subscription"}
      lockKind
      initialValues={initialValues}
      submitLabel="Save changes"
      stickySubmit
      onSubmit={onSubmit}
      onDelete={confirmDelete}
      deleteLabel="Delete / Archive"
      footerContent={
        !isBill ? (
          <View style={{ marginTop: 8 }}>
            <CancelPlaybookCard sub={item} />
          </View>
        ) : null
      }
    />
    </>
  );
}