// components/recurring/RecurringForm.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useTheme, useIsDark } from "../../lib/theme";
import { SPACING } from "../../lib/ui/tokens";
import { BILL_ICONS, getBillIcon } from "../../lib/billIcons";

import Button from "../Button";
import NavHeader from "../NavHeader";
import Glass from "../Glass";

// ---- helpers
function clampInt(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.round(x)));
}

function parseDateMaybe(s) {
  if (!s) return null;
  if (s instanceof Date) return Number.isNaN(s.getTime()) ? null : s;
  const d = new Date(String(s));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatISO(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

function snapshotToString(s) {
  const snap = {
    kind: s.kind,
    currency: s.currency,
    amount: s.amount,

    merchant: s.merchant,
    cadence: s.cadence,
    nextRenewal: s.nextRenewal,

    name: s.name,
    nextDue: s.nextDue,
    variable: s.variable,
    autopay: s.autopay,

    active: s.active,

    shared: s.shared,
    sharedCount: s.sharedCount,
    sharedByMe: s.sharedByMe,
    splitMethod: s.splitMethod,
    myShareAmount: s.myShareAmount,
    counterpartyName: s.counterpartyName,

    isTrial: s.isTrial,
    trialEnd: s.trialEnd,
    iconKey: s.iconKey,
  };

  return JSON.stringify(snap);
}

export default function RecurringForm({
  title,
  onBack,

  mode = "create",
  initialKind = "subscription",
  lockKind = false,
  initialValues,

  attachment,
  onRemoveAttachment,

  submitLabel = "Save",
  stickySubmit = false,
  onSubmit,
  onDelete,
  deleteLabel = "Delete / Archive",
  headerContent = null,
  footerContent = null,

  validationMessage = "Fill the required fields first.",
  onDirtyChange,
}) {
  const t = useTheme();
  const isDark = useIsDark();
  const pickerTheme = isDark ? "dark" : "light";
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const hydrated = useMemo(() => {
    const v = initialValues || {};
    const kind = v.kind === "bill" ? "bill" : v.kind === "subscription" ? "subscription" : initialKind;

    const merchant = String(v.merchant ?? v.title ?? "");
    const billName = String(v.name ?? v.title ?? "");

    return {
      kind,

      currency: String(v.currency ?? "USD").toUpperCase().slice(0, 3),
      amount: v.amount != null ? String(v.amount) : "",

      merchant,
      cadence: String(v.cadence ?? "monthly"),
      nextRenewal: parseDateMaybe(v.nextRenewal ?? v.next_renewal) || null,

      name: billName,
      nextDue: parseDateMaybe(v.nextDue ?? v.next_due) || null,
      variable: !!v.variable,
      autopay: !!v.autopay,

      active: v.active !== false,

      shared: !!v.shared,
      sharedCount: String(v.sharedCount ?? 2),
      sharedByMe: v.sharedByMe ?? true,
      splitMethod: v.splitMethod ?? (v.myShareAmount != null ? "custom" : "equal"),
      myShareAmount: v.myShareAmount != null ? String(v.myShareAmount) : "",
      counterpartyName: String(v.counterpartyName ?? ""),

      isTrial: !!(v.is_trial || v.trial || v.isTrial),
      trialEnd: parseDateMaybe(v.trial_end ?? v.trialEnd) || new Date(),

      iconKey: v.iconKey ?? "bill",
    };
  }, [initialValues, initialKind]);

  // state
  const [kind, setKind] = useState(hydrated.kind);

  const [currency, setCurrency] = useState(hydrated.currency);
  const [amount, setAmount] = useState(hydrated.amount);

  const [merchant, setMerchant] = useState(hydrated.merchant);
  const [cadence, setCadence] = useState(hydrated.cadence);
  const [nextRenewal, setNextRenewal] = useState(hydrated.nextRenewal);
  const [showIOSRenewal, setShowIOSRenewal] = useState(false);
  const [showAndroidRenewal, setShowAndroidRenewal] = useState(false);
  const [name, setName] = useState(hydrated.name);
  const [nextDue, setNextDue] = useState(hydrated.nextDue);
  const [showIOSDue, setShowIOSDue] = useState(false);
  const [showAndroidDue, setShowAndroidDue] = useState(false);
  const [variable, setVariable] = useState(hydrated.variable);
  const [autopay, setAutopay] = useState(hydrated.autopay);

  const [active, setActive] = useState(hydrated.active);

  const [shared, setShared] = useState(hydrated.shared);
  const [sharedCount, setSharedCount] = useState(hydrated.sharedCount);
  const [sharedByMe, setSharedByMe] = useState(hydrated.sharedByMe);
  const [splitMethod, setSplitMethod] = useState(hydrated.splitMethod);
  const [myShareAmount, setMyShareAmount] = useState(hydrated.myShareAmount);
  const [counterpartyName, setCounterpartyName] = useState(hydrated.counterpartyName);

  const [isTrial, setIsTrial] = useState(hydrated.isTrial);
  const [trialEnd, setTrialEnd] = useState(hydrated.trialEnd);
  const [showIOSTrialEnd, setShowIOSTrialEnd] = useState(false);
  const [showAndroidTrialEnd, setShowAndroidTrialEnd] = useState(false);

  const [iconKey, setIconKey] = useState(hydrated.iconKey);

  const divisor = useMemo(() => {
    if (!shared) return 1;
    return clampInt(sharedCount, 1, 50);
  }, [shared, sharedCount]);

  const amountNum = useMemo(() => {
    const a = Number(amount);
    return Number.isFinite(a) ? a : NaN;
  }, [amount]);

  const valid = useMemo(() => {
    if (!Number.isFinite(amountNum) || amountNum <= 0) return false;

    if (kind === "bill") {
      if (String(name).trim().length < 2) return false;
      if (!nextDue || Number.isNaN(nextDue.getTime())) return false;
      return true;
    }

    if (String(merchant).trim().length < 2) return false;
    if (!cadence) return false;
    if (!nextRenewal || Number.isNaN(nextRenewal.getTime())) return false;
    if (isTrial && (!trialEnd || Number.isNaN(trialEnd.getTime()))) return false;

    if (shared && splitMethod === "custom") {
      const ms = Number(myShareAmount);
      if (!Number.isFinite(ms) || ms < 0) return false;
      if (ms > amountNum) return false;
    }

    return true;
  }, [amountNum, kind, name, nextDue, merchant, cadence, nextRenewal, isTrial, trialEnd, shared, splitMethod, myShareAmount]);

  // dirty tracking baseline
  const baselineRef = useRef(null);

  useEffect(() => {
    if (baselineRef.current) return;

    baselineRef.current = snapshotToString({
      kind,
      currency: String(currency || ""),
      amount: String(amount || ""),

      merchant: String(merchant || ""),
      cadence: String(cadence || ""),
      nextRenewal: formatISO(nextRenewal),

      name: String(name || ""),
      nextDue: formatISO(nextDue),
      variable: !!variable,
      autopay: !!autopay,

      active: !!active,

      shared: !!shared,
      sharedCount: String(sharedCount || ""),
      sharedByMe: !!sharedByMe,
      splitMethod: String(splitMethod || ""),
      myShareAmount: String(myShareAmount || ""),
      counterpartyName: String(counterpartyName || ""),

      isTrial: !!isTrial,
      trialEnd: formatISO(trialEnd),
      iconKey: String(iconKey || "bill"),
    });
  }, []);

  const currentSnap = useMemo(() => {
    return snapshotToString({
      kind,
      currency: String(currency || ""),
      amount: String(amount || ""),

      merchant: String(merchant || ""),
      cadence: String(cadence || ""),
      nextRenewal: formatISO(nextRenewal),

      name: String(name || ""),
      nextDue: formatISO(nextDue),
      variable: !!variable,
      autopay: !!autopay,

      active: !!active,

      shared: !!shared,
      sharedCount: String(sharedCount || ""),
      sharedByMe: !!sharedByMe,
      splitMethod: String(splitMethod || ""),
      myShareAmount: String(myShareAmount || ""),
      counterpartyName: String(counterpartyName || ""),

      isTrial: !!isTrial,
      trialEnd: formatISO(trialEnd),
      iconKey: String(iconKey || "bill"),
    });
  }, [
    kind,
    currency,
    amount,
    merchant,
    cadence,
    nextRenewal,
    name,
    nextDue,
    variable,
    autopay,
    active,
    shared,
    sharedCount,
    sharedByMe,
    splitMethod,
    myShareAmount,
    counterpartyName,
    isTrial,
    trialEnd,
    iconKey,
  ]);
  const isDirty = useMemo(() => {
    if (!baselineRef.current) return false;
    return currentSnap !== baselineRef.current;
  }, [currentSnap]);

  // Keep a ref in sync with isDirty so the beforeRemove closure never goes stale
  const isDirtyRef = useRef(false);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // In create mode: any valid form can be submitted (new record, nothing to diff against)
  // In edit mode: only submit if something actually changed
  const canSubmit = valid && (mode === "create" || isDirty);

  function buildPayload() {
    const baseShared = {
      shared,
      sharedCount: shared ? divisor : 1,
      sharedByMe,
      splitMethod: shared ? splitMethod : "equal",
      myShareAmount: shared && splitMethod === "custom" ? Number(myShareAmount) || 0 : null,
      counterpartyName: shared && !sharedByMe ? String(counterpartyName || "").trim() : null,
    };

    if (kind === "bill") {
      const dd = clampInt(nextDue?.getDate?.() ?? 1, 1, 31);
      return {
        kind: "bill",
        title: String(name).trim(),
        name: String(name).trim(),
        merchant: String(name).trim(),
        amount: Number(amountNum),
        currency: (currency || "USD").toUpperCase().slice(0, 3),
        nextDue: formatISO(nextDue),
        dueDay: dd,
        variable,
        autopay,
        active,
        iconKey: iconKey || "bill",
        ...baseShared,
        attachment: attachment || null,
      };
    }

    return {
      kind: "subscription",
      merchant: String(merchant).trim(),
      title: String(merchant).trim(),
      amount: Number(amountNum),
      currency: (currency || "USD").toUpperCase().slice(0, 3),
      cadence,
      nextRenewal: formatISO(nextRenewal),
      is_trial: isTrial,
      trial_end: isTrial ? formatISO(trialEnd) : null,
      active,
      ...baseShared,
      attachment: attachment || null,
    };
  }

  function handleDelete() {
    Alert.alert(
      "Delete this item?",
      "This will remove it from your tracking. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
      ]
    );
  }

  async function handleSubmit() {
    if (!valid) {
      Alert.alert("Validation", validationMessage);
      return false;
    }
    if (mode === "edit" && !isDirty) return true;

    try {
      const payload = buildPayload();

      // Reset both the snapshot baseline AND the ref synchronously before onSubmit.
      // The ref is what the beforeRemove listener reads - it must be false before
      // r.replace() fires inside onSubmit, which happens in the same tick.
      baselineRef.current = currentSnap;
      isDirtyRef.current = false;
      onDirtyChange?.(false);

      await onSubmit?.(payload, { kind });
      return true;
    } catch (e) {
      // Restore dirty so user can retry
      baselineRef.current = null;
      isDirtyRef.current = true;
      onDirtyChange?.(true);
      Alert.alert("Could not save", e?.message ? String(e.message) : "Unknown error");
      return false;
    }
  }

  function performExit(exitAction) {
    if (!isDirtyRef.current) {
      exitAction?.();
      return;
    }

    Alert.alert("Unsaved changes", "You have unsaved changes. What do you want to do?", [
      { text: "Keep editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => exitAction?.() },
      {
        text: "Save",
        onPress: async () => {
          const ok = await handleSubmit();
          if (ok) exitAction?.();
        },
      },
    ]);
  }

  // ✅ React Navigation hook: catches header back, gestures, router.back, etc.
  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", (e) => {
      // Use ref - not the closed-over isDirty - so this never goes stale
      if (!isDirtyRef.current) return;

      e.preventDefault();

      performExit(() => {
        navigation.dispatch(e.data.action);
      });
    });

    return unsub;
  }, [navigation]);

  // Android hardware back guard (extra safety)
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!onBack) return false;
      if (!isDirtyRef.current) return false;
      performExit(() => onBack?.());
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      {/* still call onBack, but guard is now guaranteed by beforeRemove */}
      <View style={{ marginBottom: 6 }}>
  <NavHeader title={title} onBack={() => performExit(onBack)} />
