// Redirects to the unified provider picker — this screen is no longer used directly.
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function ConnectInboxRedirect() {
  const r = useRouter();
  useEffect(() => {
    r.replace("/account/connect-email");
  }, []);
  return null;
}
