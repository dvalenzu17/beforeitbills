import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useToast } from "../components/ToastProvider";
import { useTheme } from "../lib/theme";
import { useStore } from "../lib/store";
import { parseSubscriptionText } from "../lib/parseSubscription";

import { SPACING } from "../lib/ui/tokens";
import { canAddRecurring, FREE_RECURRING_LIMIT } from "../lib/limits";
import { resolveBrandMeta } from "../lib/brand/brandResolver";

import Button from "../components/Button";
import { track } from "../lib/analytics";
import NavHeader from "../components/NavHeader";
import LimitReachedSheet from "../components/LimitReachedSheet";


function formatISO(date) {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}


export default function ManualAdd() {

  const t = useTheme();
  const r = useRouter();
  const toast = useToast();

  const addRecurring = useStore((s) => s.addRecurring);
  const pro = useStore((s) => s.pro);
  const subs = useStore((s) => s.subs);
  const bills = useStore((s) => s.bills);

  const isCountableForLimit = (x) => {
    if (!x) return false;
    if (x?.active === false) return false;
    if (x?.archived === true) return false;
    if (x?.inactive === true) return false;
    if (String(x?.status || "").toLowerCase() === "inactive") return false;

    const isCandidate =
      x?.candidate ||
      x?.isCandidate ||
      x?.importCandidate ||
      (String(x?.source || "").toLowerCase() === "import" && x?.confirmed !== true);

    return !isCandidate;
  };

  const countableSubs = useMemo(() => (subs || []).filter(isCountableForLimit), [subs]);
  const countableBills = useMemo(() => (bills || []).filter(isCountableForLimit), [bills]);


  const [kind, setKind] = useState("subscription");
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");

  const [currency] = useState("USD");

  const [cadence, setCadence] = useState("monthly");

  const [nextRenewal, setNextRenewal] = useState(new Date());
  const [nextDue, setNextDue] = useState(new Date());

  const [shared, setShared] = useState(false);
  const [sharedCount, setSharedCount] = useState("2");
  const [sharedByMe, setSharedByMe] = useState(true);
  const [counterpartyName, setCounterpartyName] = useState("");

  const [isTrial, setIsTrial] = useState(false);
  const [trialEnd, setTrialEnd] = useState(new Date());

  const [pickerOpen, setPickerOpen] = useState(false);
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState("renewal");
  const [pickerTemp, setPickerTemp] = useState(new Date());

  const [limitOpen, setLimitOpen] = useState(false);

  const [nlText, setNlText] = useState("");
  const [nlParsing, setNlParsing] = useState(false);
  const nlInputRef = useRef(null);

  async function parseNL() {
    const trimmed = nlText.trim();
    if (!trimmed || nlParsing) return;
    setNlParsing(true);
    try {
      const result = await parseSubscriptionText(trimmed);
      if (result.name) setMerchant(result.name);
      if (result.amount != null) setAmount(String(result.amount));
      if (result.cadence) setCadence(result.cadence);
      if (result.kind === "bill" || result.kind === "subscription") setKind(result.kind);
      if (result.nextRenewal) {
        const d = new Date(result.nextRenewal + "T00:00:00");
        if (!isNaN(d)) {
          setNextRenewal(d);
          setNextDue(d);
        }
      }
      setNlText("");
    } catch (e) {
      Alert.alert("Couldn't parse that", e?.message || "Fill in the fields below manually.");
    } finally {
      setNlParsing(false);
    }
  }


  const canSave = useMemo(() => {

    const a = Number(amount);
    if (!Number.isFinite(a) || a <= 0) return false;

    if (merchant.trim().length < 2) return false;

    if (shared) {
      const n = Number(sharedCount);
      if (!Number.isFinite(n) || n < 1) return false;
    }

    return true;

  }, [amount, merchant, shared, sharedCount]);


  function openPicker(which) {

    setPickerMode(which);

    const base =
      which === "renewal"
        ? nextRenewal
        : which === "due"
        ? nextDue
        : trialEnd;

    setPickerTemp(base);

    if (Platform.OS === "android") {
      setAndroidPickerOpen(true);
      return;
    }

    setPickerOpen(true);
  }


  function applyDate(which, date) {

    if (which === "renewal") setNextRenewal(date);
    if (which === "due") setNextDue(date);
    if (which === "trial") setTrialEnd(date);

  }


  async function save() {

    if (!canSave) {
      Alert.alert("Missing info");
      return;
    }

    const gate = canAddRecurring(
      { pro, subs: countableSubs, bills: countableBills },
      FREE_RECURRING_LIMIT
    );

    if (!gate.ok) {
      setLimitOpen(true);
      return;
    }

    const brandMeta = await resolveBrandMeta({
      name: merchant.trim(),
      domain: "",
    });

    const payload =
      kind === "subscription"
        ? {
            kind: "subscription",
            merchant: merchant.trim(),
            title: merchant.trim(),
            domain: brandMeta?.domain || "",
            amount: Number(amount),
            currency,
            cadence,
            nextRenewal: formatISO(nextRenewal),
            is_trial: isTrial,
            trial_end: isTrial ? formatISO(trialEnd) : null,
            active: true,
          }
        : {
            kind: "bill",
            title: merchant.trim(),
            domain: brandMeta?.domain || "",
            amount: Number(amount),
            currency,
            nextDue: formatISO(nextDue),
            active: true,
          };

    const out = await addRecurring(payload);

    if (out?.error) {
      Alert.alert("Could not save");
      return;
    }

    const name = merchant.trim();
    track("subscription_added", { source: "manual", kind });

    // Use back() to cleanly return to wherever the user came from
    // rather than replace() which can cause a double navigation flash
    if (r.canGoBack?.()) {
      r.back();
    } else {
      r.replace("/(tabs)");
    }

    setTimeout(() => {
      toast.show({
        message: `${name} added`,
      });
    }, 80);
  }


  return (

    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>

      <NavHeader title="Add subscription" onBack={() => r.back()} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            padding: SPACING.screen,
            gap: SPACING.cardGap,
            paddingBottom: 40,
          }}
        >

          {/* ── Natural language quick-add ── */}
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: t.hairline,
              padding: 18,
              gap: 12,
              ...t.shadowMd,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>✨</Text>
              <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }}>
                Quick add
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
              <TextInput
                ref={nlInputRef}
                value={nlText}
                onChangeText={setNlText}
                placeholder="I pay $14.99/mo for Spotify…"
                placeholderTextColor={t.tertiary}
                returnKeyType="go"
                onSubmitEditing={parseNL}
                editable={!nlParsing}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 14,
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
                  borderRadius: 14,
                  width: 44,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: t.hairline,
                }}
              >
                {nlParsing
                  ? <ActivityIndicator size="small" color={t.text} />
                  : <Feather name="arrow-right" size={18} color={nlText.trim() ? "#fff" : t.subtext} />
                }
              </Pressable>
            </View>
            <Text style={{ color: t.tertiary, fontSize: 12, lineHeight: 16 }}>
              Describe it in plain English and we'll fill in the form.
            </Text>
          </View>

          <Section t={t} title="Type">

            <Selector
              value={kind}
              setValue={setKind}
              options={["subscription", "bill"]}
              t={t}
            />

          </Section>


          <Section t={t} title="Details">

            <Label t={t}>Merchant</Label>

            <Input
              value={merchant}
              onChangeText={setMerchant}
              placeholder="Netflix"
              t={t}
            />

            <Label t={t}>Amount</Label>

            <Input
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0.00"
              t={t}
            />

          </Section>


          {kind === "subscription" && (

            <Section t={t} title="Cadence">

              <Selector
                value={cadence}
                setValue={setCadence}
                options={["monthly", "yearly", "weekly", "quarterly"]}
                t={t}
              />

            </Section>

          )}


          <Section t={t} title="Next billing">

            <DateRow
              t={t}
              value={
                kind === "subscription"
                  ? formatISO(nextRenewal)
                  : formatISO(nextDue)
              }
              onPress={() =>
                openPicker(kind === "subscription" ? "renewal" : "due")
              }
            />

          </Section>


          <Section t={t} title="Sharing">

            <ToggleRow
              label="Shared expense"
              value={shared}
              onChange={setShared}
              t={t}
            />

          </Section>


          <Button
            title="Save"
            onPress={save}
            disabled={!canSave}
            left={<Feather name="check" size={16} color="#fff" />}
          />

          <LimitReachedSheet
            open={limitOpen}
            onClose={() => setLimitOpen(false)}
            count={countableSubs.length + countableBills.length}
          />

        </ScrollView>

      </KeyboardAvoidingView>

    </SafeAreaView>

  );
}