</View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{
              padding: SPACING.screen,
              gap: SPACING.cardGap,
              paddingBottom: (stickySubmit ? 64 : 0) + insets.bottom + 18,
            }}
            showsVerticalScrollIndicator={false}
          >
            {headerContent ? headerContent : null}

            {attachment ? (
              <Glass intensity={10} style={{ padding: 16, borderColor: t.hairline, borderWidth: 1 }}>
                <Text style={{ color: t.text, fontWeight: "700" }}>Receipt attached</Text>
                <Text style={{ color: t.subtext, marginTop: 6, fontWeight: "600" }}>
                  {attachment.name || "Upload"} {attachment.mimeType ? `· ${attachment.mimeType}` : ""}
                </Text>
                <View style={{ height: 10 }} />
                {onRemoveAttachment ? (
                  <Button title="Remove attachment" variant="ghost" onPress={onRemoveAttachment} />
                ) : null}
              </Glass>
            ) : null}

            <MattePanel t={t} title="Type" icon="tag">
              <Row>
                <Select t={t} active={kind === "subscription"} label="Subscription" onPress={() => (!lockKind ? setKind("subscription") : null)} disabled={lockKind} />
                <Select t={t} active={kind === "bill"} label="Bill" onPress={() => (!lockKind ? setKind("bill") : null)} disabled={lockKind} />
              </Row>
            </MattePanel>

            {mode === "edit" ? (
              <MattePanel t={t} title="Status" icon="activity">
                <ToggleRow t={t} label="Active" value={active} onChange={setActive} />
              </MattePanel>
            ) : null}

            <MattePanel t={t} title="Details" icon="edit-3">
              <Label t={t} required>{kind === "bill" ? "Bill name" : "Merchant"}</Label>
              <Input t={t} value={kind === "bill" ? name : merchant} onChangeText={kind === "bill" ? setName : setMerchant} placeholder={kind === "bill" ? "Rent" : "Netflix"} />

              {kind === "bill" ? (
                <>
                  <Label t={t} style={{ marginTop: 14 }}>Icon</Label>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginTop: 8, marginHorizontal: -4 }}
                    contentContainerStyle={{ paddingHorizontal: 4, gap: 8, flexDirection: "row" }}
                  >
                    {BILL_ICONS.map((b) => {
                      const active = iconKey === b.key;
                      return (
                        <Pressable
                          key={b.key}
                          onPress={() => setIconKey(b.key)}
                          style={{
                            alignItems: "center",
                            gap: 4,
                            paddingVertical: 10,
                            paddingHorizontal: 10,
                            borderRadius: 16,
                            borderWidth: 1.5,
                            borderColor: active ? b.color : t.hairline,
                            backgroundColor: active ? b.color + "18" : t.surface2,
                            minWidth: 62,
                          }}
                        >
                          <Feather name={b.icon} size={22} color={active ? b.color : t.subtext} />
                          <Text style={{ color: active ? b.color : t.subtext, fontSize: 10, fontWeight: "700", textAlign: "center" }} numberOfLines={1}>
                            {b.label.split(" / ")[0]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              ) : null}

              <Label t={t} style={{ marginTop: 14 }} required>Amount</Label>
              <Input t={t} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />

              <Label t={t} style={{ marginTop: 14 }}>Currency</Label>
              <WheelPicker
                t={t}
                value={currency}
                options={CURRENCY_OPTIONS}
                onChange={setCurrency}
              />

              {kind === "subscription" ? (
                <>
                  <Label t={t} style={{ marginTop: 14 }} required>Cadence</Label>
                  <WheelPicker
                    t={t}
                    value={cadence}
                    options={CADENCE_OPTIONS}
                    onChange={setCadence}
                  />

                  <Label t={t} style={{ marginTop: 14 }} required>Renews on</Label>

{Platform.OS === "android" ? (
  <>
    <DateRow
      t={t}
      value={formatISO(nextRenewal)}
      onPress={() => setShowAndroidRenewal(true)}
    />
    {showAndroidRenewal && (
      <DateTimePicker
        value={nextRenewal ?? new Date()}
        mode="date"
        display="default"
        themeVariant={pickerTheme}
        onChange={(event, d) => {
          setShowAndroidRenewal(false);
          if (event?.type === "dismissed") return;
          if (d) setNextRenewal(d);
        }}
      />
    )}
  </>
) : (
  <>
    <DateRow
      t={t}
      value={formatISO(nextRenewal)}
      onPress={() => setShowIOSRenewal((v) => !v)}
    />
    {showIOSRenewal && (
      <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface }}>
        <DateTimePicker
          value={nextRenewal ?? new Date()}
          mode="date"
          display="spinner"
          themeVariant={pickerTheme}
          onChange={(_, d) => { if (d) setNextRenewal(d); }}
        />
        <Pressable
          onPress={() => setShowIOSRenewal(false)}
          style={{ alignItems: "center", paddingVertical: 12, backgroundColor: t.accent }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Done</Text>
        </Pressable>
      </View>
    )}
  </>
)}
                </>
              ) : (
                <>
                  <Label t={t} style={{ marginTop: 14 }} required>Next due</Label>
                  {Platform.OS === "android" ? (
  <>
    <DateRow
      t={t}
      value={formatISO(nextDue)}
      onPress={() => setShowAndroidDue(true)}
    />
    {showAndroidDue && (
      <DateTimePicker
        value={nextDue ?? new Date()}
        mode="date"
        display="default"
        themeVariant={pickerTheme}
        onChange={(event, d) => {
          setShowAndroidDue(false);
          if (event?.type === "dismissed") return;
          if (d) setNextDue(d);
        }}
      />
    )}
  </>
) : (
                    <>
                      <DateRow t={t} value={formatISO(nextDue)} onPress={() => setShowIOSDue((v) => !v)} />
                      {showIOSDue ? (
                        <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface }}>
                          <DateTimePicker value={nextDue ?? new Date()} mode="date" display="spinner" themeVariant={pickerTheme} onChange={(_, d) => { if (d) setNextDue(d); }} />
                          <Pressable onPress={() => setShowIOSDue(false)} style={{ alignItems: "center", paddingVertical: 12, backgroundColor: t.accent }}>
                            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Done</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </>
                  )}
                  <View style={{ height: 12 }} />
                  <ToggleRow t={t} label="Variable amount" value={variable} onChange={setVariable} />
                  <View style={{ height: 10 }} />
                  <ToggleRow t={t} label="Autopay" value={autopay} onChange={setAutopay} />
                </>
              )}
            </MattePanel>

            <MattePanel t={t} title="Sharing" icon="users">
              <ToggleRow t={t} label="Shared expense" value={shared} onChange={setShared} />

              {shared ? (
                <>
                  <Label t={t} style={{ marginTop: 14 }}>Split between how many people?</Label>
                  <Input t={t} value={sharedCount} onChangeText={setSharedCount} keyboardType="number-pad" placeholder="2" />

                  <View style={{ height: 12 }} />
                  <ToggleRow t={t} label="Account under my name" value={sharedByMe} onChange={setSharedByMe} />

                  <Label t={t} style={{ marginTop: 14 }}>Split method</Label>
                  <Row>
                    <Select t={t} active={splitMethod === "equal"} label="Equal" onPress={() => setSplitMethod("equal")} />
                    <Select t={t} active={splitMethod === "custom"} label="Custom" onPress={() => setSplitMethod("custom")} />
                  </Row>

                  {splitMethod === "custom" ? (
                    <>
                      <Label t={t} style={{ marginTop: 14 }}>Your share (amount)</Label>
                      <Input t={t} value={myShareAmount} onChangeText={setMyShareAmount} keyboardType="decimal-pad" placeholder="0.00" />
                    </>
                  ) : null}

                  {!sharedByMe ? (
                    <>
                      <Label t={t} style={{ marginTop: 14 }}>Counterparty name</Label>
                      <Input t={t} value={counterpartyName} onChangeText={setCounterpartyName} placeholder="Alex" />
                    </>
                  ) : null}
                </>
              ) : null}
            </MattePanel>

            {kind === "subscription" ? (
              <MattePanel t={t} title="Trial" icon="clock">
                <ToggleRow t={t} label="Trial" value={isTrial} onChange={setIsTrial} />
                {isTrial ? (
                  <>
                    <Label t={t} style={{ marginTop: 14 }}>Trial ends</Label>
                    {Platform.OS === "android" ? (
  <>
    <DateRow
      t={t}
      value={formatISO(trialEnd)}
      onPress={() => setShowAndroidTrialEnd(true)}
    />
    {showAndroidTrialEnd && (
      <DateTimePicker
        value={trialEnd}
        mode="date"
        display="default"
        themeVariant={pickerTheme}
        onChange={(event, d) => {
          setShowAndroidTrialEnd(false);
          if (event?.type === "dismissed") return;
          if (d) setTrialEnd(d);
        }}
      />
    )}
  </>
) : (
                      <>
                        <DateRow t={t} value={formatISO(trialEnd)} onPress={() => setShowIOSTrialEnd((v) => !v)} />
                        {showIOSTrialEnd ? (
                          <View style={{ borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: t.hairline, backgroundColor: t.surface }}>
                            <DateTimePicker value={trialEnd} mode="date" display="spinner" themeVariant={pickerTheme} onChange={(_, d) => { if (d) setTrialEnd(d); }} />
                            <Pressable onPress={() => setShowIOSTrialEnd(false)} style={{ alignItems: "center", paddingVertical: 12, backgroundColor: t.accent }}>
                              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Done</Text>
                            </Pressable>
                          </View>
                        ) : null}
                      </>
                    )}
                  </>
                ) : null}
              </MattePanel>
            ) : null}

            {!stickySubmit ? (
              <>
                {footerContent ? footerContent : null}
                <Button title={submitLabel} onPress={handleSubmit} disabled={!canSubmit} />
                {onDelete ? <Button title={deleteLabel} variant="ghost" onPress={handleDelete} /> : null}
              </>
            ) : null}
            {stickySubmit && footerContent ? footerContent : null}
          </ScrollView>

          {stickySubmit ? (
            <View
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                paddingHorizontal: 16,
                paddingTop: 10,
                paddingBottom: insets.bottom + 12,
                backgroundColor: t.bg,
                borderTopWidth: 1,
                borderTopColor: t.hairline,
                ...t.shadowMd,
              }}
            >
              <Button title={submitLabel} onPress={handleSubmit} disabled={!canSubmit} />
              {!valid ? (
                <Text style={{ color: t.subtext, fontSize: 12, textAlign: "center", marginTop: 6 }}>
                  * Fields marked with * are required
                </Text>
              ) : null}
              {onDelete ? <View style={{ height: 10 }} /> : null}
              {onDelete ? <Button title={deleteLabel} variant="ghost" onPress={handleDelete} /> : null}
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ---------- UI primitives ---------- */

function MattePanel({ t, title, icon, children }) {
  return (
    <View
      style={{
        padding: SPACING.screen,
        borderRadius: 22,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.hairline,
        gap: 14,
        ...t.shadowMd,
      }}
    >

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 4,
        }}
      >

        {icon ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.surface2,
              borderWidth: 1,
              borderColor: t.hairline,
            }}
          >
            <Feather name={icon} size={16} color={t.text} />
          </View>
        ) : null}

        <Text
          style={{
            color: t.subtext,
            fontWeight: "800",
            fontSize: 14,
          }}
        >
          {title}
        </Text>

      </View>

      {children}

    </View>
  );
}

