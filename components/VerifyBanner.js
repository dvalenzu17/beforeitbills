import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useEmailImportStore } from "@/lib/emailImportStore";

export default function VerifyBanner() {
  const router = useRouter();
  const hydrate = useEmailImportStore((x) => x.hydrate);
  const shouldShow = useEmailImportStore((x) => x.shouldShowVerifyBanner());

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!shouldShow) return null;

  return (
    <View style={{
      padding: 12,
      borderRadius: 14,
      marginBottom: 12,
      backgroundColor: "#111",
    }}>
      <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>
        Verify your account
      </Text>
      <Text style={{ color: "#ddd", marginTop: 4, fontSize: 13 }}>
        Connect email to auto-detect recurring expenses (TripIt-style).
      </Text>

      <Pressable
        onPress={() => router.push("/account/connect-email")}
        style={{
          marginTop: 10,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: "#fff",
          alignSelf: "flex-start"
        }}
      >
        <Text style={{ color: "#111", fontWeight: "800" }}>Connect</Text>
      </Pressable>
    </View>
  );
}
