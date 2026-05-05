// app/(tabs)/account.js
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, View, TouchableOpacity, Image, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { useTheme } from "../../lib/theme";
import { useStore } from "../../lib/store";
import GradientButton from "../../components/GradientButton";
import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { useAuthState } from "../../lib/authState";

import { SPACING } from "../../lib/ui/tokens";
import { VStack, HStack } from "../../components/ui/Stack";
import * as T from "../../components/ui/Text";

import profilePic from "../../assets/profile.jpg";

export default function Account() {
  const t = useTheme();
  const router = useRouter();
  const { t: tt } = useTranslation();

  const { user, profile, updateProfile, pro } = useStore();
  const resetUserData = useStore((s) => s.resetUserData);
  const resetEmailStore = useEmailImportStore((s) => s.reset);
  const clearBypass = useAuthState((s) => s.clearBypass);
  const [signingOut, setSigningOut] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const isPro = !!pro;

  async function handleSignOut() {
    Alert.alert(
      "Sign out",
      "You'll need to sign in again to sync across devices.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: async () => {
            try {
              setSigningOut(true);
              if (SUPABASE_CONFIGURED && supabase) {
                await supabase.auth.signOut();
              }
              await resetUserData?.();
              await resetEmailStore?.();
              await clearBypass?.();
            } catch (e) {
              Alert.alert("Sign out failed", e?.message || "Try again.");
            } finally {
              setSigningOut(false);
            }
          },
        },
      ]
    );
  }

  const displayName =
    profile?.name || user?.user_metadata?.name || profile?.username || tt("common.user");
  const username = profile?.username || "username0000";

  async function pickAvatar(fromCamera) {
    try {
      if (fromCamera) {
        const existing = await ImagePicker.getCameraPermissionsAsync();
        if (existing.status !== "granted") {
          if (!existing.canAskAgain) {
            Alert.alert(tt("account.cameraTitle"), tt("account.cameraPerm"));
            return;
          }
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(tt("account.cameraTitle"), tt("account.cameraPerm"));
            return;
          }
        }
      } else {
        const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
        if (existing.status !== "granted") {
          if (!existing.canAskAgain) {
            Alert.alert(tt("account.photosTitle"), tt("account.photosPerm"));
            return;
          }
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") {
            Alert.alert(tt("account.photosTitle"), tt("account.photosPerm"));
            return;
          }
        }
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: "images", quality: 0.8, allowsEditing: true, aspect: [1, 1] })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.8, allowsEditing: true, aspect: [1, 1] });

      if (result.canceled) return;
      const localUri = result.assets?.[0]?.uri;
      if (!localUri) return;

      // Optimistically show the local image while upload runs
      await updateProfile({ avatarUri: localUri });

      // Upload to Supabase Storage so the URL works on any device / after reinstall.
      // Failures are silent — user sees the photo immediately via the local URI.
      if (SUPABASE_CONFIGURED && supabase && user) {
        setUploadingAvatar(true);
        try {
          const ext = localUri.split(".").pop()?.toLowerCase().replace(/[^a-z]/g, "") || "jpg";
          const path = `avatars/${user.id}.${ext}`;

          const fetchRes = await fetch(localUri);
          const blob = await fetchRes.blob();

          const { error: uploadErr } = await supabase.storage
            .from("avatars")
            .upload(path, blob, {
              contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
              upsert: true,
            });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage
              .from("avatars")
              .getPublicUrl(path);
            const publicUrl = urlData?.publicUrl;
            if (publicUrl) {
              await updateProfile({ avatarUri: publicUrl });
            }
          } else {
            if (__DEV__) console.warn("[account] avatar upload error:", uploadErr?.message);
          }
        } catch (e) {
          if (__DEV__) console.warn("[account] avatar upload failed:", e?.message);
        } finally {
          setUploadingAvatar(false);
        }
      }
    } catch (e) {
      if (__DEV__) console.warn("[account] pickAvatar failed:", e?.message);
    }
  }

  function avatarMenu() {
    Alert.alert(tt("account.photoMenuTitle"), tt("account.photoMenuBody"), [
      { text: tt("account.takePhoto"), onPress: () => pickAvatar(true) },
      { text: tt("account.uploadImage"), onPress: () => pickAvatar(false) },
      { text: tt("account.removeImage"), style: "destructive", onPress: () => updateProfile({ avatarUri: null }) },
      { text: tt("common.cancel"), style: "cancel" },
    ]);
  }

  const settingsItems = [
    { label: tt("account.items.upgrade.label"), subtext: isPro ? tt("account.items.upgrade.subtextPro") : tt("account.items.upgrade.subtextFree"), icon: "checkmark-outline", route: "/account/upgrade" },
    { label: tt("account.items.personal.label"), subtext: tt("account.items.personal.subtext"), icon: "person-outline", route: "/account/personal" },
    { label: tt("account.items.security.label"), subtext: tt("account.items.security.subtext"), icon: "lock-closed-outline", route: "/account/security" },
    { label: tt("account.items.notifications.label"), subtext: tt("account.items.notifications.subtext"), icon: "notifications-outline", route: "/account/notifications" },
    { label: tt("account.items.connected.label"), subtext: tt("account.items.connected.subtext"), icon: "link-outline", route: "/account/connected" },
  ];

  const appInfoItems = [
    { label: tt("account.items.settings.label") || "Settings", subtext: tt("account.items.settings.subtext") || "Language, notifications, data", icon: "settings-outline", route: "/account/settings" },
    isPro
      ? { label: "Priority support", subtext: "Direct line to our team", icon: "chatbubble-outline", onPress: () => Linking.openURL("mailto:support@beforeitbills.com") }
      : { label: "Priority support", subtext: "Available on Pro", icon: "chatbubble-outline", route: "/account/upgrade" },
    { label: tt("account.items.help.label"), subtext: tt("account.items.help.subtext"), icon: "help-circle-outline", route: "/account/help" },
    { label: tt("account.items.legals.label"), subtext: tt("account.items.legals.subtext"), icon: "document-text-outline", route: "/account/legals" },
    { label: tt("account.items.export.label"), subtext: tt("account.items.export.subtext"), icon: "download-outline", route: "/account/export" },
    { label: tt("account.items.about.label"), subtext: tt("account.items.about.subtext"), icon: "information-circle-outline", route: "/account/about" },
  // DEV TOOLS — only visible when running via metro (never in production builds)
  ...(__DEV__ ? [{
    label: "Developer Tools",
    subtext: "Internal testing tools",
    icon: "code-slash-outline",
    route: "/dev-tools"
  }] : []),
  ];
  

  const Pill = ({ text, tone = "muted" }) => {
    const bg = tone === "pro" ? t.surface2 : t.soft || t.surface2;
    const border = tone === "pro" ? t.accent : t.hairline;
    const color = tone === "pro" ? t.text : t.subtext;

    return (
      <View
        style={{
          alignSelf: "flex-start",
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: bg,
        }}
      >
        <T.Sub style={{ color, fontWeight: "900" }}>{text}</T.Sub>
      </View>
    );
  };

  const SettingsCard = ({ items }) => (
    <View
      style={{
        backgroundColor: t.card,
        borderRadius: t.radius,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: t.border,
      }}
    >
      {items.map((item, idx) => (
        <TouchableOpacity
          key={item.label}
          onPress={() => item.onPress ? item.onPress() : item.route && router.push(item.route)}
          activeOpacity={item.route || item.onPress ? 0.85 : 1}
          style={{
            paddingHorizontal: SPACING.screen,
            paddingVertical: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: SPACING.rowGap,
            borderTopWidth: idx === 0 ? 0 : 1,
            borderTopColor: t.border,
          }}
        >
          <Ionicons name={item.icon} size={22} color={t.subtext} />
          <View style={{ flex: 1 }}>
            <T.H2 style={{ fontSize: 16 }}>{item.label}</T.H2>
            {!!item.subtext ? <T.Sub style={{ marginTop: 2 }}>{item.subtext}</T.Sub> : null}
          </View>
          <View style={{ paddingLeft: 6 }}>
  <Ionicons name="chevron-forward" size={18} color={t.subtext} />
</View>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: SPACING.screen, paddingBottom: 92, gap: SPACING.cardGap }}>
        <HStack style={{ justifyContent: "space-between", alignItems: "center" }}>
          <T.H2 style={{ fontSize: 22 }}>{tt("tabs.account")}</T.H2>
          {isPro ? <Pill text="PRO" tone="pro" /> : <Pill text={tt("account.freePill")} />}
        </HStack>

        {!isPro ? (
          <View
            style={{
              backgroundColor: t.card,
              shadowColor: "#000",
              shadowOpacity: 0.04,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              borderRadius: t.radius,
              borderWidth: 1,
              borderColor: t.border,
              padding: SPACING.screen,
            }}
          >
            <T.H2 style={{ fontSize: 16 }}>{tt("account.goProTitle")}</T.H2>
            <T.Sub style={{ marginTop: 6 }}>{tt("account.goProBody")}</T.Sub>

            <View style={{ height: SPACING.cardGap }} />

            <GradientButton
              title={tt("account.upgrade")}
              onPress={() => router.push("/account/upgrade")}
            />

          </View>
        ) : null}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: SPACING.screen,
            backgroundColor: t.card,
            borderRadius: t.radius,
            borderWidth: 1,
            borderColor: t.border,
            gap: SPACING.cardGap,
          }}
        >
          <TouchableOpacity onPress={avatarMenu} activeOpacity={0.85} disabled={uploadingAvatar}>
            <Image
              source={profile?.avatarUri ? { uri: profile.avatarUri } : profilePic}
              style={{ width: 80, height: 80, borderRadius: 40, opacity: uploadingAvatar ? 0.5 : 1 }}
            />
            {uploadingAvatar ? (
              <View
                style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  borderRadius: 40,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ActivityIndicator size="small" color={t.accent} />
              </View>
            ) : (
              <View
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  backgroundColor: t.surface,
                  borderRadius: 999,
                  padding: 6,
                  borderWidth: 1,
                  borderColor: t.border,
                }}
              >
                <Ionicons name="pencil" size={14} color={t.text} />
              </View>
            )}
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <T.H2 style={{ fontSize: 20 }}>{displayName}</T.H2>
            <T.Sub style={{ marginTop: 4 }}>@{username}</T.Sub>
          </View>
        </View>

        <VStack gap={SPACING.cardGap}>
          <SettingsCard items={settingsItems} />
          <SettingsCard items={appInfoItems} />
        </VStack>

        {/* Sign out — visible at bottom of account tab, no need to dig into Security */}
        {!!user && (
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={signingOut}
            activeOpacity={0.75}
            style={{
              paddingVertical: 14,
              alignItems: "center",
              borderRadius: t.radius,
              borderWidth: 1,
              borderColor: t.hairline,
              backgroundColor: t.surface,
              opacity: signingOut ? 0.5 : 1,
            }}
          >
            <T.Sub style={{ color: "#FF3B30", fontWeight: "800" }}>
              {signingOut ? "Signing out…" : "Sign out"}
            </T.Sub>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}