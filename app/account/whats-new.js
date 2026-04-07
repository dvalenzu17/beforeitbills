import React from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";
import Screen from "@/components/Screen";
import NavHeader from "@/components/NavHeader";
import Card from "@/components/Card";
import { useTheme } from "@/lib/theme";

export default function WhatsNew() {

  const t = useTheme();
  const r = useRouter();

  return (
    <Screen>

      <NavHeader
        title="What’s new"
        subtitle="Product updates"
        onBack={() => r.back()}
      />

<ScrollView
  contentContainerStyle={{
    padding: 16,
    gap: 12,
    paddingBottom: 40
  }}
>

        <Card>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            Subscriptions
          </Text>

          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
            • Track subscriptions and bills together in one place.{"\n"}
            • Add recurring items manually with clean merchant, price, and billing cycle inputs.{"\n"}
            • Edit subscription details before saving imported items.{"\n"}
            • Delete subscriptions directly from the brand page.
          </Text>

        </Card>


        <Card>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            Bills
          </Text>

          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
            • Track fixed bills alongside subscriptions.{"\n"}
            • Set billing cadence and due dates for utilities and recurring payments.{"\n"}
            • Keep upcoming charges organized in the calendar view.
          </Text>

        </Card>


        <Card>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            Free trials
          </Text>

          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
            • Detect and track free trials before they convert.{"\n"}
            • Get reminders before a trial becomes a paid subscription.
          </Text>

        </Card>


        <Card>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            Smart insights
          </Text>

          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
            • Visualize monthly spending across subscriptions.{"\n"}
            • See upcoming charges across the next 30 days.{"\n"}
            • Identify duplicate subscriptions and easy savings opportunities.
          </Text>

        </Card>


        <Card>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            Quality improvements
          </Text>

          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
            • Brand icons automatically appear for popular services.{"\n"}
            • Smarter name matching for merchants.{"\n"}
            • Improved detection of recurring charges from email imports.{"\n"}
            • Faster syncing and cleaner navigation across the app.
          </Text>

        </Card>


        <Card>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            Coming next
          </Text>

          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
            • Shared subscriptions with “who pays” tracking.{"\n"}
            • Smarter inactive subscription detection.{"\n"}
            • More detailed spending insights and automation tools.
          </Text>

        </Card>

        </ScrollView>

    </Screen>
  );

}