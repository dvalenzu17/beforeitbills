import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Pressable, Alert, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { SPACING } from "../lib/ui/tokens";
import { VStack, HStack } from "../components/ui/Stack";
import * as T from "../components/ui/Text";

import { fmtMoney, cadenceToSuffix, fmtDateShort } from "../lib/formatters";
import SharedBadge from "../components/SharedBadge";

import { useTheme } from "../lib/theme";
import { useStore } from "../lib/store";
import { useEmailImportStore } from "../lib/emailImportStore";

import BrandAvatar from "../components/BrandAvatar";
import ProofModal from "../components/ProofModal";
import Button from "../components/Button";
import Glass from "../components/Glass";

import { resolveBrandMeta } from "../lib/brand/brandResolver";
import { useTranslation } from "react-i18next";

const STATUS_OPTIONS = [
  { key: "active",    label: "Active",     active: true,  color: "#22C55E" },
  { key: "suspended", label: "Suspended",  active: false, color: "#FF9F0A" },
  { key: "cancelled", label: "Cancelled",  active: false, color: "#EF4444" },
];

/* ---------- helpers ---------- */

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function pickDomain(item) {
  return (
    item?.domain ||
    item?.fromDomain ||
    item?.merchantDomain ||
    item?.brandDomain ||
    item?.senderDomain ||
    ""
  );
}

function pickName(item) {
  return item?.title || item?.name || item?.merchant || item?.brand || "Unknown";
}

function statusToLabel(x) {
  const s = String(x?.status || "").toLowerCase();
  if (s.includes("trial")) return "Trial";
  if (s.includes("pause")) return "Paused";
  if (s.includes("cancel")) return "Cancelled";
  return "Active";
}

/* ---------- page ---------- */