function Label({ t, children, style, required }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
      <Text style={[{ color: t.subtext, fontWeight: "600" }, style]}>{children}</Text>
      {required ? <Text style={{ color: "#EF4444", fontWeight: "900", fontSize: 13 }}>*</Text> : null}
    </View>
  );
}

function Input({ t, style, ...props }) {
  return (
    <TextInput
      {...props}
      placeholderTextColor={t.tertiary}
      style={[
        {
          marginTop: 8,
          padding: 13,
          borderRadius: 14,
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.hairline,
          color: t.text,
          fontWeight: "600",
          ...t.shadowSm,
        },
        style,
      ]}
    />
  );
}

function Select({ t, active, label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: active ? t.accent : t.surface2,
        borderWidth: 1,
        borderColor: active ? t.accent : t.hairline,
        opacity: disabled ? 0.6 : 1,
        ...t.shadowSm,
      }}
    >
      <Text style={{ color: active ? "#fff" : t.text, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

function Row({ children, wrap }) {
  return <View style={{ flexDirection: "row", gap: 10, flexWrap: wrap ? "wrap" : "nowrap" }}>{children}</View>;
}

function DateRow({ t, value, onPress }) {
  const hasValue = value && value.length > 0;
  return (
    <Pressable
      onPress={onPress}
      style={{ marginTop: 8, padding: 12, borderRadius: 14, backgroundColor: t.surface2, borderWidth: 1, borderColor: hasValue ? t.hairline : t.accent, flexDirection: "row", justifyContent: "space-between", alignItems: "center", ...t.shadowSm }}
    >
      <Text style={{ color: hasValue ? t.text : t.subtext, fontWeight: "600" }}>
        {hasValue ? value : "Tap to select date"}
      </Text>
      <Feather name="calendar" size={16} color={hasValue ? t.subtext : t.accent} />
    </Pressable>
  );
}

function ToggleRow({ t, label, value, onChange }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, alignItems: "center" }}>
      <Text style={{ color: t.text, fontWeight: "600" }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const CADENCE_OPTIONS = [
  { value: "monthly",   label: "Monthly"   },
  { value: "yearly",    label: "Yearly"    },
  { value: "weekly",    label: "Weekly"    },
  { value: "biweekly",  label: "Biweekly"  },
  { value: "quarterly", label: "Quarterly" },
];

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar"        },
  { value: "EUR", label: "EUR - Euro"              },
  { value: "GBP", label: "GBP - British Pound"    },
  { value: "CAD", label: "CAD - Canadian Dollar"  },
  { value: "AUD", label: "AUD - Australian Dollar"},
  { value: "JPY", label: "JPY - Japanese Yen"     },
  { value: "MXN", label: "MXN - Mexican Peso"     },
  { value: "BRL", label: "BRL - Brazilian Real"   },
  { value: "CHF", label: "CHF - Swiss Franc"      },
  { value: "INR", label: "INR - Indian Rupee"     },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "HKD", label: "HKD - Hong Kong Dollar" },
  { value: "NZD", label: "NZD - New Zealand Dollar"},
  { value: "SEK", label: "SEK - Swedish Krona"    },
  { value: "NOK", label: "NOK - Norwegian Krone"  },
  { value: "DKK", label: "DKK - Danish Krone"     },
  { value: "PLN", label: "PLN - Polish Złoty"     },
  { value: "CZK", label: "CZK - Czech Koruna"     },
  { value: "ZAR", label: "ZAR - South African Rand"},
  { value: "ARS", label: "ARS - Argentine Peso"   },
  { value: "CLP", label: "CLP - Chilean Peso"     },
  { value: "COP", label: "COP - Colombian Peso"   },
  { value: "PEN", label: "PEN - Peruvian Sol"     },
  { value: "PAB", label: "PAB - Panamanian Balboa"},
];

