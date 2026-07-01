import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/lib/theme";
import BrandAvatar from "@/components/BrandAvatar";

// Curated sample that tells the whole story before the user connects: the
// pre-emptive catch (a trial about to bill — the "Before" in BeforeItBills) on
// top, then the audit promise number as backup proof. Clearly labelled SAMPLE
// so it's a promise, not a fake claim about the user's own inbox.
const SAMPLE_TRIAL = { name: "Disney+", domain: "disneyplus.com", amount: 13.99, days: 3 };
const SAMPLE_SUBS = [
  { name: "Netflix",     domain: "netflix.com" },
  { name: "ChatGPT Plus", domain: "openai.com" },
  { name: "Spotify",     domain: "spotify.com" },
];
const SAMPLE_TOTAL = 94;   // $/mo across the sample
const SAMPLE_COUNT = 9;    // subscriptions
const SAMPLE_FORGOTTEN = 2; // unused in 90d

export default function ConnectPreview() {
  const t = useTheme();
  const { t: tt } = useTranslation();

  return (
    <View style={{ marginBottom: 24 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, marginLeft: 4 }}>
        <Text style={{ fontSize: 11, fontWeight: "800", color: t.tertiary, textTransform: "uppercase", letterSpacing: 1 }}>
          {tt("ob.preview.eyebrow")}
        </Text>
        <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, backgroundColor: t.tertiary + "22" }}>
          <Text style={{ fontSize: 9, fontWeight: "900", color: t.tertiary, letterSpacing: 0.6 }}>
            {tt("ob.preview.sampleBadge")}
          </Text>
        </View>
      </View>

      <View style={{ backgroundColor: t.surface, borderRadius: 18, borderWidth: 1, borderColor: t.hairline, overflow: "hidden" }}>
        {/* Pre-emption hero: a trial about to bill — the differentiated moment. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: t.accent + "12" }}>
          <BrandAvatar domain={SAMPLE_TRIAL.domain} name={SAMPLE_TRIAL.name} size={40} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 5, backgroundColor: "#FF9F0A22" }}>
                <Text style={{ fontSize: 9, fontWeight: "900", color: "#FF9F0A", letterSpacing: 0.6 }}>
                  {tt("ob.preview.trialBadge")}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "800", color: t.text }}>
              {tt("ob.preview.trialLine", { name: SAMPLE_TRIAL.name, amount: `$${SAMPLE_TRIAL.amount}`, days: SAMPLE_TRIAL.days })}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: t.accent }}>
            <Feather name="bell" size={12} color="#fff" />
            <Text style={{ fontSize: 12, fontWeight: "800", color: "#fff" }}>{tt("ob.preview.remind")}</Text>
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: t.hairline }} />

        {/* Audit promise number. */}
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Text style={{ fontSize: 34, fontWeight: "900", color: t.text, letterSpacing: -1 }}>${SAMPLE_TOTAL}</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: t.tertiary }}>{tt("ob.preview.perMonth")}</Text>
          </View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: t.subtext, marginTop: 2 }}>
            {tt("ob.preview.summary", { count: SAMPLE_COUNT, forgotten: SAMPLE_FORGOTTEN })}
          </Text>

          {/* A few sample rows, dimmed to read as illustrative. */}
          <View style={{ flexDirection: "row", gap: 16, marginTop: 14 }}>
            {SAMPLE_SUBS.map((s) => (
              <View key={s.name} style={{ alignItems: "center", gap: 5, opacity: 0.85 }}>
                <BrandAvatar domain={s.domain} name={s.name} size={34} />
                <Text style={{ fontSize: 10, fontWeight: "700", color: t.tertiary }} numberOfLines={1}>{s.name}</Text>
              </View>
            ))}
            <View style={{ alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: 17, backgroundColor: t.surface2, marginTop: 0 }}>
              <Text style={{ fontSize: 11, fontWeight: "800", color: t.tertiary }}>+{SAMPLE_COUNT - SAMPLE_SUBS.length}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={{ fontSize: 12, fontWeight: "600", color: t.tertiary, marginTop: 10, marginLeft: 4 }}>
        {tt("ob.preview.caption")}
      </Text>
    </View>
  );
}
