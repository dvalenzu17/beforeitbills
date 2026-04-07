// app/oauth-success.js
// Deep-link landing for OAuth redirects.
// With expo-auth-session, this route is handled internally by the SDK.
// This component exists as a safety net for any stale redirects.
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";

export default function OAuthSuccess() {
  const router = useRouter();

  useEffect(() => {
    // Let expo-auth-session complete the session if it's waiting
    WebBrowser.maybeCompleteAuthSession();
    // Navigate back to the connected screen after a brief moment
    const t = setTimeout(() => {
      router.replace("/account/connect-email/connected");
    }, 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}