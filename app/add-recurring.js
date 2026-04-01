import React, { useMemo, useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { resolveBrandMeta } from "../lib/brand/brandResolver";
import { useStore } from "../lib/store";
import { canAddRecurring, FREE_RECURRING_LIMIT, getRecurringCount } from "../lib/limits";
import { useToast } from "../components/ToastProvider";

import LimitReachedSheet from "../components/LimitReachedSheet";
import RecurringForm from "../components/recurring/RecurringForm";

function parseDateMaybe(s) {
  if (!s) return null;
  const d = new Date(String(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function AddRecurring() {
  const r = useRouter();
  const params = useLocalSearchParams();
  const toast = useToast();

  const addRecurring = useStore((s) => s.addRecurring);
  const pro = useStore((s) => s.pro);
  const subs = useStore((s) => s.subs);
  const bills = useStore((s) => s.bills);

  const [limitOpen, setLimitOpen] = useState(false);

  const currentCount = useMemo(
    () => getRecurringCount({ subs, bills }),
    [subs, bills]
  );

  const initialKind = params?.kind === "bill" ? "bill" : "subscription";

  const attachment = useMemo(() => {
    const uri = String(params?.attachmentUri || "");
    if (!uri) return null;
    return {
      uri,
      name: String(params?.attachmentName || ""),
      mimeType: String(params?.attachmentMime || ""),
      size: params?.attachmentSize ? Number(params.attachmentSize) : null,
    };
  }, [params]);

  const initialValues = useMemo(() => {
    return {
      kind: initialKind,
      currency: "USD",
      amount: params?.amount ? String(params.amount) : "",
      merchant: params?.merchant ? String(params.merchant) : "",
      title: params?.title ? String(params.title) : "",
      cadence: params?.cadence ? String(params.cadence) : "monthly",
      // Don't default to today — leave null so user is forced to pick a real date
      nextRenewal: parseDateMaybe(params?.nextRenewal) || null,
      nextDue: parseDateMaybe(params?.nextDue) || null,
      is_trial: !!params?.trial_end,
      trial_end: parseDateMaybe(params?.trial_end) || new Date(),
      attachment,
      active: true,
    };
  }, [params, initialKind, attachment]);

  async function onSubmit(payload, { kind }) {
    const gate = canAddRecurring({ pro, subs, bills }, FREE_RECURRING_LIMIT);

    if (!gate.ok) {
      setLimitOpen(true);
      return false;
    }

    let finalPayload = payload;

    if (kind === "subscription") {
      const brandMeta = await resolveBrandMeta({
        name: String(payload.merchant || payload.title || "").trim(),
        domain: "",
      });

      finalPayload = {
        ...payload,
        domain: brandMeta?.domain || "",
      };
    }

    const out = await addRecurring?.(finalPayload);

    if (out?.error) {
      if (__DEV__) console.warn("[add-recurring] save failed:", out.error?.message || out.error);
      Alert.alert("Could not save", "Something went wrong. Please try again.");
      return false;
    }

    const label = finalPayload.merchant || finalPayload.title || finalPayload.name || "Item";
    const cadenceLabel = finalPayload.cadence ? ` · ${finalPayload.cadence}` : "";
    toast.show({ message: `${label} added${cadenceLabel}` });
    r.replace("/(tabs)");
    return true;
  }

  return (
    <>
      <RecurringForm
        mode="create"
        title={initialKind === "bill" ? "Add bill" : "Add subscription"}
        onBack={() => r.canGoBack?.() ? r.back() : r.replace("/(tabs)")}
        initialKind={initialKind}
        initialValues={initialValues}
        attachment={attachment}
        onRemoveAttachment={attachment ? () => {} : undefined}
        submitLabel="Save"
        stickySubmit={false}
        onSubmit={onSubmit}
      />

      <LimitReachedSheet
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        currentCount={currentCount}
      />
    </>
  );
}