export default function BrandPage() {
  const t = useTheme();
  const r = useRouter();
  const { t: tt } = useTranslation();
  const params = useLocalSearchParams();

  const paramDomain = String(params?.domain || "");
  const paramName = String(params?.name || "");

  const subs = useStore((s) => s.subs) || [];
  const bills = useStore((s) => s.bills) || [];
  const getRecurring = useStore((s) => s.getRecurring);
  const updateSub = useStore((s) => s.updateSub);
  const updateBill = useStore((s) => s.updateBill);

  const recurring = useMemo(() => getRecurring?.() || [], [getRecurring, subs, bills]);
  const connectedProvider = useEmailImportStore((x) => x.connectedProvider);
  const emailSubscriptions = useEmailImportStore((x) => x.subscriptions);

  const [brandMeta, setBrandMeta] = useState(null);

  useEffect(() => {
    (async () => {
      const m = await resolveBrandMeta({ domain: paramDomain, name: paramName });
      setBrandMeta(m);
    })();
  }, [paramDomain, paramName]);

  const brandItems = useMemo(() => {
    const d0 = norm(paramDomain);
    const n0 = norm(paramName);

    return recurring.filter((x) => {
      const d = norm(pickDomain(x));
      const n = norm(pickName(x));

      if (d0 && d && d.includes(d0)) return true;
      if (n0 && n && n.includes(n0)) return true;

      return false;
    });
  }, [recurring, paramDomain, paramName]);

  const primary = brandItems[0] || null;

  const title = brandMeta?.name || paramName || pickName(primary);
  const domain = brandMeta?.domain || paramDomain || pickDomain(primary);

  const amount = Number(primary?.amount || 0);
  const currency = primary?.currency || "USD";
  const cadence = primary?.cadence || "monthly";

  const nextDate = primary?.nextDate || primary?.nextRenewal || primary?.nextDue || null;
  const lastDate = primary?.lastChargeAt || null;

  // Status - editable
  const derivedStatus = (() => {
    const s = String(primary?.status || "").toLowerCase();
    if (s === "suspended") return "suspended";
    if (s === "cancelled") return "cancelled";
    return "active";
  })();
  const [statusKey, setStatusKey] = useState(derivedStatus);
  useEffect(() => { setStatusKey(derivedStatus); }, [derivedStatus]);

  async function applyStatus(key) {
    if (!primary) return;
    const opt = STATUS_OPTIONS.find(o => o.key === key);
    if (!opt) return;
    setStatusKey(key);
    const patch = { status: key, active: opt.active };
    if (primary.kind === "bill") await updateBill?.(primary.id, patch);
    else await updateSub?.(primary.id, patch);
  }

  /* ---------- evidence - pull from emailImportStore by merchant name ---------- */

  const evidence = useMemo(() => {
    // Check evidence on recurring item shape, then on raw sub
    if (primary?.evidence?.length) return primary.evidence;
    if (primary?.raw?.evidence?.length) return primary.raw.evidence;
    // Fall back to matching email candidates by merchant name
    const n0 = norm(paramName || pickName(primary));
    const match = (emailSubscriptions || []).find(s => norm(s.merchant).includes(n0) || n0.includes(norm(s.merchant)));
    if (!match) return [];
    const items = [];
    if (match.rawSubject || match.rawFrom) {
      items.push({ subject: match.rawSubject || "(no subject)", from: match.rawFrom || "" });
    }
    return items;
  }, [primary, emailSubscriptions, paramName]);

  const [proofOpen, setProofOpen] = useState(false);
  const [proofItem, setProofItem] = useState(null);

  const openProof = (ev) => {
    setProofItem({
      name: title,
      merchant: title,
      domain,
      cadence,
      evidence: [ev],
    });
    setProofOpen(true);
  };

  const onManage = async () => {
    if (!domain) return;

    const url = domain.startsWith("http") ? domain : `https://${domain}`;

    await Linking.openURL(url);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: SPACING.screen,
          paddingBottom: 40,
          gap: 22,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------- top bar ---------- */}

        <HStack style={{ justifyContent: "space-between" }}>
          <HStack gap={SPACING.rowGap}>
            <Pressable
              onPress={() => r.back()}
              style={{
                padding: 10,
                borderRadius: 14,
                backgroundColor: t.surface,
                borderWidth: 1,
                borderColor: t.hairline,
              }}
            >
              <Feather name="arrow-left" size={16} color={t.text} />
            </Pressable>

            <T.Sub style={{ fontWeight: "900" }}>Brand</T.Sub>
          </HStack>
        </HStack>

        {/* ---------- HERO CARD ---------- */}

        <View
          style={{
            padding: 22,
            borderRadius: 24,
            backgroundColor: t.surface,
            borderWidth: 1,
            borderColor: t.hairline,
            ...t.shadowMd,
          }}
        >
          <HStack gap={16} style={{ alignItems: "center" }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                backgroundColor: t.surface2,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: t.hairline,
              }}
            >
              <BrandAvatar domain={domain} name={title} size={32} />
            </View>

            <View style={{ flex: 1 }}>
              <T.H2 style={{ fontSize: 20 }}>{title}</T.H2>

              {!!domain && <T.Sub style={{ marginTop: 4 }}>{domain}</T.Sub>}
            </View>

            {(() => {
              const current = STATUS_OPTIONS.find(o => o.key === statusKey) || STATUS_OPTIONS[0];
              return (
                <View style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 999,
                  borderWidth: 1.5,
                  borderColor: current.color,
                  backgroundColor: current.color + "18",
                }}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: current.color }}>
                    {current.label}
                  </Text>
                </View>
              );
            })()}
          </HStack>
        </View>

        {/* ---------- ITEMS ---------- */}

        <T.H2 style={{ fontSize: 14, color: t.subtext }}>{tt("brand_screen.subscriptions")}</T.H2>

        <VStack gap={SPACING.cardGap}>
          {brandItems.map((it) => {
            const itAmount = Number(it?.amount || 0);
            const itNext = it?.nextRenewal || it?.nextDue;

            return (
              <View
                key={it.id}
                style={{
                  padding: 18,
                  borderRadius: 20,
                  backgroundColor: t.surface,
                  borderWidth: 1,
                  borderColor: t.hairline,
                  ...t.shadowSm,
                }}
              >
                <HStack style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <T.H2 style={{ fontSize: 16 }}>{pickName(it)}</T.H2>

                    <T.Sub style={{ marginTop: 4 }}>
                      {fmtMoney(itAmount, currency)} · {cadenceToSuffix(cadence)}
                    </T.Sub>

                    {itNext && (
                      <T.Sub style={{ marginTop: 2 }}>Renews {fmtDateShort(itNext)}</T.Sub>
                    )}
                  </View>

                  <HStack gap={8}>
                    <Pressable
                      onPress={() => r.push(`/recurring/${it.kind || "subscription"}/${it.id}`)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 12,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: t.surface2,
                      }}
                    >
                      <Feather name="edit-2" size={16} color={t.text} />
                    </Pressable>
                  </HStack>
                </HStack>
              </View>
            );
          })}
        </VStack>

        {/* ---------- EVIDENCE ---------- */}

        <T.H2 style={{ fontSize: 14, color: t.subtext }}>{tt("brand_screen.evidence")}</T.H2>

        <View
          style={{
            padding: 20,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface,
            gap: 16,
          }}
        >
          {evidence.length ? (
            evidence.map((ev, i) => (
              <Pressable key={i} onPress={() => openProof(ev)}>
                <T.H2 style={{ fontSize: 14 }}>{ev.subject}</T.H2>
                <T.Sub style={{ marginTop: 4 }}>{ev.from}</T.Sub>
              </Pressable>
            ))
          ) : connectedProvider ? (
            <T.Sub>No emails matched for this subscription yet. They'll appear here after your next scan.</T.Sub>
          ) : (
            <>
              <T.H2>No emails yet</T.H2>

              <T.Sub style={{ marginTop: 6 }}>
                Connect your inbox to automatically verify renewals and receipts.
              </T.Sub>

              <View style={{ height: 10 }} />

              <Button
                title="Connect inbox"
                onPress={() => r.push("/account/connect-email")}
                left={<Feather name="link" size={16} color="#fff" />}
              />

              <Button
                title="Upload receipt or PDF"
                variant="secondary"
                onPress={() => r.push("/manual-add")}
                left={<Feather name="upload" size={16} color={t.text} />}
              />
            </>
          )}
        </View>

        {/* ---------- PLAN ---------- */}

        <T.H2 style={{ fontSize: 14, color: t.subtext }}>{tt("brand_screen.plan")}</T.H2>

        <View
          style={{
            padding: 20,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: t.hairline,
            backgroundColor: t.surface,
            gap: 16,
          }}
        >
          <HStack style={{ justifyContent: "space-between" }}>
            <T.Sub>{tt("brand_screen.monthlyCost")}</T.Sub>
            <T.H2>
              {fmtMoney(amount, currency)} {cadenceToSuffix(cadence)}
            </T.H2>
          </HStack>

          <HStack style={{ justifyContent: "space-between" }}>
            <T.Sub>{tt("brand_screen.nextRenewal")}</T.Sub>
            <T.Body>{fmtDateShort(nextDate)}</T.Body>
          </HStack>

          <HStack style={{ justifyContent: "space-between" }}>
            <T.Sub>{tt("brand_screen.lastCharge")}</T.Sub>
            <T.Body>{fmtDateShort(lastDate)}</T.Body>
          </HStack>

          <View style={{ height: 10 }} />

          <HStack gap={SPACING.cardGap}>
            <View style={{ flex: 1 }}>
              <Button
                title={statusKey === "suspended" ? "Resume" : "Pause"}
                variant="secondary"
                onPress={() =>
                  Alert.alert(
                    statusKey === "suspended" ? "Resume subscription?" : "Pause subscription?",
                    statusKey === "suspended"
                      ? `Mark ${title} as active again?`
                      : `Mark ${title} as paused. You can reactivate it any time.`,
                    [
                      { text: "Back", style: "cancel" },
                      {
                        text: statusKey === "suspended" ? "Resume" : "Pause",
                        onPress: () => applyStatus(statusKey === "suspended" ? "active" : "suspended"),
                      },
                    ]
                  )
                }
                left={<Feather name={statusKey === "suspended" ? "play" : "pause"} size={16} color={t.text} />}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Button
                title="Cancel"
                onPress={() =>
                  Alert.alert(
                    "Cancel subscription?",
                    `This will mark ${title} as cancelled. It will still appear in your list with a cancelled status.`,
                    [
                      { text: "Back", style: "cancel" },
                      {
                        text: "Cancel subscription",
                        style: "destructive",
                        onPress: async () => {
                          if (!primary) return;
                          const patch = { status: "cancelled", active: false };
                          if (primary.kind === "bill") await updateBill?.(primary.id, patch);
                          else await updateSub?.(primary.id, patch);
                          r.replace("/(tabs)");
                        },
                      },
                    ]
                  )
                }
                left={<Feather name="x-circle" size={16} color="#fff" />}
              />
            </View>
          </HStack>

          <Button
            title="How to cancel"
            variant="secondary"
            onPress={() => r.push({ pathname: "/cancel-center", params: { domain, name: title } })}
            left={<Feather name="help-circle" size={16} color={t.text} />}
          />

          <Button
            title={tt("brand_screen.openWebsite")}
            variant="secondary"
            onPress={onManage}
            left={<Feather name="external-link" size={16} color={t.text} />}
          />
        </View>
      </ScrollView>

      <ProofModal
        visible={proofOpen}
        item={proofItem}
        onClose={() => setProofOpen(false)}
      />
    </SafeAreaView>
  );
}