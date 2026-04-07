// components/TrustCopy.js
import React from "react";
import { View } from "react-native";
import * as T from "./ui/Text";
import { useTheme } from "../lib/theme";

export default function TrustCopy({ compact = false }) {
  const t = useTheme();

  const bullets = [
    "Read-only. We can’t send email or delete anything.",
    "We scan for receipts + renewal keywords to find subscriptions.",
    "We don’t store your email content. We only save detected billing details.",
    "Disconnect anytime. Your saved recurring items stay.",
  ];

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: t.surface2,
        padding: compact ? 12 : 14,
      }}
    >
      <T.Sub style={{ fontWeight: "900" }}>Gmail connection (read-only)</T.Sub>
      <View style={{ height: compact ? 8 : 10 }} />
      {bullets.map((b, i) => (
        <T.Sub key={i} style={{ marginBottom: i === bullets.length - 1 ? 0 : 8 }}>
          • {b}
        </T.Sub>
      ))}
      <View style={{ height: compact ? 8 : 10 }} />
      <T.Sub style={{ opacity: 0.9 }}>
        BeforeItBills never sends email. This connection is read-only.
      </T.Sub>
    </View>
  );
}
