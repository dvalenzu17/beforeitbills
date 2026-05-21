// app/(tabs)/account.js
import React, { useState } from "react";
import { ActivityIndicator, ScrollView, View, Text, TouchableOpacity, Image, Alert, Linking, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import { useStore } from "../../lib/store";
import GradientButton from "../../components/GradientButton";
import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { useAuthState } from "../../lib/authState";

import profilePic from "../../assets/profile.jpg";

// ── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ children, style }) {
  const t = useTheme();
  return (
    <Text style={[{
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      color: t.subtext,
      textTransform: 'uppercase',
      marginBottom: 8,
      paddingHorizontal: 4,
    }, style]}>
      {children}
    </Text>
  );
}

// ── Settings row ─────────────────────────────────────────────────────────────
function SettingsRow({ icon, label, subtext, onPress, last, danger }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: pressed ? t.surface2 : 'transparent',
        borderTopWidth: last ? 0 : 0,
        gap: 14,
      })}
    >
      <View style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: danger ? 'rgba(239,68,68,0.1)' : t.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Feather name={icon} size={18} color={danger ? '#EF4444' : t.subtext} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: danger ? '#EF4444' : t.text }}>
          {label}
        </Text>
        {subtext ? (
          <Text style={{ fontSize: 12, color: t.subtext, marginTop: 2 }}>{subtext}</Text>
        ) : null}
      </View>
      {!danger && (
        <Feather name="chevron-right" size={16} color={t.tertiary || t.subtext} />
      )}
    </Pressable>
  );
}

