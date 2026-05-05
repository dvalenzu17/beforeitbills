// app/_layout.js
import React, { useEffect, useRef, useState } from "react";
import {
  Stack,
  useRouter,
  useSegments,
  useRootNavigationState,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import ThemeBackground from "../components/ThemeBackground";
import { isOnboardingDone } from "../lib/onboardingGate";
import { ensureI18n } from "../lib/i18n";
import { ToastProvider } from "../components/ToastProvider";
import { ThemeProvider, useTheme } from "../lib/theme";
import "react-native-get-random-values";
import { navigationRef } from "../lib/navigation";
import { SUPABASE_CONFIGURED, supabase } from "../lib/supabase";
import { useStore } from "../lib/store";
import { useAuthState } from "../lib/authState";
import * as WebBrowser from "expo-web-browser";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppState, Modal, View, Text, Pressable } from "react-native";
import { initSentry } from "../lib/sentry";
import { initNotificationHandler } from "../lib/notifications";
import { usePurchasesStore } from "../lib/purchasesStore";
import { registerPushToken } from "../lib/push";
import { useBiometricLock } from "../lib/biometricLock";
import { useTranslation } from "react-i18next";
import * as Notifications from "expo-notifications";
import { handleNotificationAction } from "../lib/notificationsEngine";
import { Feather } from "@expo/vector-icons";
import ConflictResolutionSheet from "../components/ConflictResolutionSheet";
import {
  setupShortcuts,
  addShortcutListener,
  handleInitialShortcut,
} from "../lib/shortcuts";
import {
  getPendingShare,
  clearPendingShare,
} from "../modules/widget-bridge/index";

try { WebBrowser.maybeCompleteAuthSession(); } catch {}

SplashScreen.preventAutoHideAsync().catch(() => {});

// Initialise Sentry as early as possible — before any component renders
initSentry();

// ── Error boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Forward to Sentry if initialised, else console in dev
    try {
      const { Sentry } = require("../lib/sentry");
      Sentry?.captureException?.(error, { extra: info });
    } catch {}
    if (__DEV__) console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

function ErrorFallback({ error, onReset }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#0B0F17", padding: 24, justifyContent: "center", gap: 14 }}>
      <Text style={{ color: "#EAF0FF", fontSize: 24, fontWeight: "900" }}>
        Something went wrong
      </Text>
      <Text style={{ color: "rgba(234,240,255,0.65)", lineHeight: 20 }}>
        BeforeItBills hit an unexpected error. Your data is safe.
      </Text>
      {__DEV__ && (
        <Text style={{ color: "rgba(234,240,255,0.4)", fontSize: 12, fontFamily: "monospace" }}>
          {error?.message || String(error)}
        </Text>
      )}
      <Pressable
        onPress={onReset}
        style={{ marginTop: 10, backgroundColor: "#7DD3FC", borderRadius: 14, padding: 16, alignItems: "center" }}
      >
        <Text style={{ color: "#0B0F17", fontWeight: "900" }}>Try again</Text>
      </Pressable>
    </View>
  );
}