const ITEM_H = 52;
const VISIBLE_ITEMS = 5;

function WheelPicker({ t, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const listRef = useRef(null);

  const currentIdx = options.findIndex((o) => o.value === value);
  const displayLabel = options.find((o) => o.value === value)?.label?.split(" - ")[0] ?? value;

  function scrollToIndex(idx, animated = false) {
    listRef.current?.scrollToOffset({
      offset: Math.max(0, idx) * ITEM_H,
      animated,
    });
  }

  function handleScrollEnd(e) {
    const idx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(idx, options.length - 1));
    onChange(options[clamped].value);
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          marginTop: 8, padding: 13, borderRadius: 14,
          backgroundColor: t.surface2, borderWidth: 1,
          borderColor: t.hairline,
          flexDirection: "row", alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>{displayLabel}</Text>
        <Feather name="chevron-down" size={16} color={t.subtext} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: t.bg,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingBottom: 34,
              borderTopWidth: 1, borderColor: t.hairline,
            }}
            onPress={() => {}}
          >
            {/* Header */}
            <View style={{
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
              paddingHorizontal: 20, paddingVertical: 16,
              borderBottomWidth: 1, borderBottomColor: t.hairline,
            }}>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 15 }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={() => setOpen(false)}>
                <Text style={{ color: t.accent, fontWeight: "800", fontSize: 16 }}>Done</Text>
              </Pressable>
            </View>

            {/* Wheel */}
            <View style={{ height: ITEM_H * VISIBLE_ITEMS, position: "relative" }}>
              {/* Selection highlight band */}
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: ITEM_H * 2,
                  left: 20, right: 20,
                  height: ITEM_H,
                  borderRadius: 12,
                  backgroundColor: t.accent + "1A",
                  borderTopWidth: 1, borderBottomWidth: 1,
                  borderColor: t.accent + "44",
                }}
              />
              <FlatList
                ref={listRef}
                data={options}
                keyExtractor={(item) => item.value}
                snapToInterval={ITEM_H}
                decelerationRate="fast"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
                getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
                onLayout={() => scrollToIndex(currentIdx)}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={handleScrollEnd}
                renderItem={({ item, index }) => {
                  const isSelected = item.value === value;
                  return (
                    <Pressable
                      onPress={() => {
                        onChange(item.value);
                        scrollToIndex(index, true);
                      }}
                      style={{
                        height: ITEM_H,
                        alignItems: "center",
                        justifyContent: "center",
                        paddingHorizontal: 20,
                      }}
                    >
                      <Text style={{
                        color: isSelected ? t.text : t.subtext,
                        fontWeight: isSelected ? "800" : "500",
                        fontSize: isSelected ? 17 : 15,
                      }}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}