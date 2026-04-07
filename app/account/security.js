import React, { useMemo, useState } from "react";
import { Alert, View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import NavHeader from "../../components/NavHeader";

import { supabase, SUPABASE_CONFIGURED } from "../../lib/supabase";
import { BACKEND_URL } from "../../lib/secrets";
import { useStore } from "../../lib/store";
import { useTheme } from "../../lib/theme";
import { useAuthState } from "../../lib/authState";
import { useEmailImportStore } from "../../lib/emailImportStore";
import { SPACING } from "../../lib/ui/tokens";

function Section({ t, title, children }) {
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: t.hairline,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <Text style={{ color: t.subtext, fontWeight: "700", marginBottom: 14 }}>{title}</Text>
      {children}
    </View>
  );
}

export default function Security() {
  const t = useTheme();
  const r = useRouter();

  const { user } = useStore();
  const syncMeta = useStore((s) => s.syncMeta);
  const syncNow = useStore((s) => s.syncNow);
  const resetUserData = useStore((s) => s.resetUserData);
  const resetEmailStore = useEmailImportStore((s) => s.reset);
  const clearBypass = useAuthState((s) => s.clearBypass);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const email = useMemo(() => user?.email || "", [user]);
  const cloudEnabled = !!SUPABASE_CONFIGURED && !!supabase;

  const lastSyncedLabel = useMemo(() => {
    const v = syncMeta?.lastSyncedAt;
    if (!v) return "Not yet";
    try { return new Date(v).toLocaleString(); } catch { return String(v); }
  }, [syncMeta?.lastSyncedAt]);

  async function doSyncNow() {
    if (!email) return Alert.alert("Sign in required", "Sync works when you're signed in.");
    try {
      setLoading(true);
      const res = await syncNow({ source: "manual" });
      if (res?.ok) Alert.alert("Synced", "Your subscriptions are up to date.");
      else Alert.alert("Sync failed", res?.error || "Try again.");
    } catch (e) {
      Alert.alert("Sync failed", e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    if (!cloudEnabled) return Alert.alert("Unavailable", "Password reset isn't available in this build.");
    if (!email) return Alert.alert("No account", "You're not signed in.");
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "beforeitbills://auth/update-password",
      });
      if (error) throw error;
      Alert.alert("Reset email sent", "Check your inbox and tap the link — it will open the app to set your new password.");
    } catch (e) {
      Alert.alert("Reset failed", e?.message || "Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    if (!cloudEnabled) return Alert.alert("Unavailable", "No account session in this build.");
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      await resetUserData();
      await resetEmailStore?.();
      await clearBypass();
      // _layout.js gate handles redirect on SIGNED_OUT event
    } catch (e) {
      Alert.alert("Sign out failed", e?.message || "Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount() {
    Alert.alert(
      "Delete account",
      "This permanently deletes your account and all your data — subscriptions, bills, inbox connection, and profile. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete my account",
          style: "destructive",
          onPress: () => confirmDelete(),
        },
      ]
    );
  }

  async function confirmDelete() {
    // Second confirmation — type nothing, just a second press to prevent fat-finger
    Alert.alert(
      "Are you absolutely sure?",
      `Your account (${email}) and all associated data will be permanently deleted immediately.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, delete everything",
          style: "destructive",
          onPress: () => executeDelete(),
        },
      ]
    );
  }

  async function executeDelete() {
    if (!cloudEnabled || !user) {
      Alert.alert("Not signed in", "Sign in first to delete your account.");
      return;
    }

    setDeleting(true);
    try {
      // Get the current session token to authenticate the delete request
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;

      if (!accessToken) throw new Error("No active session — sign in and try again.");

      // Call backend delete-account endpoint (uses service role to delete auth user)
      if (BACKEND_URL) {
        const res = await fetch(`${BACKEND_URL}/account/delete`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json?.error || `Delete failed: HTTP ${res.status}`);
        }
      } else {
        // No backend — delete from client side using admin API isn't possible
        // Best we can do is sign out and inform the user
        throw new Error("Backend not configured. Email privacy@beforeitbills.com to delete your account.");
      }

      // Clear all local data regardless of backend response
      await resetUserData();
      await resetEmailStore?.();
      await clearBypass();

      // Sign out — the _layout gate will redirect to sign-in
      try { await supabase.auth.signOut(); } catch (e) {
        if (__DEV__) console.warn("[security] signOut after delete failed:", e?.message);
      }

      Alert.alert(
        "Account deleted",
        "Your account and all data have been permanently deleted.",
        [{ text: "OK" }]
      );
    } catch (e) {
      Alert.alert("Delete failed", e?.message || "Please email privacy@beforeitbills.com to delete your account.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <NavHeader
        title="Login & Security"
        subtitle="Sessions, access, and account control"
        onBack={() => r.canGoBack() ? r.back() : r.replace("/(tabs)/account")}
      />

      <ScrollView contentContainerStyle={{ padding: SPACING.screen, paddingBottom: 40 }}>

        {/* ACCOUNT STATUS */}
        <Section t={t} title="Account">
          <Text style={{ color: t.text, fontSize: 16, fontWeight: "800" }}>
            {email || "Not signed in"}
          </Text>
          {!!email && (
            <Text style={{ color: t.subtext, marginTop: 4, marginBottom: 14 }}>
              Signed in
            </Text>
          )}

          <View style={{ gap: 10 }}>
            {!email && (
              <Button
                title="Sign in"
                onPress={() => { clearBypass(); r.push("/(auth)/sign-in"); }}
                left={<Feather name="log-in" size={16} color="#fff" />}
              />
            )}

            <Button
              title="Send password reset email"
              variant="secondary"
              disabled={loading || !email || !cloudEnabled}
              onPress={resetPassword}
              left={<Feather name="mail" size={16} color={t.text} />}
            />

            <Button
              title={loading ? "Signing out…" : "Sign out"}
              variant="secondary"
              disabled={loading || !cloudEnabled || !email}
              onPress={signOut}
              left={<Feather name="log-out" size={16} color={t.text} />}
            />
          </View>
        </Section>

        {/* SYNC */}
        <Section t={t} title="Sync">
          <Text style={{ color: t.subtext }}>
            Last synced:{" "}
            <Text style={{ color: t.text, fontWeight: "700" }}>{lastSyncedLabel}</Text>
          </Text>

          {syncMeta?.lastSyncOk === false && syncMeta?.lastSyncError && (
            <Text style={{ color: "#FF3B30", marginTop: 6, fontSize: 13 }}>
              Last issue: {String(syncMeta.lastSyncError)}
            </Text>
          )}

          <View style={{ marginTop: 14 }}>
            <Button
              title={loading ? "Syncing…" : "Sync now"}
              onPress={doSyncNow}
              disabled={loading || !email}
              left={<Feather name="refresh-ccw" size={16} color="#fff" />}
            />
          </View>
        </Section>

        {/* DANGER ZONE */}
        <Section t={t} title="Danger zone">
          <Text style={{ color: t.subtext, lineHeight: 20, marginBottom: 14 }}>
            Permanently delete your account and all associated data. This cannot be undone.
          </Text>

          {deleting ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
              <ActivityIndicator color="#FF3B30" />
              <Text style={{ color: t.subtext, fontWeight: "700" }}>Deleting account…</Text>
            </View>
          ) : (
            <Button
              title="Delete account"
              variant="danger"
              disabled={!email || deleting}
              onPress={deleteAccount}
              left={<Feather name="trash-2" size={16} color="#fff" />}
            />
          )}
        </Section>

      </ScrollView>
    </SafeAreaView>
  );
}