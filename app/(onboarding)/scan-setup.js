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

import {
  EMAIL_SCAN_FREE_CAP,
  getEmailsScannedCount,
  getEmailsRemaining,
  setEmailsScannedCount,
} from "../../lib/emailScanPreview";

const SCAN_TRANSPORT =
  process.env.EXPO_PUBLIC_SCAN_TRANSPORT === "backend" ? "backend" : "mock";

function RangeOption({ id, title, subtitle, active, onSelect, t }) {
  return (
    <Pressable
      onPress={() => onSelect(id)}
      style={{
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: active ? t.accent : t.hairline,
        backgroundColor: active ? t.surface2 : t.bg2 || t.bg,
      }}
    >
      <Text style={{ color: t.text, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: t.subtext, marginTop: 4 }}>{subtitle}</Text>
    </Pressable>
  );
}

export default function ScanSetup() {
  const t = useTheme();
  const r = useRouter();
  const toast = useToast();
  const { t: tt } = useTranslation();

  const [range, setRange] = useState("year");
  const [includePromos, setIncludePromos] = useState(false);

  const [used, setUsed] = useState(0);
  const [remaining, setRemaining] = useState(EMAIL_SCAN_FREE_CAP);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      setChecking(true);
      const u = await getEmailsScannedCount();
      const rem = await getEmailsRemaining();
      setUsed(u);
      setRemaining(rem);
      setChecking(false);
    })();
  }, []);

  const start = async () => {
    const rem = await getEmailsRemaining();
    if (rem <= 0) {
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
        // No session — backend would 401. Use mock so the onboarding
        // preview still runs; they'll get real results after sign-in.
        effectiveTransport = "mock";
        toast.show({ message: "Previewing with sample data — sign in for real results" });
      }
    } catch {
      effectiveTransport = "mock";
    }

    toast.show({ message: "Scan started" });

    const scanId = await startScan({
      range,
      promos: includePromos,
      transport: effectiveTransport,
      limit: rem,
      accessToken,
    });

    r.push({
      pathname: "/(onboarding)/scanning",
      params: {
        scanId,
        range,
        promos: includePromos ? "1" : "0",
        limit: String(rem),
        usedStart: String(EMAIL_SCAN_FREE_CAP - rem),
      },
    });
  };

  const barPct = Math.max(0, Math.min(100, (used / EMAIL_SCAN_FREE_CAP) * 100));
  const limitReached = remaining <= 0;

  // If preview limit is hit during onboarding, show a clear alternative path
  if (!checking && limitReached) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <Screen>
          <HeaderRow
            title="Connect inbox"
            subtitle="Full scan, no limits"
            onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(onboarding)/connect"))}
          />

          <View style={{ height: 14 }} />

          <Card>
            <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
              Preview scans used
            </Text>
            <Text style={{ color: t.subtext, marginTop: 8, lineHeight: 19, fontWeight: "600" }}>
              You've used all {EMAIL_SCAN_FREE_CAP} preview email scans. Connect your Gmail
              for unlimited scanning — it takes 30 seconds and is read-only.
            </Text>

            <View style={{ height: 14 }} />

            <Button
              title="Connect Gmail instead"
              onPress={() => r.replace("/(onboarding)/connect")}
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
          onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(onboarding)/connect"))}
        />

        <View style={{ height: 14 }} />

        <Card>
          <Text style={{ color: t.text, fontWeight: "900" }}>Preview mode</Text>
          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
            You get {EMAIL_SCAN_FREE_CAP} free email scans to preview results.
          </Text>

          <View style={{ height: 12 }} />

          <View
            style={{
              height: 8,
              borderRadius: 999,
              backgroundColor: t.surface2,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: t.hairline,
            }}
          >
            <View
              style={{
                width: `${barPct}%`,
                height: "100%",
                backgroundColor: t.accent,
                opacity: 0.6,
              }}
            />
          </View>

          <Text style={{ color: t.subtext, marginTop: 10 }}>
            {remaining} remaining · {used}/{EMAIL_SCAN_FREE_CAP} used
          </Text>

          <View style={{ height: 10 }} />

          <Text style={{ color: t.tertiary, fontWeight: "600" }}>
            What we look for: receipts, invoices, renewal dates, and subscription keywords.
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
              onSelect={setRange}
              t={t}
            />
            <RangeOption
              id="year"
              title={tt("ob.rangeYear")}
              subtitle={tt("ob.rangeYearSub")}
              active={range === "year"}
              onSelect={setRange}
              t={t}
            />
            <RangeOption
              id="all"
              title={tt("ob.rangeAll")}
              subtitle={tt("ob.rangeAllSub")}
              active={range === "all"}
              onSelect={setRange}
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

        <View style={{ marginTop: "auto" }}>
          <Button
            title={tt("ob.startScan")}
            onPress={start}
            haptic="selection"
            left={<Feather name="search" size={16} color="#fff" />}
          />
        </View>
      </Screen>
    </SafeAreaView>
  );
}