/* ---------- UI helpers ---------- */


function Section({ t, title, children }) {

  return (
    <View
      style={{
        padding: 18,
        borderRadius: 22,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.hairline,
        gap: 14,
        ...t.shadowMd,
      }}
    >

      <Text style={{ fontWeight: "800", color: t.subtext }}>
        {title}
      </Text>

      {children}

    </View>
  );
}


function Label({ t, children }) {

  return (
    <Text style={{ color: t.subtext, fontWeight: "700" }}>
      {children}
    </Text>
  );

}


function Input({ t, ...props }) {

  return (
    <TextInput
      {...props}
      placeholderTextColor={t.tertiary}
      style={{
        marginTop: 6,
        padding: 12,
        borderRadius: 14,
        backgroundColor: t.surface2,
        borderWidth: 1,
        borderColor: t.hairline,
        color: t.text,
      }}
    />
  );

}


function Selector({ value, setValue, options, t }) {

  return (
    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => setValue(o)}
          style={{
            paddingVertical: 9,
            paddingHorizontal: 14,
            borderRadius: 999,
            backgroundColor: value === o ? t.accent : t.surface2,
          }}
        >
          <Text style={{ color: value === o ? "#fff" : t.text }}>
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}


function DateRow({ t, value, onPress }) {

  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 12,
        borderRadius: 14,
        backgroundColor: t.surface2,
        borderWidth: 1,
        borderColor: t.hairline,
        flexDirection: "row",
        justifyContent: "space-between",
      }}
    >

      <Text style={{ color: t.text }}>
        {value}
      </Text>

      <Feather name="calendar" size={16} color={t.subtext} />

    </Pressable>
  );

}


function ToggleRow({ label, value, onChange, t }) {

  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >

      <Text style={{ color: t.text }}>
        {label}
      </Text>

      <Switch value={value} onValueChange={onChange} />

    </View>
  );

}