import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { resolveBrandMeta } from "../lib/brand/brandResolver";
import { useStore } from "../lib/store";
import { useTheme } from "../lib/theme";
import { canAddRecurring, FREE_RECURRING_LIMIT, getRecurringCount } from "../lib/limits";
import { useToast } from "../components/ToastProvider";
import { parseSubscriptionText } from "../lib/parseSubscription";

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
  const { t: tt } = useTranslation();
  const t = useTheme();

  const addRecurring = useStore((s) => s.addRecurring);
  const pro = useStore((s) => s.pro);
  const subs = useStore((s) => s.subs);
  const bills = useStore((s) => s.bills);

  const [limitOpen, setLimitOpen] = useState(false);
  const [nlText, setNlText] = useState("");
  const [nlParsing, setNlParsing] = useState(false);
  const [nlParsed, setNlParsed] = useState(null);
  const [formKey, setFormKey] = useState(0);

  // Auto-parse text shared via the iOS Share Extension
  useEffect(() => {
    const shareText = params?.shareText ? String(params.shareText) : '';
    if (!shareText) return;
    setNlText(shareText);
    setNlParsing(true);
    parseSubscriptionText(shareText)
      .then((result) => {
        setNlParsed(result);
        setNlText('');
        setFormKey((k) => k + 1);
      })
      .catch(() => { /* parse failed - user fills in manually */ })
      .finally(() => setNlParsing(false));
  }, []);

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
    const base = {
      kind: nlParsed?.kind || initialKind,
      currency: "USD",
      amount: nlParsed?.amount != null ? String(nlParsed.amount) : (params?.amount ? String(params.amount) : ""),
      merchant: nlParsed?.name || (params?.merchant ? String(params.merchant) : ""),
      title: nlParsed?.name || (params?.title ? String(params.title) : ""),
      cadence: nlParsed?.cadence || (params?.cadence ? String(params.cadence) : "monthly"),
      nextRenewal: (nlParsed?.nextRenewal ? parseDateMaybe(nlParsed.nextRenewal) : null) || parseDateMaybe(params?.nextRenewal) || null,
      nextDue: (nlParsed?.nextRenewal ? parseDateMaybe(nlParsed.nextRenewal) : null) || parseDateMaybe(params?.nextDue) || null,
      is_trial: !!params?.trial_end,
      trial_end: parseDateMaybe(params?.trial_end) || new Date(),
      attachment,
      active: true,
    };
    return base;
  }, [params, initialKind, attachment, nlParsed]);

  async function parseNL() {
    const trimmed = nlText.trim();
    if (!trimmed || nlParsing) return;
    setNlParsing(true);
    try {
      const result = await parseSubscriptionText(trimmed);
      setNlParsed(result);
      setNlText("");
      setFormKey((k) => k + 1); // re-mount form with new initialValues
    } catch (e) {
      Alert.alert("Couldn't parse", "Fill in the fields below manually.");
    } finally {
      setNlParsing(false);
    }
  }

  const nlInput = (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: nlParsed ? t.accent + "66" : t.hairline,
        padding: 16,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 15 }}>✨</Text>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 14 }}>Quick add</Text>
        {nlParsed && (
          <Pressable onPress={() => { setNlParsed(null); setFormKey((k) => k + 1); }} style={{ marginLeft: "auto" }}>
            <Text style={{ color: t.subtext, fontSize: 12 }}>Clear</Text>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
        <TextInput
          value={nlText}
          onChangeText={setNlText}
          placeholder="I pay $14.99/mo for Spotify…"
          placeholderTextColor={t.tertiary}
          returnKeyType="go"
          onSubmitEditing={parseNL}
          editable={!nlParsing}
          style={{
            flex: 1,
            padding: 11,
            borderRadius: 12,
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: nlText.length > 0 ? t.accent : t.hairline,
            color: t.text,
            fontSize: 14,
          }}
        />
        <Pressable
          onPress={parseNL}
          disabled={!nlText.trim() || nlParsing}
          style={{
            backgroundColor: nlText.trim() && !nlParsing ? t.accent : t.surface2,
            borderRadius: 12,
            width: 42,
            height: 42,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.hairline,
          }}
        >
          {nlParsing
            ? <ActivityIndicator size="small" color={t.text} />
            : <Feather name="arrow-right" size={16} color={nlText.trim() ? "#fff" : t.subtext} />
          }
        </Pressable>
      </View>
      {nlParsed && (
        <Text style={{ color: "#34D399", fontSize: 12, fontWeight: "700" }}>
          ✓ Fields pre-filled from your description
        </Text>
      )}
    </View>
  );

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
      Alert.alert(tt("recurring_screen.saveErrorTitle"), tt("recurring_screen.saveErrorBody"));
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
        key={formKey}
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
        headerContent={nlInput}
      />

      <LimitReachedSheet
        open={limitOpen}
        onClose={() => setLimitOpen(false)}
        currentCount={currentCount}
      />
    </>
  );
}