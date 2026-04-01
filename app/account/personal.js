import React, { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../lib/theme";
import { useStore } from "../../lib/store";
import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { useRouter } from "expo-router";
import NavHeader from "../../components/NavHeader";

export default function PersonalInfo() {
  const t = useTheme();
  const r = useRouter();
  const { user, profile, updateProfile } = useStore();

  const [name, setName] = useState(profile?.name || user?.user_metadata?.name || "");
  const [username, setUsername] = useState(profile?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile?.name || user?.user_metadata?.name || "");
    setUsername(profile?.username || "");
    setEmail(user?.email || "");
  }, [profile?.name, profile?.username, user?.email, user?.user_metadata?.name]);

  async function save() {
    const cleanName = name.trim();
    const cleanUsername = username.trim().replace(/\s+/g, "").toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername) return Alert.alert("Username", "Username cannot be empty.");
    if (cleanUsername.length < 3) return Alert.alert("Username", "Must be at least 3 characters.");
    if (!/^[a-z0-9_]+$/.test(cleanUsername)) return Alert.alert("Username", "Only letters, numbers, and underscores.");

    setSaving(true);
    try {
      // Check uniqueness against Supabase profiles table (skip if unchanged)
      const isUnchanged = cleanUsername === (profile?.username || "").toLowerCase();
      if (!isUnchanged && user && SUPABASE_CONFIGURED && supabase) {
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", cleanUsername)
          .neq("id", user.id)
          .maybeSingle();

        if (existing) {
          Alert.alert("Username taken", `@${cleanUsername} is already in use. Try another.`);
          setSaving(false);
          return;
        }
      }

      await updateProfile({ name: cleanName || null, username: cleanUsername });

      if (!user || !SUPABASE_CONFIGURED || !supabase) {
        Alert.alert("Saved", "Saved on this device. Sign in to sync and update email.");
        return;
      }

      if (cleanEmail && cleanEmail !== (user.email || "").toLowerCase()) {
        const { error } = await supabase.auth.updateUser({ email: cleanEmail });
        if (error) throw error;
        Alert.alert("Email update started", "Check your inbox to confirm your new email.");
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

      Alert.alert("Saved", "Personal info updated.");
    } catch (e) {
      Alert.alert("Save failed", e?.message || String(e));
    } finally {
      setSaving(false);
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
        title="Personal information"
        onBack={() => {
          if (r.canGoBack()) r.back();
          else r.replace("/(tabs)/account");
        }}
      />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 50, gap: 16 }}>
        <View>
          <Text style={{ color: t.text, fontSize: 28, fontWeight: "800" }}>
            Personal information
          </Text>

          <Text
            style={{
              color: t.subtext,
              marginTop: 6,
              lineHeight: 20,
              fontSize: 14,
            }}
          >
            Name and username save locally. Email changes require sign-in.
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
              Name
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={t.subtext}
              style={inputStyle}
            />
          </View>

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: t.subtext, fontWeight: "700", marginBottom: 6 }}>
              Username
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
              Letters, numbers, underscores only. Must be unique.
            </Text>
          </View>

          <View>
            <Text style={{ color: t.subtext, fontWeight: "700", marginBottom: 6 }}>
              Email
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@email.com"
              placeholderTextColor={t.subtext}
              style={[
                inputStyle,
                !user ? { opacity: 0.6 } : null
              ]}
              editable={!!user}
            />

            {!user ? (
              <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6 }}>
                Sign in to change email.
              </Text>
            ) : (
              <Text style={{ color: t.subtext, fontSize: 12, marginTop: 6 }}>
                Heads up: you may need to confirm email changes.
              </Text>
            )}
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
          <Text
            style={{
              color: "#fff",
              fontWeight: "800",
              fontSize: 16,
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}