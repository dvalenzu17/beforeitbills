import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../lib/theme";
import { useStore } from "../../lib/store";
import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import NavHeader from "../../components/NavHeader";

export default function PersonalInfo() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();
  const { user, profile, updateProfile } = useStore();

  const [name, setName] = useState(profile?.name || user?.user_metadata?.name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [pendingEmail, setPendingEmail] = useState(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    setName(profile?.name || user?.user_metadata?.name || "");
    setUsername(profile?.username || "");
    setEmail(user?.email || "");
  }, [profile?.name, profile?.username, user?.email, user?.user_metadata?.name]);

  async function save() {
    const cleanName = name.trim();
    const cleanUsername = username.trim().replace(/\s+/g, "").toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername) return Alert.alert(tt("personal.usernameTitle"), tt("personal.usernameEmpty"));
    if (cleanUsername.length < 3) return Alert.alert(tt("personal.usernameTitle"), tt("personal.usernameTooShort"));
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) return Alert.alert(tt("personal.usernameTitle"), tt("personal.usernameInvalidChars"));

    setSaving(true);
    try {
      const isUnchanged = cleanUsername === (profile?.username || "").toLowerCase();
      if (!isUnchanged && user && SUPABASE_CONFIGURED && supabase) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", cleanUsername)
          .neq("id", user.id)
          .maybeSingle();

        if (existing) {
          Alert.alert(tt("personal.usernameTakenTitle"), tt("personal.usernameTakenBody", { username: cleanUsername }));
          setSaving(false);
          return;
        }
      }

      await updateProfile({ name: cleanName || null, username: cleanUsername });

      if (!user || !SUPABASE_CONFIGURED || !supabase) {
        Alert.alert(tt("personal.savedLocalTitle"), tt("personal.savedLocalBody"));
        return;
      }

      if (cleanEmail && cleanEmail !== (user.email || "").toLowerCase()) {
        const { error } = await supabase.auth.updateUser({ email: cleanEmail });
        if (error) throw error;
        setPendingEmail(cleanEmail);
      }

      try {
        await supabase.from("profiles").upsert({
          id: user.id,
          email: cleanEmail || user.email || null,
          display_name: cleanName || null,
          username: cleanUsername,
          avatar_url: profile?.avatarUri || null,
        });
      } catch (e) {
        if (__DEV__) console.warn("[personal] profile upsert failed:", e?.message);
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(tt("personal.savedTitle"), tt("personal.savedBody"));
    } catch (e) {
      if (__DEV__) console.warn("[personal] save failed:", e?.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(tt("personal.saveFailedTitle"), tt("personal.saveFailedBody"));
    } finally {
      setSaving(false);
    }
  }

  async function resendConfirmation() {
    if (!pendingEmail) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "email_change", email: pendingEmail });
      if (error) throw error;
      Alert.alert(tt("personal.resendSentTitle"), tt("personal.resendSentBody"));
    } catch (e) {
      if (__DEV__) console.warn("[personal] resend failed:", e?.message);
      Alert.alert(tt("personal.resendFailedTitle"), tt("personal.resendFailedBody"));
    } finally {
      setResending(false);
    }
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: t.hairline || t.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    color: t.text,
    backgroundColor: t.surface,
    fontSize: 15,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <NavHeader
        title={tt("personal.title")}
        onBack={() => {
          if (r.canGoBack()) r.back();
          else r.replace("/(tabs)/account");
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 50, gap: 16 }}>
        <View>
          <Text style={{ color: t.text, fontSize: 28, fontWeight: "800" }}>
            {tt("personal.title")}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 20, fontSize: 14 }}>
            {tt("personal.subtitle")}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: t.surface,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: t.hairline || t.border,
            padding: 16,
            shadowColor: "#000",
            shadowOpacity: 0.05,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: t.subtext, fontWeight: "700", marginBottom: 6 }}>
              {tt("personal.nameLabel")}
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={tt("personal.namePlaceholder")}
              placeholderTextColor={t.subtext}
              style={inputStyle}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: t.subtext, fontWeight: "700", marginBottom: 6 }}>
              {tt("personal.usernameLabel")}
            </Text>
            <TextInput
              value={username}
              onChangeText={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              autoCapitalize="none"
              placeholder="username1949"
              placeholderTextColor={t.subtext}
              style={inputStyle}
            />
            <Text style={{ color: t.tertiary, fontSize: 12, marginTop: 6 }}>
              {tt("personal.usernameHint")}
            </Text>
          </View>

          <View>
            <Text style={{ color: t.subtext, fontWeight: "700", marginBottom: 6 }}>
              {tt("personal.emailLabel")}
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@email.com"
              placeholderTextColor={t.subtext}
              style={[inputStyle, !user ? { opacity: 0.6 } : null]}
              editable={!!user}
            />
            {!user ? (
              <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6 }}>
                {tt("personal.signInHint")}
              </Text>
            ) : (
              <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6 }}>
                {tt("personal.emailHint")}
              </Text>
            )}

            {pendingEmail ? (
              <View
                style={{
                  marginTop: 10,
                  padding: 12,
                  backgroundColor: "rgba(124,92,255,0.10)",
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(124,92,255,0.25)",
                }}
              >
                <Text style={{ color: t.text, fontWeight: "700", fontSize: 13 }}>
                  {tt("personal.pendingTitle")}
                </Text>
                <Text style={{ color: t.subtext, fontSize: 12, marginTop: 4 }}>
                  {tt("personal.pendingBody", { email: pendingEmail })}
                </Text>
                <TouchableOpacity
                  onPress={resendConfirmation}
                  disabled={resending}
                  style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  {resending ? (
                    <ActivityIndicator size="small" color={t.accent} />
                  ) : null}
                  <Text style={{ color: t.accent, fontWeight: "700", fontSize: 13 }}>
                    {resending ? tt("personal.resending") : tt("personal.resendLink")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>

        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={{
            backgroundColor: t.accent,
            paddingVertical: 16,
            borderRadius: 18,
            alignItems: "center",
            marginTop: 6,
            opacity: saving ? 0.6 : 1,
            shadowColor: "#000",
            shadowOpacity: 0.1,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
            {saving ? tt("personal.saving") : tt("personal.saveBtn")}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