// ── Biometric lock overlay ────────────────────────────────────────────────────
function BiometricLockOverlay() {
  const t = useTheme();
  const { t: tt } = useTranslation();
  const authenticate = useBiometricLock((s) => s.authenticate);
  const [trying, setTrying] = useState(false);

  async function tryUnlock() {
    if (trying) return;
    setTrying(true);
    await authenticate();
    setTrying(false);
  }

  // Attempt automatically on mount
  useEffect(() => { tryUnlock(); }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t?.bg ?? "#0B0F17",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          backgroundColor: (t?.accent ?? "#7DD3FC") + "22",
          borderWidth: 1,
          borderColor: (t?.accent ?? "#7DD3FC") + "44",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Feather name="lock" size={32} color={t?.accent ?? "#7DD3FC"} />
      </View>
      <Text style={{ color: t?.text ?? "#EAF0FF", fontSize: 22, fontWeight: "900" }}>
        {tt("biometricLock.lockedTitle")}
      </Text>
      <Pressable
        onPress={tryUnlock}
        disabled={trying}
        style={{
          backgroundColor: t?.accent ?? "#7DD3FC",
          borderRadius: 14,
          paddingVertical: 14,
          paddingHorizontal: 40,
          opacity: trying ? 0.6 : 1,
        }}
      >
        <Text style={{ color: "#0B0F17", fontWeight: "900", fontSize: 16 }}>
          {trying ? tt("biometricLock.authenticating") : tt("biometricLock.unlock")}
        </Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavState = useRootNavigationState();
  const navReady = !!rootNavState?.key;

  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const setCurrency = useStore((s) => s.setCurrency);
  const setPro = useStore((s) => s.setPro);

  // purchasesStore is the single RevenueCat implementation
  const purchasesInit = usePurchasesStore((s) => s.init);
  const purchasesLogin = usePurchasesStore((s) => s.login);
  const purchasesLogout = usePurchasesStore((s) => s.logout);
  const purchasesIsPro = usePurchasesStore((s) => s.isPro);

  // Keep main store pro flag in sync with purchasesStore
  useEffect(() => {
    setPro?.(purchasesIsPro);
  }, [purchasesIsPro]);

  // Bootstrap RevenueCat once on mount
  useEffect(() => {
    purchasesInit();
  }, []);

  const authReady = useAuthState((s) => s.authReady);
  const setAuthReady = useAuthState((s) => s.setReady);

  const biometricEnabled = useBiometricLock((s) => s.enabled);
  const biometricLocked = useBiometricLock((s) => s.locked);
  const biometricHydrate = useBiometricLock((s) => s.hydrate);
  const biometricLock = useBiometricLock((s) => s.lock);

  const { t: tt } = useTranslation();

  const conflicts = useStore((s) => s.conflicts);
  const resolveConflict = useStore((s) => s.resolveConflict);
  const dismissConflict = useStore((s) => s.dismissConflict);

  const [onboardingDone, setOnboardingDone] = useState(null);

  const didBootstrapRef = useRef(false);
  const splashHiddenRef = useRef(false);
  const bootstrapUserIdRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Hydrate biometric lock preference on mount
  useEffect(() => {
    biometricHydrate();
  }, []);

  // Lock when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (
        appStateRef.current === "active" &&
        (nextState === "background" || nextState === "inactive")
      ) {
        biometricLock();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (__DEV__ && url) console.log("[Linking] initialURL:", url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      if (__DEV__) console.log("[Linking] eventURL:", url);
    });
    return () => sub.remove();
  }, []);

  // Register home-screen shortcuts once auth is resolved
  useEffect(() => {
    if (authReady) setupShortcuts(tt);
  }, [authReady]);

  // Handle receipts shared via the iOS Share Extension.
  // Check once when auth is ready and again every time the app comes to foreground.
  useEffect(() => {
    if (!navReady) return;

    async function consumePendingShare() {
      try {
        const json = await getPendingShare();
        if (!json) return;
        await clearPendingShare();
        const payload = JSON.parse(json);
        const text = payload?.text || payload?.url || '';
        if (!text) return;
        router.push({ pathname: '/add-recurring', params: { shareText: text } });
      } catch (e) {
        if (__DEV__) console.warn('[share] consumePendingShare error:', e?.message);
      }
    }

    // Check on mount (cold-start where extension fired before app opened)
    consumePendingShare();

    // Check whenever the app returns to foreground
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') consumePendingShare();
    });
    return () => sub.remove();
  }, [navReady]);

  // Subscribe to shortcut launches and handle cold-start shortcuts
  useEffect(() => {
    if (!navReady) return;
    handleInitialShortcut(router);
    const unsub = addShortcutListener(router);
    return unsub;
  }, [navReady]);

  // Handle notification tap / action buttons
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      try {
        const result = await handleNotificationAction(response);
        if (result.ok && result.action === "view" && result.screen && navReady) {
          router.push(result.screen);
        }
      } catch (e) {
        if (__DEV__) console.warn("[notif] response handler error:", e?.message);
      }
    });
    return () => sub.remove();
  }, [navReady]);

  // ── Bootstrap ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;

    (async () => {
      try {
        await ensureI18n();
        // Install notification handler here (not at module-eval time) to avoid
        // a void TurboModule throw race with Hermes Hades GC on iOS 26.
        initNotificationHandler();

        if (SUPABASE_CONFIGURED && supabase) {
          const { data } = await supabase.auth.getSession();
          const u = data?.session?.user ?? null;

          const done = await isOnboardingDone(u);
          bootstrapUserIdRef.current = u?.id ?? null;

          setUser(u);
          setOnboardingDone(done);
          setAuthReady(true);

          if (u) {
            // Identify user in RevenueCat
            purchasesLogin(u.id);

            // Register for push notifications — stores token in push_tokens table
            registerPushToken().catch(() => {});

            // Background profile sync
            Promise.resolve(
              supabase.from("profiles")
                .upsert({ id: u.id, email: u.email ?? null, currency: "USD" }, { onConflict: "id" })
            ).catch(() => {});
            Promise.resolve(
              supabase.from("profiles")
                .select("currency").eq("id", u.id).maybeSingle()
            ).then(({ data: d }) => { if (d?.currency) setCurrency?.(d.currency); })
             .catch(() => {});

            const { useEmailImportStore } = await import("../lib/emailImportStore");
            useEmailImportStore.getState().restoreConnectionState?.();
          }

          supabase.auth.onAuthStateChange(async (event, session) => {
            const u = session?.user ?? null;
            setUser(u);

            if (event === "SIGNED_IN") {
              if (u?.id && u.id === bootstrapUserIdRef.current) return;
              bootstrapUserIdRef.current = u?.id ?? null;
              purchasesLogin(u?.id);
              registerPushToken().catch(() => {});
              const done = await isOnboardingDone(u);
              setOnboardingDone(done);
            }

            if (event === "USER_UPDATED") {
              const done = await isOnboardingDone(u);
              setOnboardingDone(done);
            }

            if (event === "SIGNED_OUT") {
              bootstrapUserIdRef.current = null;
              setOnboardingDone(null);
              purchasesLogout();
            }
          });
        } else {
          setUser(null);
          setOnboardingDone(true);
          setAuthReady(true);
        }
      } catch (e) {
        if (__DEV__) console.warn("[boot] auth error:", e?.message);
        setUser(null);
        setOnboardingDone(true);
        setAuthReady(true);
      }
    })();
  }, []);

  // ── Hide splash ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navReady || !authReady || splashHiddenRef.current) return;
    splashHiddenRef.current = true;
    SplashScreen.hideAsync().catch(() => {});
  }, [navReady, authReady]);

  // ── Redirect gate ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navReady) return;
    if (!authReady) return;

    const rootSegment = Array.isArray(segments) ? segments[0] : null;
    const inAuth = rootSegment === "(auth)";
    const inOnboarding = rootSegment === "(onboarding)";

    const isOAuthCallback =
      (segments?.[0] === "auth" && segments?.[1] === "callback") ||
      segments?.[0] === "callback" ||
      segments?.[0] === "oauth-success";
    if (isOAuthCallback) return;

    // Check unauthenticated state BEFORE the onboardingDone null guard so that
    // sign-out always navigates to the sign-in screen even while onboardingDone
    // is being reset to null.
    if (SUPABASE_CONFIGURED && !user) {
      if (!inAuth) router.replace("/(auth)/sign-in");
      return;
    }

    if (onboardingDone === null) return;

    if (!onboardingDone) {
      if (!inOnboarding) router.replace("/(onboarding)");
      return;
    }

    const isAtRoot =
      rootSegment === null ||
      rootSegment === "index" ||
      rootSegment === undefined;

    if (isAtRoot || inAuth || inOnboarding) {
      router.replace("/(tabs)");
    }
  }, [navReady, authReady, onboardingDone, segments, user]);

  const showLock = !!user && biometricEnabled && biometricLocked;

  // Only surface conflicts when the user is authenticated and the app is unlocked
  const pendingConflicts = (user && !showLock) ? (conflicts || []) : [];

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider>
          <ToastProvider>
            <ThemeBackground>
              <StatusBar style="auto" />
              <Stack ref={navigationRef} screenOptions={{ headerShown: false }} />
              <Modal visible={showLock} animationType="fade" statusBarTranslucent>
                <BiometricLockOverlay />
              </Modal>
              <ConflictResolutionSheet
                conflicts={pendingConflicts}
                onKeepLocal={(id) => resolveConflict?.(id, 'local')}
                onKeepRemote={(id) => resolveConflict?.(id, 'remote')}
                onSkip={(id) => dismissConflict?.(id)}
              />
            </ThemeBackground>
          </ToastProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}