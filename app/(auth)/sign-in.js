import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../lib/store";
import { useAuthState } from "../../lib/authState";
import { useTheme } from "../../lib/theme";
import { track, identify } from "../../lib/analytics";
import { TERMS_URL, PRIVACY_URL } from "../../lib/config";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Generate a random nonce and its SHA-256 hash for Apple Sign In
async function generateNonce() {
  const raw = Array.from(Crypto.getRandomBytes(32))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw
  );
  return { raw, hashed };
}

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const s = useMemo(() => makeStyles(theme), [theme]);

  const { t: tt } = useTranslation();
  const setUser = useStore((st) => st.setUser);
  const setAuthReady = useAuthState((st) => st.setReady);

  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const cleanEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  const canSubmit = useMemo(() => {
    if (!EMAIL_REGEX.test(cleanEmail)) return false;
    if (password.length < 6) return false;
    if (mode === "signup" && !termsAccepted) return false;
    return true;
  }, [cleanEmail, password, mode, termsAccepted]);

  const toggleShowPw = useCallback(() => setShowPw((p) => !p), []);

  const switchMode = useCallback((next) => {
    setMode(next);
    setPassword("");
    setShowPw(false);
  }, []);

  function onAuthSuccess(u, method) {
    setUser(u);
    setAuthReady(true);
    if (u) {
      track("signed_in", { method });
      identify(u.id, { email: u.email });
    }
    // gate in _layout.js reacts and navigates
  }

  async function handlePrimary() {
    Keyboard.dismiss();
    if (!canSubmit || loading) return;

    setLoading(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        onAuthSuccess(data?.session?.user ?? null, "email");
        return;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
        });
        if (error) throw error;
        onAuthSuccess(data?.session?.user ?? data?.user ?? null, "email_signup");
        return;
      }
    } catch (e) {
      if (__DEV__) console.warn("[sign-in] auth error:", e?.message);
      if (mode === "signin") {
        Alert.alert(tt("auth.signInFailed"), tt("auth.signInFailedBody"));
      } else {
        const isDbError =
          typeof e?.message === "string" &&
          (e.message.toLowerCase().includes("database error") ||
            e.message.toLowerCase().includes("saving new user"));
        Alert.alert(
          isDbError ? tt("auth.accountSetupError") : tt("auth.signUpFailed"),
          isDbError ? tt("auth.accountSetupErrorBody") : tt("auth.signUpFailedBody")
        );
      }
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    Keyboard.dismiss();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      Alert.alert(tt("auth.enterEmailFirst"));
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw error;
      Alert.alert(tt("auth.resetSent"), tt("auth.resetSentBody"));
    } catch (e) {
      if (__DEV__) console.warn("[sign-in] resetPassword error:", e?.message);
      Alert.alert(tt("auth.resetFailed"), tt("auth.resetFailedBody"));
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (appleLoading || loading) return;
    setAppleLoading(true);
    try {
      const { raw, hashed } = await generateNonce();

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashed,
      });

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce: raw,
      });

      if (error) throw error;

      // Apple only returns name on first sign-in — persist if available
      const u = data?.session?.user ?? data?.user ?? null;
      if (u && credential.fullName?.givenName) {
        const displayName = [
          credential.fullName.givenName,
          credential.fullName.familyName,
        ]
          .filter(Boolean)
          .join(" ");
        supabase
          .from("profiles")
          .upsert({ id: u.id, display_name: displayName }, { onConflict: "id" })
          .catch(() => {});
      }

      onAuthSuccess(u, "apple");
    } catch (e) {
      // ERR_CANCELED = user dismissed the sheet — not an error
      if (e?.code === "ERR_REQUEST_CANCELED") return;
      if (__DEV__) console.warn("[sign-in] Apple sign-in error:", e?.message);
      Alert.alert(tt("auth.signInFailed"), tt("auth.appleSignInFailedBody"));
    } finally {
      setAppleLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={s.kb}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={s.container}>

            {/* Header blobs */}
            <View style={s.hero}>
              <View style={s.heroBlobA} />
              <View style={s.heroBlobB} />
              <View style={s.heroBlobC} />
            </View>

            {/* Mode toggle */}
            <View style={s.modeRow}>
              <ModePill label="Sign In" active={mode === "signin"} onPress={() => switchMode("signin")} disabled={loading || appleLoading} s={s} />
              <ModePill label="Sign Up" active={mode === "signup"} onPress={() => switchMode("signup")} disabled={loading || appleLoading} s={s} />
            </View>

            <View style={s.card}>
              <Text style={s.h1}>{mode === "signin" ? "Welcome back" : "Create account"}</Text>
              <Text style={s.sub}>
                {mode === "signin" ? "Sign in to continue." : "Start tracking in seconds."}
              </Text>

              <View style={s.gap14} />

              <Text style={s.label}>Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@email.com"
                placeholderTextColor={theme.tertiary}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={s.input}
                editable={!loading && !appleLoading}
                returnKeyType="next"
              />

              <View style={s.gap10} />

              <Text style={s.label}>Password</Text>
              <View style={s.passwordWrapper}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={theme.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showPw}
                  style={[s.input, s.passwordInput]}
                  editable={!loading && !appleLoading}
                  returnKeyType="done"
                  onSubmitEditing={handlePrimary}
                />
                <Pressable onPress={toggleShowPw} style={s.eyeButton} hitSlop={8}>
                  <Feather name={showPw ? "eye" : "eye-off"} size={18} color={theme.tertiary} />
                </Pressable>
              </View>

              <View style={s.gap18} />

              <View style={s.footerRow}>
                {mode === "signin" ? (
                  <Pressable onPress={handleForgotPassword} style={({ pressed }) => [pressed && s.pressed]}>
                    <Text style={s.linkText}>Forgot password?</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => setTermsAccepted((v) => !v)}
                    style={{ flexDirection: "row", alignItems: "flex-start", gap: 10, flex: 1, marginRight: 12 }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: termsAccepted }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 6,
                        borderWidth: 2,
                        borderColor: termsAccepted ? theme.accent : theme.hairline,
                        backgroundColor: termsAccepted ? theme.accent : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      {termsAccepted ? (
                        <Feather name="check" size={13} color="#fff" />
                      ) : null}
                    </View>
                    <Text style={{ color: theme.subtext, fontSize: 12, fontWeight: "600", lineHeight: 18, flex: 1 }}>
                      {"I agree to the "}
                      <Text
                        onPress={(e) => { e.stopPropagation(); TERMS_URL && Linking.openURL(TERMS_URL); }}
                        style={{ color: theme.accent, fontWeight: "700", textDecorationLine: "underline" }}
                      >
                        Terms of Service
                      </Text>
                      {" and "}
                      <Text
                        onPress={(e) => { e.stopPropagation(); PRIVACY_URL && Linking.openURL(PRIVACY_URL); }}
                        style={{ color: theme.accent, fontWeight: "700", textDecorationLine: "underline" }}
                      >
                        Privacy Policy
                      </Text>
                    </Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={handlePrimary}
                  disabled={!canSubmit || loading || appleLoading}
                  style={({ pressed }) => [
                    s.fab,
                    (!canSubmit || loading || appleLoading) && s.fabDisabled,
                    pressed && canSubmit && !loading && s.fabPressed,
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Feather name="arrow-right" size={20} color="#fff" />
                  )}
                </Pressable>
              </View>
            </View>

            {/* Apple Sign In — iOS only, App Store requirement */}
            {Platform.OS === "ios" && (
              <View style={s.socialRow}>
                <View style={s.dividerRow}>
                  <View style={s.dividerLine} />
                  <Text style={s.dividerText}>or</Text>
                  <View style={s.dividerLine} />
                </View>
                {appleLoading ? (
                  <View style={s.appleLoading}>
                    <ActivityIndicator color={theme.text} />
                  </View>
                ) : (
                  <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={
                      theme.bg === "#0B0F17" || theme.bg2 === "#070A10"
                        ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                        : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                    }
                    cornerRadius={14}
                    style={s.appleButton}
                    onPress={handleAppleSignIn}
                  />
                )}
              </View>
            )}

          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

function ModePill({ label, active, onPress, disabled, s }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.modePill,
        active && s.modePillActive,
        pressed && !active && s.modePillPressed,
      ]}
    >
      <Text style={[s.modeText, active && s.modeTextActive]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(t) {
  const isDark = t.bg === "#0B0F17" || t.bg2 === "#070A10";

  const inputBg = isDark ? "#070A10" : "#F0F4FF";
  const cardBg  = isDark ? "#161B24" : "#FFFFFF";
  const safeBg  = isDark ? "#070A10" : "#F5F7FF";

  const pillActiveBg   = t.accent;
  const pillActiveText = "#FFFFFF";

  const fabBg = t.accent;

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: safeBg },
    kb: { flex: 1 },
    container: { flex: 1, paddingHorizontal: 18, paddingTop: 16 },

    hero: { height: 130, marginBottom: 10, overflow: "hidden", borderRadius: 24 },
    heroBlobA: {
      position: "absolute", top: -90, left: -60,
      width: 220, height: 220, borderRadius: 999,
      backgroundColor: t.grad2 || "#7C3AED", opacity: isDark ? 0.28 : 0.18,
    },
    heroBlobB: {
      position: "absolute", top: -70, right: -90,
      width: 260, height: 260, borderRadius: 999,
      backgroundColor: t.accent, opacity: isDark ? 0.18 : 0.12,
    },
    heroBlobC: {
      position: "absolute", bottom: -120, left: 40,
      width: 300, height: 300, borderRadius: 999,
      backgroundColor: safeBg, opacity: 0.9,
    },

    modeRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
    modePill: {
      flex: 1, borderRadius: 999, paddingVertical: 11,
      alignItems: "center",
      backgroundColor: isDark ? "#1C2230" : "#E8EDFF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    },
    modePillActive: { backgroundColor: pillActiveBg, borderColor: pillActiveBg },
    modePillPressed: { opacity: 0.65 },
    modeText: { color: t.subtext, fontWeight: "700", fontSize: 15 },
    modeTextActive: { color: pillActiveText },

    card: {
      backgroundColor: cardBg,
      borderRadius: 22, padding: 18,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 12,
      elevation: 2,
    },

    h1: { color: t.text, fontSize: 26, fontWeight: "900" },
    sub: { color: t.subtext, marginTop: 6, fontWeight: "600" },

    label: { color: t.text, fontSize: 12, fontWeight: "700", marginBottom: 8 },

    input: {
      backgroundColor: inputBg,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 13,
      color: t.text,
      fontWeight: "600",
      fontSize: 15,
    },

    passwordWrapper: { position: "relative", justifyContent: "center" },
    passwordInput: { paddingRight: 46 },
    eyeButton: {
      position: "absolute", right: 14,
      height: "100%", justifyContent: "center",
    },

    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    fab: {
      width: 54, height: 54, borderRadius: 999,
      backgroundColor: fabBg,
      alignItems: "center", justifyContent: "center",
      shadowColor: fabBg,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 6,
    },
    fabDisabled: { opacity: 0.35, shadowOpacity: 0 },
    fabPressed: { opacity: 0.8 },

    pressed: { opacity: 0.6 },
    miniText: { color: t.tertiary, fontSize: 12, flex: 1, marginRight: 12 },
    linkText: { color: t.subtext, fontSize: 13, fontWeight: "600" },

    gap10: { height: 10 },
    gap14: { height: 14 },
    gap18: { height: 18 },

    socialRow: { marginTop: 16 },
    dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
    dividerLine: { flex: 1, height: 1, backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" },
    dividerText: { color: t.tertiary, fontSize: 12, fontWeight: "600" },
    appleButton: { width: "100%", height: 52 },
    appleLoading: {
      height: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    },
  });
}
