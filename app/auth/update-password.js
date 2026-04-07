// app/auth/update-password.js
import React, { useMemo, useState } from "react";
import { Alert, Keyboard, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import Screen from "../../components/Screen";
import Glass from "../../components/Glass";
import Button from "../../components/Button";
import NavHeader from "../../components/NavHeader";

import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";

export default function UpdatePassword() {
  const t = useTheme();
  const r = useRouter();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const cloudEnabled = useMemo(() => SUPABASE_CONFIGURED && !!supabase, []);

  async function save() {
    Keyboard.dismiss();

    if (!cloudEnabled) return Alert.alert("Unavailable", "Sign-in isn’t available in this build.");
    if (pw1.length < 6) return Alert.alert("Password", "Use at least 6 characters.");
    if (pw1 !== pw2) return Alert.alert("Password", "Passwords don’t match.");

    try {
      setBusy(true);

      const { error } = await supabase.auth.updateUser({ password: pw1 });
      if (error) throw error;

      Alert.alert("Password updated", "You’re all set.", [
        { text: "Continue", onPress: () => r.replace("/(tabs)") },
      ]);
    } catch (e) {
      Alert.alert("Update failed", "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <NavHeader title="Set a new password" subtitle="This only takes a second" />

      <Glass>
        <Text style={{ color: t.subtext, fontWeight: "900" }}>New password</Text>
        <TextInput
          value={pw1}
          onChangeText={setPw1}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={t.tertiary}
          style={{
            marginTop: 8,
            backgroundColor: t.soft,
            borderColor: t.border,
            borderWidth: 1,
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 12,
            color: t.text,
            fontSize: 16,
          }}
        />

        <Text style={{ color: t.subtext, fontWeight: "900", marginTop: 14 }}>Confirm password</Text>
        <TextInput
          value={pw2}
          onChangeText={setPw2}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={t.tertiary}
          style={{
            marginTop: 8,
            backgroundColor: t.soft,
            borderColor: t.border,
            borderWidth: 1,
            borderRadius: 16,
            paddingVertical: 12,
            paddingHorizontal: 12,
            color: t.text,
            fontSize: 16,
          }}
        />

        <View style={{ height: 14 }} />

        <Button
          title={busy ? "Saving…" : "Save password"}
          onPress={save}
          disabled={busy}
          left={<Feather name="check" size={16} color="#fff" />}
        />

        <Pressable
          onPress={() => r.replace("/(auth)/sign-in")}
          style={({ pressed }) => ({
            paddingVertical: 12,
            alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: t.subtext, fontWeight: "800" }}>Back to sign in</Text>
        </Pressable>
      </Glass>
    </Screen>
  );
}