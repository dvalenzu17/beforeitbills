// app/account/export.js
import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

import NavHeader from "../../components/NavHeader";
import Button from "../../components/Button";
import Card from "../../components/Card";
import { useTheme } from "../../lib/theme";
import { useStore } from "../../lib/store";

export default function ExportScreen() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();
  const subs = useStore((s) => s.subs);
  const bills = useStore((s) => s.bills);
  const pro = useStore((s) => s.pro);
  const [busy, setBusy] = useState(false);

  const locked = !pro;

  async function exportCSV() {
    if (locked) {
      r.push("/account/upgrade");
      return;
    }
    try {
      setBusy(true);
      const all = [...(subs || []), ...(bills || [])];
      const header = ["id", "merchant", "amount", "currency", "cadence", "nextRenewal", "category", "tags"].join(",");
      const rows = all.map((s) =>
        [s.id, s.merchant || s.name || "", s.amount, s.currency, s.cadence, s.nextRenewal || s.nextDue || "", s.category ?? "", (s.tags || []).join("|")]
          .map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = [header, ...rows].join("\n");
      const path = FileSystem.cacheDirectory + "beforeitbills-subscriptions.csv";
      await FileSystem.writeAsStringAsync(path, csv);
      await Sharing.shareAsync(path, { mimeType: "text/csv", dialogTitle: tt("export.shareDialogCsv") });
    } catch (e) {
      Alert.alert(tt("export.errorTitle"), tt("export.errorBody"));
    } finally {
      setBusy(false);
    }
  }

  async function exportJSON() {
    if (locked) {
      r.push("/account/upgrade");
      return;
    }
    try {
      setBusy(true);
      const payload = {
        exportedAt: new Date().toISOString(),
        subscriptions: subs || [],
        bills: bills || [],
      };
      const path = FileSystem.cacheDirectory + "beforeitbills-backup.json";
      await FileSystem.writeAsStringAsync(path, JSON.stringify(payload, null, 2));
      await Sharing.shareAsync(path, { mimeType: "application/json", dialogTitle: tt("export.shareDialogJson") });
    } catch (e) {
      Alert.alert(tt("export.errorTitle"), tt("export.errorBody"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <NavHeader
        title={tt("export.title")}
        subtitle={tt("export.subtitle")}
        onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/(tabs)/account"))}
      />

      <View style={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            {tt("export.csvTitle")}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 19 }}>
            {tt("export.csvDesc")}
          </Text>
          <View style={{ height: 14 }} />
          <Button
            title={busy ? tt("export.exporting") : tt("export.exportCsv")}
            onPress={exportCSV}
            disabled={busy}
            left={<Feather name={locked ? "lock" : "download"} size={16} color="#fff" />}
          />
          {locked && (
            <Text style={{ color: t.subtext, fontSize: 12, marginTop: 8 }}>
              {tt("export.proLocked")}
            </Text>
          )}
        </Card>

        <Card>
          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            {tt("export.jsonTitle")}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 19 }}>
            {tt("export.jsonDesc")}
          </Text>
          <View style={{ height: 14 }} />
          <Button
            title={busy ? tt("export.exporting") : tt("export.exportJson")}
            variant="secondary"
            onPress={exportJSON}
            disabled={busy}
            left={<Feather name={locked ? "lock" : "file-text"} size={16} color={t.text} />}
          />
          {locked && (
            <Text style={{ color: t.subtext, fontSize: 12, marginTop: 8 }}>
              {tt("export.proLocked")}
            </Text>
          )}
        </Card>

      </View>
    </SafeAreaView>
  );
}