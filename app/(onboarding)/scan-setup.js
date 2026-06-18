import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { startScan } from "../../lib/scan/service";
import { useToast } from "../../components/ToastProvider";
import { useTheme } from "../../lib/theme";
import Card from "../../components/Card";
import Button from "../../components/Button";
import { Screen, HeaderRow } from "../../components/_ui";
import { supabase } from "../../lib/supabase";
import { usePurchasesStore } from "../../lib/purchasesStore";

import {
  EMAIL_SCAN_FREE_CAP,
  getEmailsScannedCount,
  getEmailsRemainingForUser,
  setEmailsScannedCount,
} from "../../lib/emailScanPreview";

const SCAN_TRANSPORT =
  process.env.EXPO_PUBLIC_SCAN_TRANSPORT === "backend" ? "backend" : "mock";

function RangeOption({ id, title, subtitle, active, onSelect, locked, t }) {
  return (
    <Pressable
      onPress={() => onSelect(id)}
      style={{
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: active ? t.accent : t.hairline,
        backgroundColor: active ? t.surface2 : t.bg2 || t.bg,
        opacity: locked ? 0.65 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ color: t.text, fontWeight: "900" }}>{title}</Text>
        {locked && (
          <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: "#6366F1" }}>
            <Text style={{ color: "#fff", fontSize: 9, fontWeight: "900", letterSpacing: 0.8 }}>PRO</Text>
          </View>
        )}
      </View>
      <Text style={{ color: t.subtext, marginTop: 4 }}>{subtitle}</Text>
    </Pressable>
  );
}

