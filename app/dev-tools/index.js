import React, { useState, useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  View, Text, ScrollView, Alert, Switch, Pressable,
  TextInput, Animated,
} from "react-native";
import { useTheme, useThemeSettings } from "../../lib/theme";
import { setOnboardingDone } from "../../lib/onboardingGate";
import { useOnboardingStore } from "../../lib/onboardingStore";
import { useStore } from "../../lib/store";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { useRecordingStore, RECORDING_HOOKS } from "../../lib/recordingMode";

async function copyToClipboard(text) {
  try {
    const Clipboard = await import("expo-clipboard");
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(String(text || ""));
      return true;
    }
  } catch {}
  return false;
}

function SectionLabel({ children, t }) {
  return (
    <Text style={{
      color: t.subtext, fontSize: 11, fontWeight: "800",
      textTransform: "uppercase", letterSpacing: 0.9,
      marginBottom: 8, marginLeft: 2,
    }}>
      {children}
    </Text>
  );
}

function DevItem({ t, icon, title, subtitle, onPress, danger, right }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        padding: 14, borderRadius: 14,
        backgroundColor: pressed ? t.surface2 : t.surface,
        borderWidth: 1, borderColor: danger ? "#FF3B3033" : t.hairline,
        flexDirection: "row", alignItems: "center", gap: 12,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Feather name={icon} size={17} color={danger ? "#FF3B30" : t.text} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? "#FF3B30" : t.text, fontWeight: "700", fontSize: 14 }}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: t.subtext, fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export default function DevTools() {
  const t = useTheme();
  const r = useRouter();
  const { mode, setThemeMode } = useThemeSettings();

  const onboardingReset = useOnboardingStore((s) => s.reset);

  const recordingActive = useRecordingStore((s) => s.active);
  const recordingPersona = useRecordingStore((s) => s.persona);
  const personaHistory = useRecordingStore((s) => s.personaHistory);
  const monthlyBurnOverride = useRecordingStore((s) => s.monthlyBurnOverride);
  const forcePro = useRecordingStore((s) => s.forcePro);
  const enableRecording = useRecordingStore((s) => s.enable);
  const disableRecording = useRecordingStore((s) => s.disable);
  const regeneratePersona = useRecordingStore((s) => s.regenerate);
  const restorePersona = useRecordingStore((s) => s.restorePersona);
  const setMonthlyBurnOverride = useRecordingStore((s) => s.setMonthlyBurnOverride);
  const setForcePro = useRecordingStore((s) => s.setForcePro);
  const hydrateRecording = useRecordingStore((s) => s.hydrate);

  const resetUserData = useStore((s) => s.resetUserData);
  const resetEmailStore = useEmailImportStore((s) => s.reset);

  React.useEffect(() => { hydrateRecording(); }, []);

  const [copiedHook, setCopiedHook] = useState(null);
  const [overrideInput, setOverrideInput] = useState(
    monthlyBurnOverride != null ? String(monthlyBurnOverride) : ""
  );
  const [toastMsg, setToastMsg] = useState(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  function showToast(msg) {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
  }

  async function handleCopyHook(hook, idx) {
    const copied = await copyToClipboard(hook);
    setCopiedHook(idx);
    showToast(copied ? "Copied to clipboard" : "Clipboard unavailable — install expo-clipboard");
    setTimeout(() => setCopiedHook(null), 2000);
  }

  function handleOverrideSubmit() {
    const n = parseFloat(overrideInput);
    if (overrideInput.trim() === "") {
      setMonthlyBurnOverride(null);
      showToast("Override cleared");
    } else if (Number.isFinite(n) && n > 0) {
      setMonthlyBurnOverride(n);
      showToast(`Override: $${n.toFixed(2)}/mo`);
    } else {
      showToast("Enter a valid number");
    }
  }

  function cycleTheme() {
    const next = mode === "system" ? "dark" : mode === "dark" ? "light" : "system";
    setThemeMode(next);
    showToast(`Theme: ${next}`);
  }

  async function resetOnboarding() {
    await setOnboardingDone(false);
    onboardingReset?.();
    showToast("Onboarding reset");
  }

  function nuclearReset() {
    Alert.alert(
      "Clear all data?",
      "Wipes subscriptions, bills, email store, onboarding, and recording persona. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Wipe everything",
          style: "destructive",
          onPress: async () => {
            await resetUserData?.();
            await resetEmailStore?.();
            await setOnboardingDone(false);
            onboardingReset?.();
            disableRecording();
            showToast("All data cleared");
          },
        },
      ]
    );
  }

  const effectiveBurn = monthlyBurnOverride != null
    ? monthlyBurnOverride
    : recordingPersona?.monthlyBurn ?? 0;

  const themeIconMap = { dark: "moon", light: "sun", system: "monitor" };
  const themeIcon = themeIconMap[mode] || "monitor";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>

      {toastMsg ? (
        <Animated.View style={{
          position: "absolute", top: 58, alignSelf: "center", zIndex: 99,
          backgroundColor: "#111827", borderRadius: 999,
          paddingHorizontal: 18, paddingVertical: 10,
          borderWidth: 1, borderColor: "#6366F144",
          opacity: toastOpacity,
        }}>
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>{toastMsg}</Text>
        </Animated.View>
      ) : null}

      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}>

        <Text style={{ fontSize: 24, fontWeight: "900", color: t.text }}>Developer Tools</Text>

        {/* ── RECORDING MODE ── */}
        <View>
          <SectionLabel t={t}>Recording Mode</SectionLabel>
          <View style={{
            borderRadius: 18, borderWidth: 1,
            borderColor: recordingActive ? "#6366F1" : t.hairline,
            backgroundColor: recordingActive ? "#6366F108" : t.surface,
            overflow: "hidden",
          }}>
            <View style={{
              padding: 14, flexDirection: "row", alignItems: "center",
              justifyContent: "space-between",
              borderBottomWidth: recordingActive ? 1 : 0, borderBottomColor: "#6366F122",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{
                  width: 32, height: 32, borderRadius: 9,
                  backgroundColor: recordingActive ? "#6366F122" : t.surface2,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Feather name="video" size={15} color={recordingActive ? "#6366F1" : t.subtext} />
                </View>
                <View>
                  <Text style={{ color: t.text, fontWeight: "800", fontSize: 15 }}>Recording Mode</Text>
                  <Text style={{ color: t.subtext, fontSize: 12, marginTop: 1 }}>
                    {recordingActive ? "ON — fake data active" : "OFF — real data"}
                  </Text>
                </View>
              </View>
              <Switch
                value={recordingActive}
                onValueChange={(v) => v ? enableRecording() : disableRecording()}
                trackColor={{ false: t.surface2, true: "#6366F1" }}
                thumbColor="#fff"
              />
            </View>

            {recordingActive && recordingPersona && (
              <View style={{ padding: 14, gap: 12 }}>

                {/* Persona card */}
                <View style={{
                  padding: 14, borderRadius: 14,
                  backgroundColor: t.surface2, borderWidth: 1, borderColor: t.hairline,
                }}>
                  <Text style={{ color: t.subtext, fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                    Current Persona
                  </Text>
                  <Text style={{ color: t.text, fontWeight: "900", fontSize: 20 }}>
                    {recordingPersona.name}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                    <Text style={{ color: t.subtext, fontSize: 12 }}>
                      {recordingPersona.subs.length} subs · {recordingPersona.bills.length} bills
                    </Text>
                    <Text style={{ color: "#6366F1", fontSize: 12, fontWeight: "700" }}>
                      ${effectiveBurn.toFixed(2)}/mo{monthlyBurnOverride != null ? " ✎" : ""}
                    </Text>
                  </View>
                  <View style={{ marginTop: 10, gap: 3 }}>
                    {recordingPersona.subs.slice(0, 5).map((s, i) => (
                      <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: t.subtext, fontSize: 12 }}>{s.title}</Text>
                        <Text style={{ color: t.text, fontSize: 12, fontWeight: "700" }}>${s.amount.toFixed(2)}</Text>
                      </View>
                    ))}
                    {recordingPersona.subs.length > 5 && (
                      <Text style={{ color: t.tertiary, fontSize: 11 }}>
                        +{recordingPersona.subs.length - 5} more
                      </Text>
                    )}
                  </View>
                </View>

                {/* Monthly total override */}
                <View>
                  <Text style={{ color: t.subtext, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                    Monthly Total Override
                  </Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{
                      flex: 1, flexDirection: "row", alignItems: "center",
                      borderWidth: 1, borderColor: t.hairline, borderRadius: 12,
                      backgroundColor: t.surface2, paddingHorizontal: 12,
                    }}>
                      <Text style={{ color: t.subtext, fontWeight: "700", marginRight: 4 }}>$</Text>
                      <TextInput
                        value={overrideInput}
                        onChangeText={setOverrideInput}
                        keyboardType="decimal-pad"
                        placeholder={recordingPersona.monthlyBurn.toFixed(2)}
                        placeholderTextColor={t.tertiary}
                        style={{ flex: 1, color: t.text, fontWeight: "700", paddingVertical: 10 }}
                        returnKeyType="done"
                        onSubmitEditing={handleOverrideSubmit}
                      />
                    </View>
                    <Pressable
                      onPress={handleOverrideSubmit}
                      style={{ paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#6366F1", justifyContent: "center" }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Set</Text>
                    </Pressable>
                    {monthlyBurnOverride != null && (
                      <Pressable
                        onPress={() => { setMonthlyBurnOverride(null); setOverrideInput(""); showToast("Override cleared"); }}
                        style={{ paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: t.hairline, justifyContent: "center" }}
                      >
                        <Feather name="x" size={14} color={t.subtext} />
                      </Pressable>
                    )}
                  </View>
                  <Text style={{ color: t.tertiary, fontSize: 11, marginTop: 4 }}>
                    Makes hook text match screen total exactly.
                  </Text>
                </View>

                {/* Regenerate */}
                <Pressable
                  onPress={regeneratePersona}
                  style={({ pressed }) => ({
                    padding: 13, borderRadius: 13,
                    backgroundColor: pressed ? "#6366F133" : "#6366F11A",
                    borderWidth: 1, borderColor: "#6366F133",
                    flexDirection: "row", alignItems: "center", gap: 10,
                  })}
                >
                  <Feather name="refresh-cw" size={15} color="#6366F1" />
                  <View>
                    <Text style={{ color: "#6366F1", fontWeight: "800", fontSize: 14 }}>New Persona</Text>
                    <Text style={{ color: "#6366F188", fontSize: 12 }}>Different name, subs & totals</Text>
                  </View>
                </Pressable>

                {/* Persona history */}
                {personaHistory.length > 0 && (
                  <View>
                    <Text style={{ color: t.subtext, fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                      Recent Personas
                    </Text>
                    <View style={{ gap: 6 }}>
                      {personaHistory.map((p) => (
                        <Pressable
                          key={p.generatedAt}
                          onPress={() => restorePersona(p)}
                          style={({ pressed }) => ({
                            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                            padding: 12, borderRadius: 12,
                            backgroundColor: pressed ? t.surface2 : t.surface,
                            borderWidth: 1, borderColor: t.hairline,
                          })}
                        >
                          <View>
                            <Text style={{ color: t.text, fontWeight: "700", fontSize: 13 }}>{p.name}</Text>
                            <Text style={{ color: t.subtext, fontSize: 11 }}>
                              ${p.monthlyBurn.toFixed(2)}/mo · {p.subs.length} subs
                            </Text>
                          </View>
                          <Text style={{ color: "#6366F1", fontSize: 12, fontWeight: "700" }}>Restore</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                )}

              </View>
            )}
          </View>
        </View>

        {/* ── HOOK PICKER ── */}
        {recordingActive && (
          <View>
            <SectionLabel t={t}>Hook Picker — Tap to Copy</SectionLabel>
            <View style={{ gap: 6 }}>
              {RECORDING_HOOKS.map((hook, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleCopyHook(hook, i)}
                  style={({ pressed }) => ({
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    padding: 13, borderRadius: 13,
                    backgroundColor: copiedHook === i ? "#10B98115" : pressed ? t.surface2 : t.surface,
                    borderWidth: 1, borderColor: copiedHook === i ? "#10B981" : t.hairline,
                  })}
                >
                  <Text style={{ color: copiedHook === i ? "#10B981" : t.text, fontWeight: "700", fontSize: 13, flex: 1 }}>
                    "{hook}"
                  </Text>
                  <Feather
                    name={copiedHook === i ? "check" : "copy"}
                    size={14}
                    color={copiedHook === i ? "#10B981" : t.tertiary}
                  />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ── JUMP TO SCREEN ── */}
        <View>
          <SectionLabel t={t}>Jump to Screen</SectionLabel>
          <View style={{ gap: 8 }}>
            <DevItem t={t} icon="home"        title="Home"              onPress={() => r.push("/(tabs)/")} />
            <DevItem t={t} icon="bar-chart-2" title="Insights"          onPress={() => r.push("/(tabs)/insights")} />
            <DevItem t={t} icon="list"        title="Recurring List"    onPress={() => r.push("/recurring")} />
            <DevItem t={t} icon="calendar"    title="Calendar"          onPress={() => r.push("/calendar")} />
            <DevItem t={t} icon="scissors"    title="Optimize"          onPress={() => r.push("/optimize")} />
            <DevItem t={t} icon="mail"        title="Mail Scan"         onPress={() => r.push("/account/connect-email/connected")} />
            <DevItem t={t} icon="inbox"       title="Review Queue"      onPress={() => r.push("/account/connect-email/review")} />
            <DevItem t={t} icon="search"      title="Scan (recording)"  onPress={() => r.push("/(onboarding)/scanning")} />
          </View>
        </View>

        {/* ── DEVELOPER TOGGLES ── */}
        <View>
          <SectionLabel t={t}>Developer Toggles</SectionLabel>
          <View style={{ gap: 8 }}>
            <View style={{
              padding: 14, borderRadius: 14, backgroundColor: t.surface,
              borderWidth: 1, borderColor: t.hairline,
              flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Feather name="star" size={17} color={forcePro ? "#F59E0B" : t.subtext} />
                <View>
                  <Text style={{ color: t.text, fontWeight: "700", fontSize: 14 }}>Force Pro</Text>
                  <Text style={{ color: t.subtext, fontSize: 12 }}>
                    {forcePro ? "Showing Pro UI" : "Showing Free UI"}
                  </Text>
                </View>
              </View>
              <Switch
                value={forcePro}
                onValueChange={setForcePro}
                trackColor={{ false: t.surface2, true: "#F59E0B" }}
                thumbColor="#fff"
              />
            </View>

            <DevItem
              t={t}
              icon={themeIcon}
              title={`Theme: ${mode}`}
              subtitle="Tap to cycle  system → dark → light"
              onPress={cycleTheme}
              right={<Feather name="chevron-right" size={14} color={t.tertiary} />}
            />
          </View>
        </View>

        {/* ── ONBOARDING ── */}
        <View>
          <SectionLabel t={t}>Onboarding</SectionLabel>
          <View style={{ gap: 8 }}>
            <DevItem t={t} icon="play"        title="Open Onboarding"       onPress={() => r.push("/(onboarding)/expectations")} />
            <DevItem t={t} icon="refresh-ccw" title="Reset Onboarding"      onPress={resetOnboarding} />
            <DevItem t={t} icon="rotate-ccw"  title="Reset + Open"
              onPress={async () => { await resetOnboarding(); r.replace("/(onboarding)/expectations"); }}
            />
            <DevItem t={t} icon="link"        title="Open Connect Inbox"    onPress={() => r.push("/(onboarding)/connect")} />
          </View>
        </View>

        {/* ── DANGER ZONE ── */}
        <View>
          <SectionLabel t={t}>Danger Zone</SectionLabel>
          <DevItem
            t={t} icon="trash-2" danger
            title="Clear All Data"
            subtitle="Wipes subs, bills, email, onboarding, persona"
            onPress={nuclearReset}
          />
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}