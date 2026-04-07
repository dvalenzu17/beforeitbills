// app/account/connected.js
import { Redirect } from "expo-router";

export default function Connected() {
  // single source of truth
  return <Redirect href="/account/connect-email/connected" />;
}
