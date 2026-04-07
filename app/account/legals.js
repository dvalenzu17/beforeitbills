import React from "react";
import { Alert, Linking, View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import Screen from "../../components/Screen";
import Glass from "../../components/Glass";
import Button from "../../components/Button";
import NavHeader from "../../components/NavHeader";

import { TERMS_URL, PRIVACY_URL } from "../../lib/config";
import { useTheme } from "../../lib/theme";

export default function Legals() {

  const t = useTheme();
  const r = useRouter();

  async function openUrl(url, label) {

    if (!url) {

      Alert.alert(
        "Missing URL",
        `Set EXPO_PUBLIC_${label} in your env to enable this link.`
      );

      return;

    }

    try {

      await Linking.openURL(url);

    } catch (e) {

      Alert.alert("Couldn’t open link", e?.message || "Try again.");

    }

  }

  function Bullet({ icon, text }) {

    return (

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 10
        }}
      >

<View
  style={{
    width: 34,
    height: 34,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: t.surface2 || "transparent",
    borderWidth: 1,
    borderColor: t.hairline
  }}
>
          <Feather name={icon} size={16} color={t.text} />
        </View>

        <Text
          style={{
            color: t.text,
            marginLeft: 10,
            flex: 1
          }}
        >
          {text}
        </Text>

      </View>

    );

  }

  return (

    <Screen>

      <NavHeader
        title="Privacy & Security"
        subtitle="How your data is protected"
        onBack={() => {
          if (r.canGoBack()) r.back();
          else r.replace("/(tabs)/account");
        }}
      />

      <View style={{ padding: 18, gap: 14 }}>

        {/* TRUST OVERVIEW */}

        <Glass>

          <Text
            style={{
              color: t.text,
              fontWeight: "900",
              fontSize: 16
            }}
          >
            Your data stays yours
          </Text>

          <Text
            style={{
              color: t.subtext,
              marginTop: 6,
              lineHeight: 18
            }}
          >
            BeforeItBills detects recurring charges to help you stay ahead of
            subscriptions and bills. Your financial data is never sold, shared,
            or used for advertising.
          </Text>

        </Glass>

        {/* DATA PROTECTION */}

        <Glass>

          <Text
            style={{
              color: t.text,
              fontWeight: "900",
              fontSize: 16
            }}
          >
            Data protection
          </Text>

          <Bullet
            icon="lock"
            text="Encrypted data storage protects your account information."
          />

          <Bullet
            icon="mail"
            text="Email scanning (when enabled) is read-only and used only to detect recurring charges."
          />

          <Bullet
            icon="shield"
            text="BeforeItBills never sells personal data or financial activity."
          />

        </Glass>

        {/* DOCUMENTS */}

        <Glass>

          <Text
            style={{
              color: t.text,
              fontWeight: "900",
              fontSize: 16
            }}
          >
            Legal documents
          </Text>

          <View style={{ marginTop: 14, gap: 10 }}>

            <Button
              title="Terms of Service"
              onPress={() => openUrl(TERMS_URL, "TERMS_URL")}
              left={<Feather name="file-text" size={16} color="#0B0B10" />}
            />

            <Button
              title="Privacy Policy"
              variant="secondary"
              onPress={() => openUrl(PRIVACY_URL, "PRIVACY_URL")}
              left={<Feather name="shield" size={16} color="#FFFFFF" />}
            />

          </View>

        </Glass>

      </View>

    </Screen>

  );

}