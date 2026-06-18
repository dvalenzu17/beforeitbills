// app/cancel-center.js
import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { SPACING } from "../lib/ui/tokens";

import { useTheme } from "../lib/theme";
import BrandAvatar from "../components/BrandAvatar";
import Button from "../components/Button";
import EmptyStateCard from "../components/EmptyStateCard";
import { findPlaybook } from "../lib/playbooks";

function norm(s) {
  return String(s || "").trim();
}

const KNOWN_SUPPORT_URLS = {
  "netflix.com": "https://help.netflix.com/",
  "spotify.com": "https://support.spotify.com/",
  "amazon.com": "https://www.amazon.com/gp/help/customer/",
  "apple.com": "https://support.apple.com/",
  "google.com": "https://support.google.com/",
  "hulu.com": "https://help.hulu.com/",
  "disneyplus.com": "https://help.disneyplus.com/",
  "disney.com": "https://help.disneyplus.com/",
  "microsoft.com": "https://support.microsoft.com/",
  "adobe.com": "https://helpx.adobe.com/",
  "dropbox.com": "https://help.dropbox.com/",
  "slack.com": "https://slack.com/help/",
  "zoom.us": "https://support.zoom.us/",
  "notion.so": "https://www.notion.so/help/",
  "github.com": "https://support.github.com/",
  "linkedin.com": "https://www.linkedin.com/help/linkedin/",
  "youtube.com": "https://support.google.com/youtube/",
  "duolingo.com": "https://support.duolingo.com/",
  "headspace.com": "https://help.headspace.com/",
  "calm.com": "https://support.calm.com/",
  "canva.com": "https://www.canva.com/help/",
  "grammarly.com": "https://support.grammarly.com/",
  "anthropic.com": "https://support.anthropic.com/",
  "openai.com": "https://help.openai.com/",
  "figma.com": "https://help.figma.com/",
  "notion.com": "https://www.notion.so/help/",
  "shopify.com": "https://help.shopify.com/",
  "squarespace.com": "https://support.squarespace.com/",
  "webflow.com": "https://university.webflow.com/",
  "substack.com": "https://support.substack.com/",
  "patreon.com": "https://support.patreon.com/",
};

function domainToSupportUrl(domain) {
  if (!domain) return null;
  const d = domain.replace(/^www\./, "").toLowerCase();
  if (KNOWN_SUPPORT_URLS[d]) return KNOWN_SUPPORT_URLS[d];
  return `https://${d}/help`;
}

async function tryCopy(text) {
  // Optional dependency: won’t crash if not installed.
  try {
    const Clipboard = await import("expo-clipboard");
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(String(text || ""));
      return true;
    }
  } catch {}

  // Fallback: still not a dead end
  Alert.alert("Copy not available", "Install expo-clipboard to enable 1-tap copy on this device.");
  return false;
}

function buildEmailTemplate({ brand, domain, userEmail, reason }) {
  const b = brand || domain || "your service";
  return {
    subject: `Cancellation request - ${b}`,
    body: `Hi ${b} Support,

Please cancel my subscription and stop any future charges.

Account email: ${userEmail || "[your email]"}
Reason: ${reason || "No longer needed"}

Please confirm cancellation and the effective date.

Thanks,`,
  };
}

function buildChatScript({ brand, reason }) {
  const b = brand || "this service";
  return `Hey! I want to cancel my ${b} subscription and make sure I won’t be charged again.
Reason: ${reason || "No longer needed"}.
Please confirm cancellation + effective date.`;
}

