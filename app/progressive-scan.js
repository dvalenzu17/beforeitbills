// app/progressive-scan.js

import React, { useState } from "react";
import { Alert, View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useTheme } from "../lib/theme";
import Button from "../components/Button";
import Glass from "../components/Glass";
import { useEmailImportStore } from "../lib/emailImportStore";

export default function ProgressiveScan() {
  const t = useTheme();
  const r = useRouter();
  const { runScan, isLoading } = useEmailImportStore();
  const [started, setStarted] = useState(false);

  async function begin() {
    try {
      setStarted(true);
      await runScan();
      r.push("/recurring");
    } catch (e) {
      Alert.alert("Scan failed", e?.message || "Unknown error");
      setStarted(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 24, gap: 20 }}>
        <Glass intensity={22} style={{ padding: 20 }}>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>
            Scan your Gmail
          </Text>

          <Text style={{ color: t.subtext, marginTop: 8, lineHeight: 18 }}>
            We’ll scan your inbox and detect recurring subscriptions.
          </Text>

          <View style={{ marginTop: 20 }}>
            <Button
              title={isLoading ? "Scanning…" : "Start scan"}
              disabled={isLoading}
              onPress={begin}
              left={<Feather name="search" size={16} color="#fff" />}
            />
          </View>
        </Glass>
      </View>
    </SafeAreaView>
  );
}