// app/account/biometric-lock.js
import React, { useEffect, useState } from "react";
import { View, Text, Switch, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import NavHeader from "../../components/NavHeader";
import { SPACING } from "../../lib/ui/tokens";
import { useTheme } from "../../lib/theme";
import { useBiometricLock, hasBiometricHardware } from "../../lib/biometricLock";

export default function BiometricLockScreen() {
  const r = useRouter();
  const t = useTheme();
  const { t: tt } = useTranslation();

  const enabled = useBiometricLock((s) => s.enabled);
  const setEnabled = useBiometricLock((s) => s.setEnabled);
  const authenticate = useBiometricLock((s) => s.authenticate);

  const [hasHardware, setHasHardware] = useState(null);

  useEffect(() => {
    hasBiometricHardware().then(setHasHardware);
  }, []);

  async function handleToggle(on) {
    if (on) {
      // Require successful auth before enabling, so the user proves they can unlock
      const ok = await authenticate();
      if (!ok) {
        Alert.alert(
          tt("biometricLock.failTitle"),
          tt("biometricLock.failBody")
        );
        return;
      }
    }
    await setEnabled(on);
  }

  const unavailable = hasHardware === false;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <NavHeader
        title={tt("biometricLock.title")}
        onBack={() => (r.canGoBack?.() ? r.back() : r.replace("/account/settings"))}
      />

      <View style={{ padding: SPACING.screen, gap: 20 }}>
        <View
          style={{
            borderRadius: 18,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.hairline,
            paddingHorizontal: 16,
            paddingVertical: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>
                {tt("biometricLock.toggle")}
              </Text>
              <Text style={{ color: t.subtext, marginTop: 3 }}>
                {tt("biometricLock.toggleSub")}
              </Text>
            </View>
            <Switch
              value={enabled}
              onValueChange={handleToggle}
              disabled={unavailable || hasHardware === null}
              trackColor={{ false: t.hairline, true: t.accent }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {unavailable && (
          <Text style={{ color: t.subtext, marginHorizontal: 4 }}>
            {tt("biometricLock.unavailable")}
          </Text>
        )}

        <Text style={{ color: t.subtext, marginHorizontal: 4, lineHeight: 20 }}>
          {tt("biometricLock.description")}
        </Text>
      </View>
    </SafeAreaView>
  );
}