function Step({ idx, text }) {
  const t = useTheme();

  return (
    <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: t.hairline,
          backgroundColor: t.surface2,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        <Text style={{ color: t.text, fontWeight: "900", fontSize: 13 }}>
          {idx}
        </Text>
      </View>

      <Text style={{ color: t.text, lineHeight: 20, flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

export default function CancelCenter() {
  const t = useTheme();
  const r = useRouter();
  const params = useLocalSearchParams();

  const brand = norm(params?.name || params?.brand || "");
  const domain = norm(params?.domain || "");
  const plan = norm(params?.plan || "");
  const price = norm(params?.price || "");
  const cadence = norm(params?.cadence || "");

  const [tier, setTier] = useState("tier0"); // tier0 | tier1 | tier2
  const [userEmail, setUserEmail] = useState("");
  const [reason, setReason] = useState("");

  const [ticketStatus, setTicketStatus] = useState("Not started"); // Not started | Submitted | Waiting | Confirmed

  // Match a vendor-specific cancellation playbook (precise steps + a direct
  // cancel link). findPlaybook falls back to a generic playbook when unknown.
  const pb = useMemo(() => findPlaybook(brand || domain), [brand, domain]);
  const supportUrl = useMemo(() => pb?.supportUrl || domainToSupportUrl(domain), [pb, domain]);
  const cancelUrl = pb?.webUrl || null;

  const steps = useMemo(() => {
    if (pb?.steps?.length) return pb.steps;
    const b = brand || domain || "this service";
    return [
      `Open ${b} account settings (usually “Settings” → “Subscription” or “Billing”).`,
      `Look for “Cancel subscription” / “Manage plan” and follow the prompts.`,
      `Take a screenshot of the cancellation confirmation page/email.`,
      `Verify you received a confirmation email. If not, contact support.`,
    ];
  }, [pb, brand, domain]);

  const templates = useMemo(
    () => ({
      email: buildEmailTemplate({ brand, domain, userEmail, reason }),
      chat: buildChatScript({ brand, reason }),
    }),
    [brand, domain, userEmail, reason]
  );

  const headerTitle = brand || (domain ? domain.replace(/^www\./, "") : "Cancel Center");

  const Tab = ({ id, label }) => (
    <Pressable
      onPress={() => setTier(id)}
      style={{
        flex: 1,
        paddingVertical: 10,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: tier === id ? t.surface2 : t.surface,
        alignItems: "center",
      }}
    >
      <Text style={{ color: t.text, fontWeight: "800", fontSize: 12 }}>
        {label}
      </Text>
    </Pressable>
  );

  const CopyBox = ({ title, text }) => (
    <View
      style={{
        padding: 12,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: t.surface2,
        gap: 8,
      }}
    >
      <Text style={{ color: t.subtext, fontWeight: "900" }}>{title}</Text>
      <Text style={{ color: t.text, lineHeight: 18 }}>{text}</Text>
      <Button
        title="Copy"
        variant="secondary"
        onPress={async () => {
          const ok = await tryCopy(text);
          if (ok) Alert.alert("Copied", "Paste it into email or chat support.");
        }}
        left={<Feather name="copy" size={16} color={t.text} />}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, paddingBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => r.back()}
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: t.hairline,
              backgroundColor: t.surface,
            }}
          >
            <Feather name="arrow-left" size={16} color={t.text} />
          </Pressable>

          <Text style={{ color: t.text, fontSize: 22, fontWeight: "900" }}>{headerTitle}</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
          <BrandAvatar domain={domain} name={brand || domain} size={52} />
          <View style={{ flex: 1 }}>
            {!!plan && <Text style={{ color: t.text, fontWeight: "900" }}>{plan}</Text>}
            <Text style={{ color: t.subtext, marginTop: 4 }}>
              {price ? `${price} ` : ""}
              {cadence ? `/${cadence}` : ""}
              {domain ? ` · ${domain}` : ""}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Tab id="tier0" label="Tier 0: Steps" />
          <Tab id="tier1" label="Tier 1: Templates" />
          <Tab id="tier2" label="Tier 2: Tracking" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 28, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {tier === "tier0" ? (
          <>
            <View
              style={{
                padding: SPACING.screen,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: t.hairline,
                backgroundColor: t.surface,
                gap: 12,
              }}
            >
              <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>Cancel steps</Text>
              {steps.map((s, i) => (
                <Step key={i} idx={i + 1} text={s} />
              ))}

              <View style={{ gap: 10, marginTop: 6 }}>
                {cancelUrl ? (
                  <Button
                    title={`Open ${brand || "the"} cancel page`}
                    onPress={async () => {
                      try {
                        await Linking.openURL(cancelUrl);
                      } catch (e) {
                        Alert.alert("Couldn't open link", e?.message || "Try again.");
                      }
                    }}
                    left={<Feather name="external-link" size={16} color="#fff" />}
                  />
                ) : null}
                <Button
                  title="Open help page"
                  variant={cancelUrl ? "secondary" : undefined}
                  onPress={async () => {
                    if (!supportUrl) {
                      return Alert.alert("Missing domain", "We need a domain to open the help page.");
                    }
                    try {
                      await Linking.openURL(supportUrl);
                    } catch (e) {
                      Alert.alert("Couldn’t open link", e?.message || "Try again.");
                    }
                  }}
                  left={<Feather name="external-link" size={16} color={cancelUrl ? t.text : "#fff"} />}
                />
              </View>

              {pb?.notes ? (
                <Text style={{ color: t.tertiary, fontSize: 12, lineHeight: 17, marginTop: 8 }}>
                  Note: {pb.notes}
                </Text>
              ) : null}
            </View>

            <EmptyStateCard
              icon="shield"
              title="Pro tip"
              body="Always wait for a cancellation confirmation email. That’s your receipt if they try to bill you again."
              primary={{
                title: "View proof emails",
                icon: "mail",
                onPress: () => r.push({ pathname: "/brand", params: { domain, name: brand } }),
              }}
            />
          </>
        ) : null}

        {tier === "tier1" ? (
          <>
            <View
              style={{
                padding: SPACING.screen,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: t.hairline,
                backgroundColor: t.surface,
                gap: 10,
              }}
            >
              <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>Templates</Text>

              <Text style={{ color: t.subtext, lineHeight: 18 }}>
                Fill your account email + reason. Then copy/paste into email or chat support.
              </Text>

              <View style={{ gap: 10 }}>
                <TextInput
                  value={userEmail}
                  onChangeText={setUserEmail}
                  placeholder="Your account email"
                  placeholderTextColor={t.tertiary}
                  autoCapitalize="none"
                  style={{
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: t.hairline,
                    backgroundColor: t.surface2,
                    color: t.text,
                    fontWeight: "600",
                  }}
                />
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Reason (optional)"
                  placeholderTextColor={t.tertiary}
                  style={{
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderWidth: 1,
                    borderColor: t.hairline,
                    backgroundColor: t.surface2,
                    color: t.text,
                    fontWeight: "600",
                  }}
                />
              </View>
            </View>

            <CopyBox title="EMAIL SUBJECT" text={templates.email.subject} />
            <CopyBox title="EMAIL BODY" text={templates.email.body} />
            <CopyBox title="CHAT SCRIPT" text={templates.chat} />
          </>
        ) : null}

        {tier === "tier2" ? (
          <>
            <View
              style={{
                padding: SPACING.screen,
                borderRadius: 22,
                borderWidth: 1,
                borderColor: t.hairline,
                backgroundColor: t.surface,
                gap: 12,
              }}
            >
              <Text style={{ color: t.text, fontWeight: "900", fontSize: 16 }}>
                Concierge tracking
              </Text>

              <Text style={{ color: t.subtext, lineHeight: 18 }}>
                Track your progress so you don’t lose the thread.
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {["Not started", "Submitted", "Waiting", "Confirmed"].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setTicketStatus(s)}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: ticketStatus === s ? "rgba(255,255,255,0.35)" : t.hairline,
                      backgroundColor: ticketStatus === s ? t.surface2 : t.surface,
                      alignItems: "center",
                    }}
                  >
                    <Text style={{ color: t.text, fontWeight: "900", fontSize: 12 }}>{s}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Open support"
                    onPress={async () => {
                      if (!supportUrl) {
                        return Alert.alert("Missing domain", "We need a domain to open the support page.");
                      }
                      try {
                        await Linking.openURL(supportUrl);
                      } catch (e) {
                        Alert.alert("Couldn't open link", e?.message || "Try again.");
                      }
                    }}
                    left={<Feather name="external-link" size={16} color="#fff" />}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="View emails"
                    variant="secondary"
                    onPress={() => r.push({ pathname: "/brand", params: { domain, name: brand } })}
                    left={<Feather name="mail" size={16} color={t.text} />}
                  />
                </View>
              </View>
            </View>

            <EmptyStateCard
              icon="info"
              title="Optional"
              body="Most users will self-cancel with Tier 0. Tracking is here when you need it."
              primary={{
                title: "Use Tier 0 steps",
                icon: "corner-up-left",
                onPress: () => setTier("tier0"),
              }}
            />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}