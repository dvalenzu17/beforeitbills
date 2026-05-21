// app/account/connect-email/activity.js
import React, { useMemo } from "react";
import { View, Text, ScrollView } from "react-native";
import { useTranslation } from "react-i18next";
import Screen from "@/components/Screen";
import NavHeader from "@/components/NavHeader";
import Card from "@/components/Card";
import { useTheme } from "@/lib/theme";
import { useEmailImportStore } from "@/lib/emailImportStore";

export default function ScanActivity() {
  const { t } = useTranslation();
  const theme = useTheme();
  const scanLog = useEmailImportStore((s) => s.scanLog);

  const rows = useMemo(() => (scanLog || []), [scanLog]);

  return (
    <Screen>
      <NavHeader title={t("scanActivity.title")} subtitle={t("scanActivity.subtitle")} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 }}>
        {rows.length === 0 ? (
          <Card style={{ padding: 16 }}>
            <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>
              {t("scanActivity.noScansTitle")}
            </Text>
            <Text style={{ color: theme.subtext, marginTop: 6, lineHeight: 18 }}>
              {t("scanActivity.noScansBody")}
            </Text>
          </Card>
        ) : (
          rows.map((x, idx) => (
            <Card key={`${x.at}-${idx}`} style={{ padding: 16 }}>
              <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>
                {new Date(x.at).toLocaleString()}
              </Text>

              <Text style={{ color: theme.subtext, marginTop: 6 }}>
                {t("scanActivity.provider")}: {x.provider} • {t("scanActivity.mode")}: {x.mode}
              </Text>

              <View style={{ marginTop: 10, flexDirection: "row", gap: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.subtext, fontWeight: "800", fontSize: 12 }}>
                    {t("scanActivity.emailsScanned")}
                  </Text>
                  <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>
                    {x.scanned ?? "-"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.subtext, fontWeight: "800", fontSize: 12 }}>
                    {t("scanActivity.subsFound")}
                  </Text>
                  <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>
                    {x.found ?? 0}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.subtext, fontWeight: "800", fontSize: 12 }}>
                    {t("scanActivity.scanRange")}
                  </Text>
                  <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>
                    {t("scanActivity.days", { n: x.daysBack })}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}