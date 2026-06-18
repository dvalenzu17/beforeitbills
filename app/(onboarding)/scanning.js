// app/(onboarding)/scanning.js
import React, { useMemo, useEffect, useRef, useState } from "react";
import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../lib/theme";
import Card from "../../components/Card";
import Button from "../../components/Button";
import { useScanProgress } from "../../lib/scan/useScanProgress";
import { useRecordingStore } from "../../lib/recordingMode";

import {
  EMAIL_SCAN_FREE_CAP,
  getEmailsScannedCount,
  incrementEmailsScanned,
} from "../../lib/emailScanPreview";
import { track } from "../../lib/analytics";

// Well-known services we scan for — cycled as a live "checking…" ticker so the
// wait feels active. This is honest (we genuinely scan for these); the real
// counts below reflect what was actually detected.
const SCAN_BRANDS = [
  "Netflix", "Spotify", "Amazon Prime", "Disney+", "Adobe", "iCloud+",
  "YouTube Premium", "ChatGPT", "Dropbox", "Audible", "Hulu", "Notion",
  "Microsoft 365", "NordVPN", "Duolingo", "Patreon",
];

export default function Scanning() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();
  const params = useLocalSearchParams();

  const recordingActive = useRecordingStore((s) => s.active);

  const scanId = recordingActive
    ? `recording-${Date.now()}`
    : String(params?.scanId || "");
  const limit = Math.max(0, Number(params?.limit || 0)); // scans allowed this run
  const usedStart = Math.max(0, Number(params?.usedStart || 0));

  const { pct, scanned, receipts, subs, done, error } = useScanProgress(scanId);
  const canView = subs > 0;

  // Rotating "checking for {brand}…" ticker while the scan runs.
  const [brandIdx, setBrandIdx] = useState(0);
  useEffect(() => {
    if (done || error) return;
    const id = setInterval(() => setBrandIdx((i) => (i + 1) % SCAN_BRANDS.length), 700);
    return () => clearInterval(id);
  }, [done, error]);

  useEffect(() => {
    track("scan_started", { range: String(params?.range || "year") });
  }, []);

  const [usedNow, setUsedNow] = useState(usedStart);

  const didPersistRef = useRef(false);

  const rangeLabel = useMemo(() => {
    const rr = String(params?.range || "year");
    if (rr === "90") return tt("ob.range90");
    if (rr === "all") return tt("ob.rangeAll");
    return tt("ob.rangeYear");
  }, [params, tt]);

  const remainingThisRun = useMemo(() => {
    if (!limit) return null;
    return Math.max(0, limit - Number(scanned || 0));
  }, [limit, scanned]);

  // persist count once when scan is done
  useEffect(() => {
    (async () => {
      if (!done || didPersistRef.current) return;
      didPersistRef.current = true;

      // Recording mode: skip all persistence, go straight to results
      if (recordingActive) {
        r.replace("/(onboarding)/results");
        return;
      }

      // update store
      const after = await incrementEmailsScanned(Number(scanned || 0));

      // clamp UI display to cap
      const safeAfter = Math.min(EMAIL_SCAN_FREE_CAP, after);
      setUsedNow(safeAfter);

      r.replace("/(onboarding)/results");
    })().catch(() => {
      // even if persist fails, still allow user to proceed
      r.replace("/(onboarding)/results");
    });
  }, [done, scanned, r]);

  // keep usedNow synced (optional, in case user returns mid scan)
  useEffect(() => {
    (async () => {
      const u = await getEmailsScannedCount();
      setUsedNow(Math.min(EMAIL_SCAN_FREE_CAP, u));
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ flex: 1, padding: 16, paddingTop: 12 }}>
      <Text style={{ color: t.text, fontSize: 26, fontWeight: "900" }}>
        {tt("ob.scanningTitle")}
      </Text>
      <Text style={{ color: t.subtext, marginTop: 8 }}>
        {tt("ob.scanningSub", { range: rangeLabel })}
      </Text>

      {!done && !error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <Feather name="search" size={14} color={t.accent} />
          <Text style={{ color: t.accent, fontWeight: "800" }}>
            {tt("ob.scanningChecking", { brand: SCAN_BRANDS[brandIdx] }) ||
              `Checking for ${SCAN_BRANDS[brandIdx]}…`}
          </Text>
        </View>
      ) : null}

      <View style={{ height: 16 }} />

      <Card>
        <View
          style={{
            height: 10,
            borderRadius: 999,
            backgroundColor: t.surface2,
            overflow: "hidden",
            borderWidth: 1,
            borderColor: t.hairline,
          }}
        >
          <View
            style={{
              width: `${Math.max(0, Math.min(100, pct))}%`,
              height: "100%",
              backgroundColor: t.accent,
              opacity: 0.7,
            }}
          />
        </View>

        <View style={{ height: 14 }} />

        <View style={{ gap: 8 }}>
          <Text style={{ color: t.text, fontWeight: "900" }}>
            {tt("ob.emailsScanned", { n: scanned })}
            {limit ? `  •  ${Math.max(0, limit - scanned)} remaining` : ""}
          </Text>

          <Text style={{ color: t.text, fontWeight: "900" }}>
            {tt("ob.receiptsFound", { n: receipts })}
          </Text>

          <Text style={{ color: t.text, fontWeight: "900" }}>
            {tt("ob.subsDetected", { n: subs })}
          </Text>
        </View>

        <Text style={{ color: error ? t.warning ?? "#F59E0B" : t.subtext, marginTop: 10 }}>
          {error ? tt("ob.scanError") : tt("ob.scanningHint")}
        </Text>

        <View style={{ height: 12 }} />
        <Text style={{ color: t.subtext }}>
          Preview usage: {Math.min(EMAIL_SCAN_FREE_CAP, usedNow)}/{EMAIL_SCAN_FREE_CAP}
        </Text>
      </Card>

      <View style={{ flex: 1 }} />

      <View style={{ gap: 10 }}>
        <Button
          title={tt("ob.viewResults")}
          disabled={!canView}
          onPress={() => r.push("/(onboarding)/results")}
          left={<Feather name="list" size={16} color="#fff" />}
        />

        <Button
          title={tt("ob.keepScanning")}
          variant="secondary"
          onPress={() =>
            Alert.alert(
              "Still scanning",
              "All good - scanning continues in the background. You can check Results anytime."
            )
          }
        />

        <Button
          title={tt("ob.stop")}
          variant="ghost"
          onPress={() => r.replace("/(onboarding)/results")}
        />
      </View>
      </View>
    </SafeAreaView>
  );
}