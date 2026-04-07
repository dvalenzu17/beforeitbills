// components/ScanSummaryCard.js

import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Button from "./Button";
import { useTheme } from "../lib/theme";
import { timeAgo } from "../lib/timeAgo";
import Card from "./Card";

export default function ScanSummaryCard({
  connected,
  lastScanAt,
  candidateCount
}) {

  const t = useTheme();
  const r = useRouter();

  if (!connected) return null;

  const lastScan = lastScanAt
    ? (timeAgo(lastScanAt) || "Not scanned yet")
    : "Not scanned yet";

  return (

    <Card style={{ padding: 16, marginBottom: 14 }}>

      <Text
        style={{
          color: t.text,
          fontWeight: "800",
          fontSize: 16
        }}
      >
        Mail scan
      </Text>

      <Text
        style={{
          color: t.subtext,
          marginTop: 4
        }}
      >
        Last scan · {lastScan}
      </Text>

      <Text
        style={{
          marginTop: 12,
          fontWeight: "700",
          color: t.text
        }}
      >
        {candidateCount ?? 0} subscriptions detected
      </Text>

      <View style={{ marginTop: 12 }}>

        <Button
          title={`Review results (${candidateCount ?? 0})`}
          onPress={() => r.push("/account/connect-email/review")}
          left={<Feather name="inbox" size={16} color="#fff" />}
        />

      </View>

    </Card>

  );

}