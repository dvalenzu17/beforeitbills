// app/(tabs)/_layout.js
import React, { useEffect } from "react";
import { View, Pressable } from "react-native";
import { MotiView } from "moti";
import { Tabs, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as Notifications from "expo-notifications";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../lib/theme";
import { ensureNotificationReady } from "../../lib/notifications";
import { useStore } from "../../lib/store";
import { useFeedbackStore } from "../../lib/feedbackStore";

// V4 principle: local-first, no auth gate.
// Sign-in is optional and should never block core tracking.
export default function TabsLayout() {
  const t = useTheme();
  const { t: tt } = useTranslation();
  const r = useRouter();
  const insets = useSafeAreaInsets();
  const showFeedback = useFeedbackStore((s) => s.show);

  const loadSubsLocal  = useStore((s) => s.loadSubsLocal);
  const loadBills      = useStore((s) => s.loadBills);
  const loadSavings    = useStore((s) => s.loadSavings);
  const loadSortOrder  = useStore((s) => s.loadSortOrder);
  const user           = useStore((s) => s.user);

  // Eagerly populate store from AsyncStorage before any tab mounts.
  // Tabs will find data already there - no loading flash on first switch.
  useEffect(() => {
    loadSubsLocal?.();
    loadBills?.();
    loadSavings?.();
    loadSortOrder?.();
  }, []);

  useEffect(() => {
    // asks permission + sets Android channels
    ensureNotificationReady();

    // When user taps notification → deep link to Brand page highlight
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp?.notification?.request?.content?.data || {};

      if (data?.type === "trial_end") {
        r.push({
          pathname: "/brand",
          params: {
            domain: data.domain || "",
            name: data.brand || "",
            highlight: "trial_end",
            effective: data.trialEndsAt || "",
          },
        });
        return;
      }

      if (data?.type === "price_change") {
        r.push({
          pathname: "/brand",
          params: {
            domain: data.domain || "",
            name: data.brand || "",
            highlight: "price_change",
            old: String(data.old ?? ""),
            new: String(data.new ?? ""),
            effective: data.effective || "",
          },
        });
      }
    });

    return () => sub.remove();
  }, [r]);

  return (
    <>
      <StatusBar style="light" />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: t.accent,
          tabBarInactiveTintColor: t.subtext,

          // ✅ kills the “white line”
          tabBarStyle: {
            backgroundColor: "transparent",
            borderTopWidth: 0,
            height: 56 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
            fontWeight: "700",
          },

          // ✅ ensures the bar itself is never white
          tabBarBackground: () => (
            <View style={{ flex: 1, backgroundColor: t.surface }} />
          ),

          tabBarLabelStyle: { fontWeight: "800" },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarTestID: "tab-home",
            tabBarIcon: ({ color, size, focused }) => (
              <MotiView
                animate={{ scale: focused ? 1.18 : 1 }}
                transition={{ type: "spring", damping: 14, mass: 0.3, stiffness: 280 }}
              >
                <Feather name="home" color={color} size={size} />
              </MotiView>
            ),
            tabBarButton: (props) => (
              <Pressable
                {...props}
                onLongPress={() => {
                  props.onLongPress?.();
                  showFeedback();
                }}
                delayLongPress={800}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: "Insights",
            tabBarTestID: "tab-insights",
            tabBarIcon: ({ color, size, focused }) => (
              <MotiView
                animate={{ scale: focused ? 1.18 : 1 }}
                transition={{ type: "spring", damping: 14, mass: 0.3, stiffness: 280 }}
              >
                <Feather name="bar-chart-2" color={color} size={size} />
              </MotiView>
            ),
          }}
        />

        {/* keep recap route but remove it from bottom nav */}
        <Tabs.Screen name="recap" options={{ href: null }} />

        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarTestID: "tab-account",
            tabBarIcon: ({ color, size, focused }) => (
              <MotiView
                animate={{ scale: focused ? 1.18 : 1 }}
                transition={{ type: "spring", damping: 14, mass: 0.3, stiffness: 280 }}
              >
                <Feather name="user" color={color} size={size} />
              </MotiView>
            ),
          }}
        />
      </Tabs>
    </>
  );
}
