import React from "react";
import { useRouter } from "expo-router";
import PaywallSheet from "../../components/PaywallSheet";

export default function UpgradeScreen() {
  const r = useRouter();
  return (
    <PaywallSheet
      onClose={() => (r.canGoBack() ? r.back() : r.replace("/(tabs)/account"))}
    />
  );
}