// ── Settings card ────────────────────────────────────────────────────────────
function SettingsCard({ items }) {
  const t = useTheme();
  return (
    <View style={{
      backgroundColor: t.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.hairline,
      overflow: 'hidden',
    }}>
      {items.map((item, idx) => (
        <View key={item.label}>
          {idx > 0 && (
            <View style={{ height: 1, backgroundColor: t.hairline, marginLeft: 66 }} />
          )}
          <SettingsRow
            icon={item.icon}
            label={item.label}
            subtext={item.subtext}
            onPress={item.onPress || (item.route ? () => {} : undefined)}
            danger={item.danger}
          />
        </View>
      ))}
    </View>
  );
}

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

      await updateProfile({ avatarUri: localUri });

      if (SUPABASE_CONFIGURED && supabase && user) {
        setUploadingAvatar(true);
        try {
          const ext = localUri.split(".").pop()?.toLowerCase().replace(/[^a-z]/g, "") || "jpg";
          const path = `avatars/${user.id}.${ext}`;
          const fetchRes = await fetch(localUri);
          const blob = await fetchRes.blob();
          const { error: uploadErr } = await supabase.storage
            .from("avatars")
            .upload(path, blob, { contentType: `image/${ext === "jpg" ? "jpeg" : ext}`, upsert: true });

          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
            if (urlData?.publicUrl) await updateProfile({ avatarUri: urlData.publicUrl });
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

  const manageItems = [
    {
      label: tt("account.items.upgrade.label"),
      subtext: isPro ? tt("account.items.upgrade.subtextPro") : tt("account.items.upgrade.subtextFree"),
      icon: "award",
      route: "/account/upgrade",
      onPress: () => router.push("/account/upgrade"),
    },
    {
      label: tt("account.items.connected.label"),
      subtext: tt("account.items.connected.subtext"),
      icon: "link",
      onPress: () => router.push("/account/connect-email"),
    },
    {
      label: tt("account.items.security.label"),
      subtext: tt("account.items.security.subtext"),
      icon: "lock",
      onPress: () => router.push("/account/security"),
    },
    {
      label: tt("account.items.notifications.label"),
      subtext: tt("account.items.notifications.subtext"),
      icon: "bell",
      onPress: () => router.push("/account/notifications"),
    },
  ];

  const moreItems = [
    {
      label: tt("account.items.settings.label") || "Settings",
      subtext: tt("account.items.settings.subtext") || "Language, notifications, data",
      icon: "settings",
      onPress: () => router.push("/account/settings"),
    },
    isPro
      ? { label: "Priority support", subtext: "Direct line to our team", icon: "message-square", onPress: () => Linking.openURL("mailto:support@beforeitbills.com") }
      : { label: "Priority support", subtext: "Available on Pro", icon: "message-square", onPress: () => router.push("/account/upgrade") },
    {
      label: tt("account.items.help.label"),
      subtext: tt("account.items.help.subtext"),
      icon: "help-circle",
      onPress: () => router.push("/account/help"),
    },
    {
      label: tt("account.items.legals.label"),
      subtext: tt("account.items.legals.subtext"),
      icon: "file-text",
      onPress: () => router.push("/account/legals"),
    },
    {
      label: tt("account.items.about.label"),
      subtext: tt("account.items.about.subtext"),
      icon: "info",
      onPress: () => router.push("/account/about"),
    },
    ...(__DEV__ ? [{
      label: "Developer Tools",
      subtext: "Internal testing tools",
      icon: "code",
      onPress: () => router.push("/dev-tools"),
    }] : []),
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: t.text, letterSpacing: -0.5 }}>
            {tt("tabs.account")}
          </Text>
          <View style={{
            paddingHorizontal: 12,
            paddingVertical: 5,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: isPro ? t.accent : t.hairline,
            backgroundColor: isPro ? `${t.accent}18` : t.surface,
          }}>
            <Text style={{
              fontSize: 11,
              fontWeight: '800',
              color: isPro ? t.accent : t.subtext,
              letterSpacing: 0.8,
            }}>
              {isPro ? 'PRO' : tt("account.freePill")}
            </Text>
          </View>
        </View>

        {/* Profile card */}
        <View style={{
          backgroundColor: t.surface,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: t.hairline,
          padding: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
        }}>
          <TouchableOpacity onPress={avatarMenu} activeOpacity={0.85} disabled={uploadingAvatar}>
            <Image
              source={profile?.avatarUri ? { uri: profile.avatarUri } : profilePic}
              style={{ width: 72, height: 72, borderRadius: 36, opacity: uploadingAvatar ? 0.5 : 1 }}
            />
            {uploadingAvatar ? (
              <View style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                borderRadius: 36, alignItems: 'center', justifyContent: 'center',
              }}>
                <ActivityIndicator size="small" color={t.accent} />
              </View>
            ) : (
              <View style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 24, height: 24, borderRadius: 12,
                backgroundColor: t.surface2,
                borderWidth: 1.5, borderColor: t.bg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Feather name="edit-2" size={11} color={t.text} />
              </View>
            )}
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: t.text }}>{displayName}</Text>
            <Text style={{ fontSize: 13, color: t.subtext, marginTop: 3 }}>@{username}</Text>
          </View>

          <Pressable
            onPress={() => router.push("/account/personal")}
            style={({ pressed }) => ({
              width: 36, height: 36, borderRadius: 18,
              backgroundColor: pressed ? t.surface2 : t.bg,
              borderWidth: 1, borderColor: t.hairline,
              alignItems: 'center', justifyContent: 'center',
            })}
          >
            <Feather name="edit-2" size={15} color={t.subtext} />
          </Pressable>
        </View>

        {/* Upgrade banner (free users only) */}
        {!isPro && (
          <View style={{
            backgroundColor: t.surface,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: t.hairline,
            padding: 18,
            marginBottom: 24,
          }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: t.text, marginBottom: 6 }}>
              {tt("account.goProTitle")}
            </Text>
            <Text style={{ fontSize: 13, color: t.subtext, marginBottom: 16, lineHeight: 18 }}>
              {tt("account.goProBody")}
            </Text>
            <GradientButton title={tt("account.upgrade")} onPress={() => router.push("/account/upgrade")} />
          </View>
        )}

        {/* Manage section */}
        <SectionLabel style={{ marginBottom: 8 }}>Manage</SectionLabel>
        <View style={{
          backgroundColor: t.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.hairline,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          {manageItems.map((item, idx) => (
            <View key={item.label}>
              {idx > 0 && <View style={{ height: 1, backgroundColor: t.hairline, marginLeft: 66 }} />}
              <SettingsRow
                icon={item.icon}
                label={item.label}
                subtext={item.subtext}
                onPress={item.onPress}
              />
            </View>
          ))}
        </View>

        {/* More section */}
        <SectionLabel style={{ marginBottom: 8 }}>More</SectionLabel>
        <View style={{
          backgroundColor: t.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.hairline,
          overflow: 'hidden',
          marginBottom: 24,
        }}>
          {moreItems.map((item, idx) => (
            <View key={item.label}>
              {idx > 0 && <View style={{ height: 1, backgroundColor: t.hairline, marginLeft: 66 }} />}
              <SettingsRow
                icon={item.icon}
                label={item.label}
                subtext={item.subtext}
                onPress={item.onPress}
              />
            </View>
          ))}
        </View>

        {/* Sign out */}
        {!!user && (
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            style={({ pressed }) => ({
              backgroundColor: pressed ? 'rgba(239,68,68,0.08)' : t.surface,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(239,68,68,0.25)',
              overflow: 'hidden',
              opacity: signingOut ? 0.5 : 1,
            })}
          >
            <SettingsRow
              icon="log-out"
              label={signingOut ? "Signing out…" : "Sign out"}
              onPress={handleSignOut}
              danger
            />
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
