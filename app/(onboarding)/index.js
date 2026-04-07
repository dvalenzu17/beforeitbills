// app/(onboarding)/index.js
import React, { useEffect } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";

export default function OnboardingStart() {
  const r = useRouter();
  useEffect(() => {
    r.replace("/(onboarding)/expectations");
  }, [r]);
  return <View />;
}
