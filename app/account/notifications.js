// app/account/notifications.js
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Notifications from "expo-notifications";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import { useStore } from "../../lib/store";
import Button from "../../components/Button";
import NavHeader from "../../components/NavHeader";
import { SPACING } from "../../lib/ui/tokens";

// ── helpers ──────────────────────────────────────────────────────────────────

async function requestPermission() {
  const { status } = await Notifications.getPermissionsAsync();
  if (status === "granted") return true;
  const { status: newStatus } = await Notifications.requestPermissionsAsync();
  return newStatus === "granted";
}

/** "HH:MM" → Date with today's date at that time */
function hhmm2date(hhmm) {
  const [hh, mm] = (hhmm || "09:00").split(":").map(Number);
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return d;
}

/** Date → "HH:MM" */
function date2hhmm(d) {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** "HH:MM" → "9:00 AM" */
function hhmm2friendly(hhmm) {
  const [hh, mm] = (hhmm || "09:00").split(":").map(Number);
  const suffix = hh < 12 ? "AM" : "PM";
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

// ── sub-components ───────────────────────────────────────────────────────────

function Group({ t, children }) {
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: t.hairline,
        overflow: "hidden",
      }}
    >
      {children}
    </View>
  );
}

function ToggleRow({ t, label, subtitle, value, onChange, isLast }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: SPACING.screen,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: t.hairline,
        gap: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>{label}</Text>
        {subtitle ? (
          <Text style={{ color: t.subtext, marginTop: 3, fontSize: 13, lineHeight: 18 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

/**
 * Tappable row that shows the current time and expands an inline picker on iOS
 * or pops the system dialog on Android.
 */
function TimePickerRow({ t, tt, timeOfDay, onChange, isLast }) {
  const [iosOpen, setIosOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);

  function handleChange(_event, selected) {
    if (Platform.OS === "android") {
      setAndroidOpen(false);
      if (selected) onChange(date2hhmm(selected));
    } else {
      if (selected) onChange(date2hhmm(selected));
    }
  }

  return (
    <>
      <Pressable
        onPress={() => {
          if (Platform.OS === "android") setAndroidOpen(true);
          else setIosOpen((v) => !v);
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: SPACING.screen,
          paddingVertical: 14,
          borderBottomWidth: iosOpen || isLast ? 0 : 1,
          borderBottomColor: t.hairline,
          gap: 12,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>
            {tt("notif.timeLabel")}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 3, fontSize: 13, lineHeight: 18 }}>
            {tt("notif.timeSub")}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: t.accent, fontWeight: "700", fontSize: 15 }}>
            {hhmm2friendly(timeOfDay)}
          </Text>
          <Feather
            name={Platform.OS === "ios" ? (iosOpen ? "chevron-up" : "chevron-down") : "edit-2"}
            size={14}
            color={t.subtext}
          />
        </View>
      </Pressable>

      {/* iOS: inline spinner that slides in below */}
      {Platform.OS === "ios" && iosOpen && (
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: t.hairline,
            borderBottomWidth: isLast ? 0 : 1,
            borderBottomColor: t.hairline,
          }}
        >
          <DateTimePicker
            mode="time"
            display="spinner"
            value={hhmm2date(timeOfDay)}
            onChange={handleChange}
            textColor={t.text}
            themeVariant="dark"
            style={{ height: 160 }}
          />
        </View>
      )}

      {/* Android: modal dialog, rendered only when open */}
      {Platform.OS === "android" && androidOpen && (
        <DateTimePicker
          mode="time"
          display="default"
          value={hhmm2date(timeOfDay)}
          onChange={handleChange}
        />
      )}
    </>
  );
}

// ── screen ───────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const t = useTheme();
  const r = useRouter();
  const { notificationSettings, updateNotificationSettings } = useStore();
  const { t: tt } = useTranslation();

  const [renewalsEnabled, setRenewalsEnabled] = useState(
    !!notificationSettings?.renewalsEnabled
  );
  const [remind7d, setRemind7d] = useState(
    (notificationSettings?.daysBefore || []).includes(7)
  );
  const [remind3d, setRemind3d] = useState(
    (notificationSettings?.daysBefore || [3, 1]).includes(3)
  );
  const [remind1d, setRemind1d] = useState(
    (notificationSettings?.daysBefore || [3, 1]).includes(1)
  );
  const [timeOfDay, setTimeOfDay] = useState(
    notificationSettings?.timeOfDay || "09:00"
  );
  const [newSubAlerts, setNewSubAlerts] = useState(
    notificationSettings?.newSubAlertsEnabled !== false
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert(tt("notif.blockedTitle"), tt("notif.blockedBody"));
        setSaving(false);
        return;
      }

      const daysBefore = [remind7d && 7, remind3d && 3, remind1d && 1].filter(Boolean);

      await updateNotificationSettings?.({
        renewalsEnabled,
        daysBefore: daysBefore.length ? daysBefore : [1],
        timeOfDay,
        newSubAlertsEnabled: newSubAlerts,
      });

      Alert.alert(
        renewalsEnabled ? tt("notif.onAlert") : tt("notif.offAlert"),
        renewalsEnabled
          ? tt("notif.onBody", {
              days: daysBefore.join(", "),
              time: hhmm2friendly(timeOfDay),
            })
          : tt("notif.offBody")
      );
    } catch (e) {
      if (__DEV__) console.warn("[notif] save error:", e?.message);
      Alert.alert(tt("common.error"), tt("common.tryAgain"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <NavHeader
        title={tt("notif.title")}
        subtitle={tt("notif.subtitle")}
        onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(tabs)/account"))}
      />

      <ScrollView
        contentContainerStyle={{
          padding: SPACING.screen,
          gap: 24,
          paddingBottom: 40,
        }}
      >
        {/* Master toggle */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>
            {tt("notif.sectionReminders")}
          </Text>
          <Group t={t}>
            <ToggleRow
              t={t}
              label={tt("notif.masterLabel")}
              subtitle={tt("notif.masterSubtitle")}
              value={renewalsEnabled}
              onChange={setRenewalsEnabled}
              isLast
            />
          </Group>
        </View>

        {/* New subscription alerts */}
        <View>
          <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>
            {tt("notif.sectionDiscover")}
          </Text>
          <Group t={t}>
            <ToggleRow
              t={t}
              label={tt("notif.newSubLabel")}
              subtitle={tt("notif.newSubSubtitle")}
              value={newSubAlerts}
              onChange={setNewSubAlerts}
              isLast
            />
          </Group>
        </View>

        {/* Timing - only shown when enabled */}
        {renewalsEnabled && (
          <>
            <View>
              <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>
                {tt("notif.sectionTiming")}
              </Text>
              <Group t={t}>
                <ToggleRow
                  t={t}
                  label={tt("notif.remind7d")}
                  subtitle={tt("notif.remind7dSub")}
                  value={remind7d}
                  onChange={setRemind7d}
                />
                <ToggleRow
                  t={t}
                  label={tt("notif.remind3d")}
                  subtitle={tt("notif.remind3dSub")}
                  value={remind3d}
                  onChange={setRemind3d}
                />
                <ToggleRow
                  t={t}
                  label={tt("notif.remind1d")}
                  subtitle={tt("notif.remind1dSub")}
                  value={remind1d}
                  onChange={setRemind1d}
                  isLast
                />
              </Group>
            </View>

            <View>
              <Text style={{ color: t.subtext, fontWeight: "700", fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4 }}>
                {tt("notif.sectionTime")}
              </Text>
              <Group t={t}>
                <TimePickerRow
                  t={t}
                  tt={tt}
                  timeOfDay={timeOfDay}
                  onChange={setTimeOfDay}
                  isLast
                />
              </Group>
              <Text style={{ color: t.tertiary, fontSize: 12, marginTop: 8, marginLeft: 4, lineHeight: 17 }}>
                {tt("notif.footnote", { time: hhmm2friendly(timeOfDay) })}
              </Text>
            </View>
          </>
        )}

        <Button
          title={saving ? `${tt("notif.save")}…` : tt("notif.save")}
          onPress={save}
          disabled={saving}
          left={<Feather name="check" size={16} color="#fff" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