export default function ScanSetup() {
  const t = useTheme();
  const r = useRouter();
  const toast = useToast();
  const { t: tt } = useTranslation();

  const isPro = usePurchasesStore((s) => s.isPro);

  // Free users default to 90-day range; pro users can use any range.
  const [range, setRange] = useState(isPro ? "year" : "90");
  const [includePromos, setIncludePromos] = useState(false);

  const [used, setUsed] = useState(0);
  const [remaining, setRemaining] = useState(EMAIL_SCAN_FREE_CAP);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      setChecking(true);
      const u = await getEmailsScannedCount();
      const rem = await getEmailsRemainingForUser(isPro);
      setUsed(u);
      setRemaining(rem);
      setChecking(false);
    })();
  }, [isPro]);

  // If user loses pro while on this screen, reset to free range.
  useEffect(() => {
    if (!isPro && (range === "year" || range === "all")) setRange("90");
  }, [isPro]);

  function selectRange(id) {
    if (!isPro && (id === "year" || id === "all")) {
      r.push("/account/upgrade");
      return;
    }
    setRange(id);
  }

  const start = async () => {
    const rem = await getEmailsRemainingForUser(isPro);
    if (!isPro && rem <= 0) {
      toast.show({ message: `Preview limit reached (0/${EMAIL_SCAN_FREE_CAP} remaining).` });
      return;
    }

    // Fetch the Supabase session token so the backend can authenticate
    // the request against the user's stored Gmail OAuth tokens.
    // If there's no session (user skipped sign-in during onboarding),
    // we fall back to mock transport so the preview still works.
    let accessToken = null;
    let effectiveTransport = SCAN_TRANSPORT;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data?.session?.access_token ?? null;
      if (!accessToken && SCAN_TRANSPORT === "backend") {
        // No session - backend would 401. Use mock so the onboarding
        // preview still runs; they'll get real results after sign-in.
        effectiveTransport = "mock";
        toast.show({ message: "Previewing with sample data - sign in for real results" });
      }
    } catch {
      effectiveTransport = "mock";
    }

    toast.show({ message: "Scan started" });

    const scanId = await startScan({
      range,
      promos: includePromos,
      transport: effectiveTransport,
      limit: isPro ? undefined : rem,
      accessToken,
    });

    r.push({
      pathname: "/(onboarding)/scanning",
      params: {
        scanId,
        range,
        promos: includePromos ? "1" : "0",
        ...(isPro ? {} : {
          limit: String(rem),
          usedStart: String(EMAIL_SCAN_FREE_CAP - rem),
        }),
      },
    });
  };

  const barPct = Math.max(0, Math.min(100, (used / EMAIL_SCAN_FREE_CAP) * 100));
  const limitReached = !isPro && remaining <= 0;

  // If preview limit is hit during onboarding, show a clear alternative path
  if (!checking && limitReached) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <Screen>
          <HeaderRow
            title="Connect inbox"
            subtitle="Full scan, no limits"
            onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/account/connect-email"))}
          />

          <View style={{ height: 14 }} />

          <Card>
            <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
              Preview scans used
            </Text>
            <Text style={{ color: t.subtext, marginTop: 8, lineHeight: 19, fontWeight: "600" }}>
              You've used all {EMAIL_SCAN_FREE_CAP} preview email scans. Connect your Gmail
              for unlimited scanning - it takes 30 seconds and is read-only.
            </Text>

            <View style={{ height: 14 }} />

            <Button
              title="Connect Gmail instead"
              onPress={() => r.replace("/account/connect-email")}
              left={<Feather name="mail" size={16} color="#fff" />}
            />

            <View style={{ height: 10 }} />

            <Button
              title="Add manually"
              variant="secondary"
              onPress={async () => {
                const { setOnboardingDone } = await import("../../lib/onboardingGate");
                await setOnboardingDone(true);
                r.replace("/add-recurring");
              }}
              left={<Feather name="plus" size={16} color={t.text} />}
            />
          </Card>
        </Screen>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        <HeaderRow
          title={tt("ob.scanSetupTitle")}
          subtitle={tt("ob.scanSetupBody")}
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/account/connect-email"))}
        />

        <View style={{ height: 14 }} />

        {/* Trust first — limits/upgrade come after the user has seen value. */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="lock" size={16} color={t.accent} />
            <Text style={{ color: t.text, fontWeight: "900" }}>
              {tt("ob.trustTitle") || "Private & read-only"}
            </Text>
          </View>
          <Text style={{ color: t.subtext, marginTop: 8, lineHeight: 19, fontWeight: "600" }}>
            {tt("ob.trustBody") ||
              "We scan only billing emails — receipts, invoices and renewals — and save just the subscriptions we find. We never store the contents of your emails, and access is read-only."}
          </Text>
        </Card>

        <View style={{ height: 12 }} />

        <Card>
          <View style={{ gap: 10 }}>
            <RangeOption
              id="90"
              title={tt("ob.range90")}
              subtitle={tt("ob.range90Sub")}
              active={range === "90"}
              onSelect={selectRange}
              locked={false}
              t={t}
            />
            <RangeOption
              id="year"
              title={tt("ob.rangeYear")}
              subtitle={isPro ? tt("ob.rangeYearSub") : "Pro - scan the last 12 months"}
              active={range === "year"}
              onSelect={selectRange}
              locked={!isPro}
              t={t}
            />
            <RangeOption
              id="all"
              title={tt("ob.rangeAll")}
              subtitle={isPro ? tt("ob.rangeAllSub") : "Pro - scan your entire inbox history"}
              active={range === "all"}
              onSelect={selectRange}
              locked={!isPro}
              t={t}
            />
          </View>

          <View style={{ height: 14 }} />

          <Pressable
            onPress={() => setIncludePromos((v) => !v)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              padding: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: includePromos ? t.accent : t.hairline,
              backgroundColor: includePromos ? t.surface2 : t.bg2 || t.bg,
            }}
          >
            <Feather
              name={includePromos ? "check-square" : "square"}
              size={18}
              color={includePromos ? t.accent : t.subtext}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "900" }}>{tt("ob.includePromos")}</Text>
              <Text style={{ color: t.subtext, marginTop: 2 }}>{tt("ob.includePromosSub")}</Text>
            </View>
          </Pressable>
        </Card>

        <View style={{ marginTop: "auto", gap: 10 }}>
          <Button
            title={tt("ob.startScan")}
            onPress={start}
            haptic="selection"
            left={<Feather name="search" size={16} color="#fff" />}
          />
          <Button
            title={tt("ob.seeSample") || "See a sample first"}
            variant="ghost"
            onPress={() => r.push("/(onboarding)/results?demo=1")}
            left={<Feather name="eye" size={16} color={t.text} />}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}