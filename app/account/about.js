import React from "react";
import { View, Text } from "react-native";
import Constants from "expo-constants";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Screen from "../../components/Screen";
import Glass from "../../components/Glass";
import NavHeader from "../../components/NavHeader";
import Button from "../../components/Button";
import { useTheme } from "../../lib/theme";

export default function About() {

  const t = useTheme();
  const r = useRouter();

  const version = Constants.expoConfig?.version || "1";

  return (

    <Screen>

      <NavHeader
        title="About"
        subtitle="Product info"
        onBack={() => {
          if (r.canGoBack()) r.back();
          else r.replace("/(tabs)/account");
        }}
      />

      <View style={{ padding: 18, gap: 14 }}>

        {/* APP INFO */}

        <Glass>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>

            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                backgroundColor: t.surface2 || "transparent",
                borderWidth: 1,
                borderColor: t.hairline,
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Feather name="credit-card" size={20} color={t.text} />
            </View>

            <View style={{ flex: 1 }}>

              <Text style={{ color: t.text, fontWeight: "900", fontSize: 18 }}>
                BeforeItBills
              </Text>

              <Text style={{ color: t.subtext, marginTop: 2 }}>
                Recurring spend command center
              </Text>

            </View>

          </View>

          <View
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: t.hairline,
              backgroundColor: t.surface2 || "transparent"
            }}
          >

            <Text style={{ color: t.subtext, fontWeight: "900" }}>
              Version
            </Text>

            <Text style={{ color: t.text, fontWeight: "900", marginTop: 6 }}>
              Beta · Version {version}
            </Text>

          </View>

        </Glass>

        {/* TRUST */}

        <Glass>

          <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
            Our mission
          </Text>

          <Text
            style={{
              color: t.subtext,
              marginTop: 6,
              lineHeight: 18
            }}
          >
            BeforeItBills helps you stay ahead of recurring charges before they
            hit your wallet. Track subscriptions, bills, and trials in one place
            with simple insights that help you save money.
          </Text>

        </Glass>

        {/* LINKS */}

        <Glass>

          <View style={{ gap: 10 }}>

            <Button
              title="What’s new"
              variant="secondary"
              onPress={() => r.push("/account/whats-new")}
              left={<Feather name="clipboard" size={16} color="#FFFFFF" />}
            />

            <Button
              title="Privacy & Security"
              variant="secondary"
              onPress={() => r.push("/account/legals")}
              left={<Feather name="shield" size={16} color="#FFFFFF" />}
            />

            <Button
              title="Help"
              variant="secondary"
              onPress={() => r.push("/account/help")}
              left={<Feather name="help-circle" size={16} color="#FFFFFF" />}
            />

          </View>

        </Glass>

      </View>

    </Screen>

  );

}