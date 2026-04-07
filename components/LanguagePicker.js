// components/LanguagePicker.js
import React from "react";
import { View, Text, Pressable } from "react-native";
import { useTranslation } from "react-i18next";
import { getAppLanguage, setAppLanguage } from "../lib/i18n";
import { useTheme } from "../lib/theme";

const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
];

export default function LanguagePicker() {
  const t = useTheme();
  const { t: tt } = useTranslation();
  const current = getAppLanguage();

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: t.subtext, fontWeight: "900" }}>{tt("lang.title")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {LANGS.map((l) => {
          const active = current === l.code;
          return (
            <Pressable
              key={l.code}
              onPress={() => setAppLanguage(l.code)}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: active ? t.accent : t.hairline,
                backgroundColor: active ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.18)",
              }}
            >
              <Text style={{ color: t.text, fontWeight: "900" }}>{l.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
