import React, { useMemo } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

import Screen from "@/components/Screen";
import RecurringForm from "@/components/recurring/RecurringForm";

import { useEmailImportStore } from "@/lib/emailImportStore";

export default function EditCandidate() {

  const router = useRouter();
  const params = useLocalSearchParams();

  const fp = String(params?.fp || params?.fingerprint || "");

  const candidates = useEmailImportStore((x) => x.candidates);
  const updateCandidate = useEmailImportStore((x) => x.updateCandidate);

  const candidate = useMemo(() => {
    return (candidates || []).find((c) => c?.fingerprint === fp) || null;
  }, [candidates, fp]);

  if (!candidate) {
    return (
      <Screen>
        <RecurringForm
          title="Edit detected item"
          submitLabel="Back"
          initialValues={{}}
          onSubmit={() => router.back()}
          onBack={() => router.back()}
        />
      </Screen>
    );
  }

  async function handleSubmit(payload) {

    await updateCandidate?.(fp, {
      merchant: payload.merchant,
      amount: payload.amount,
      cadenceGuess: payload.cadence,
      nextDateGuess: payload.nextRenewal,

      shared: payload.shared,
      sharedCount: payload.sharedCount,

      is_trial: payload.is_trial,
      trial_end: payload.trial_end,
    });

    router.back();
  }

  return (
    <Screen>

      <RecurringForm

        title="Edit detected item"

        mode="edit"

        initialKind="subscription"

        initialValues={{
          kind: "subscription",

          merchant: candidate.merchant,
          amount: candidate.amount,

          cadence: candidate.cadenceGuess || "monthly",

          nextRenewal: candidate.nextDateGuess,

          shared: candidate.shared,
          sharedCount: candidate.sharedCount,

          is_trial: candidate.is_trial,
          trialEnd: candidate.trial_end,
        }}

        submitLabel="Save changes"

        onSubmit={handleSubmit}

        onBack={() => router.back()}

      />

    </Screen>
  );
}