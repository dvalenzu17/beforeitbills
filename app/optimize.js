// app/optimize.js
import React, { useMemo } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { ScrollView, View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme } from "../lib/theme";
import { useStore } from "../lib/store";
import { formatMoney } from "../lib/utils";

import Card from "../components/Card";
import Button from "../components/Button";
import BrandAvatar from "../components/BrandAvatar";

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

function cadenceFactor(c) {
  return c === "yearly" ? 1 / 12 : c === "quarterly" ? 1 / 3 : c === "weekly" ? 4.345 : 1;
}

function shareDivisor(x) {
  if (!x?.shared) return 1;
  const n = Number(x?.sharedCount ?? 1);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function monthlyCost(sub) {
  const amt = (Number(sub?.amount || 0) / shareDivisor(sub)) * cadenceFactor(sub?.cadence || "monthly");
  return Number.isFinite(amt) ? amt : 0;
}

function guessDomainFromMerchant(merchant) {
  const m = norm(merchant);
  if (!m) return "";
  const cleaned = m.replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).join("");
  if (!cleaned) return "";
  return `${cleaned}.com`;
}

function groupKeyForDuplicates(merchant) {
  const m = norm(merchant);

  const buckets = [
    { key: "cloud_storage", match: ["icloud", "google one", "dropbox", "onedrive", "box"] },
    { key: "music", match: ["spotify", "apple music", "youtube music", "deezer", "tidal"] },
    { key: "video_streaming", match: ["netflix", "hulu", "disney", "prime video", "max", "paramount"] },
    { key: "vpn", match: ["nordvpn", "expressvpn", "surfshark"] },
    { key: "password_manager", match: ["1password", "dashlane", "lastpass", "bitwarden"] },
  ];

  for (const b of buckets) {
    if (b.match.some((w) => m.includes(w))) return b.key;
  }
  return null;
}

function bucketLabel(key) {
  if (key === "cloud_storage") return "Duplicate storage";
  if (key === "music") return "Duplicate music";
  if (key === "video_streaming") return "Duplicate streaming";
  if (key === "vpn") return "Duplicate VPNs";
  if (key === "password_manager") return "Duplicate password managers";
  return "Duplicates";
}

export default function Optimize() {

  const t = useTheme();
  const r = useRouter();

  const subs = useStore((s) => s.subs) || [];
  const getRecapRecommendations = useStore((s) => s.getRecapRecommendations);

  const activeSubs = useMemo(() => {
    return subs
      .filter((s) => !!s?.merchant)
      .filter((s) => s?.active !== false)
      .filter((s) => !!s?.nextRenewal)
      .filter((s) => !String(s?.status || "").toLowerCase().includes("cancel"))
      .map((s) => ({
        ...s,
        merchantLabel: String(s.merchant || "").trim() || "Unknown subscription",
        domainGuess: s?.domain || s?.merchantDomain || guessDomainFromMerchant(s.merchant),
        monthly: monthlyCost(s),
      }))
      .sort((a, b) => b.monthly - a.monthly);
  }, [subs]);

  const duplicateGroups = useMemo(() => {
    const map = new Map();

    for (const s of activeSubs) {
      const key = groupKeyForDuplicates(s.merchantLabel);
      if (!key) continue;

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }

    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        label: bucketLabel(key),
        items: items.sort((a, b) => b.monthly - a.monthly),
        totalMonthly: items.reduce((sum, x) => sum + (x.monthly || 0), 0),
      }))
      .filter((g) => g.items.length >= 2)
      .sort((a, b) => b.totalMonthly - a.totalMonthly);
  }, [activeSubs]);

  const recapRecs = useMemo(() => {
    const arr = getRecapRecommendations?.() || [];
    return arr.filter((x) => x?.decision && x.decision !== "Keep").slice(0, 10);
  }, [getRecapRecommendations, subs]);

  const annualSwitch = useMemo(() => {

    const monthlySubs = activeSubs.filter((s) =>
      String(s.cadence || "").toLowerCase().includes("month")
    );

    return monthlySubs
      .slice(0, 12)
      .map((s) => {
        const annualNow = (s.monthly || 0) * 12;
        const assumedSavingsRate = 0.17;

        const estAnnual = annualNow * (1 - assumedSavingsRate);
        const estSave = annualNow - estAnnual;

        return {
          sub: s,
          annualNow,
          estAnnual,
          estSave,
        };
      })
      .filter((x) => x.estSave >= 10)
      .slice(0, 8);
  }, [activeSubs]);

  const openBrand = (sub) => {
    const name = sub?.merchantLabel || sub?.merchant || "Unknown";
    const domain = sub?.domainGuess || "";
    r.push({ pathname: "/brand", params: { name, domain } });
  };

  const openCancelCenter = (sub) => {
    const name = sub?.merchantLabel || sub?.merchant || "Unknown";
    const domain = sub?.domainGuess || "";
    const price = `${Number(sub?.amount || 0)} ${(sub?.currency || "USD").toUpperCase().slice(0, 3)}`;

    r.push({
      pathname: "/cancel-center",
      params: { name, domain, price, cadence: sub?.cadence || "monthly" },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40, gap: 16 }}>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => (r.canGoBack() ? r.back() : r.replace("/(tabs)"))}
            style={{
              padding: 12,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: t.hairline,
              backgroundColor: t.surface,
            }}
          >
            <Feather name="arrow-left" size={16} color={t.text} />
          </Pressable>

          <Text style={{ color: t.text, fontSize: 28, fontWeight: "800" }}>
            Optimize
          </Text>
        </View>

        <Text style={{ color: t.subtext }}>
          Quick wins. No feature spam. Just “save money” actions.
        </Text>

        {/* DUPLICATES */}
        <Card>
          <Text style={{ color: t.subtext, fontWeight: "800" }}>Duplicates</Text>

          {duplicateGroups.length ? (
            <View style={{ marginTop: 14, gap: 12 }}>
              {duplicateGroups.map((g) => (
                <View
                  key={g.key}
                  style={{
                    borderRadius: 20,
                    padding: 14,
                    borderWidth: 1,
                    borderColor: t.hairline,
                    backgroundColor: t.surface,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>
                      {g.label}
                    </Text>
                    <Text style={{ color: t.subtext }}>
                      ~{formatMoney(g.totalMonthly, "USD")}/mo
                    </Text>
                  </View>

                  {g.items.map((s) => (
                    <Pressable
                      key={s.id}
                      onPress={() => openBrand(s)}
                      style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
                    >
                      <BrandAvatar domain={s.domainGuess} name={s.merchantLabel} size={40} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text, fontWeight: "700" }}>
                          {s.merchantLabel}
                        </Text>
                        <Text style={{ color: t.subtext }}>
                          {formatMoney(s.monthly, "USD")}/mo
                        </Text>
                      </View>
                      <Feather name="chevron-right" size={16} color={t.subtext} />
                    </Pressable>
                  ))}

                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Pick one to cancel"
                        onPress={() => openCancelCenter(g.items[0])}
                        left={<Feather name="x-circle" size={16} color="#fff" />}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Button
                        title="View options"
                        variant="secondary"
                        onPress={() => openBrand(g.items[0])}
                        left={<Feather name="eye" size={16} color={t.text} />}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ color: t.subtext, marginTop: 10 }}>
              No obvious duplicates yet.
            </Text>
          )}
        </Card>

        {/* SMART RECOMMENDATIONS */}
        <Card>
          <Text style={{ color: t.subtext, fontWeight: "800" }}>
            Smart recommendations
          </Text>

          {recapRecs.length ? (
            <View style={{ marginTop: 12, gap: 10 }}>
              {recapRecs.map((x) => {

                const sub = x.sub;
                const name = sub?.merchant || "Unknown";
                const domain = guessDomainFromMerchant(name);

                return (
                  <View
                    key={sub.id}
                    style={{
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: t.hairline,
                      padding: 14,
                      backgroundColor: t.surface,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <BrandAvatar domain={domain} name={name} size={42} />

                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text, fontWeight: "700" }}>
                          {x.decision}: {name}
                        </Text>
                        <Text style={{ color: t.subtext }}>
                          {x.why}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="View"
                          variant="secondary"
                          onPress={() => r.push({ pathname: "/brand", params: { name, domain } })}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Button
                          title={x.decision === "Cancel" ? "Cancel" : "Downgrade"}
                          onPress={() =>
                            r.push({
                              pathname: "/cancel-center",
                              params: { name, domain, decision: x.decision },
                            })
                          }
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: t.subtext, marginTop: 10 }}>
              Complete a monthly recap in Insights to get personalized recommendations here.
            </Text>
          )}
        </Card>

        {/* ANNUAL SWITCH */}
        <Card>
          <Text style={{ color: t.subtext, fontWeight: "800" }}>
            Annual switch
          </Text>
          <Text style={{ color: t.tertiary, fontSize: 12, marginTop: 4 }}>
            Most services charge ~15–20% less when billed yearly. Check each service's pricing page to confirm.
          </Text>

          {annualSwitch.length ? (
            <View style={{ marginTop: 12, gap: 10 }}>
              {annualSwitch.map((x) => {
                const s = x.sub;

                return (
                  <View
                    key={s.id}
                    style={{
                      borderRadius: 20,
                      padding: 14,
                      borderWidth: 1,
                      borderColor: t.hairline,
                      backgroundColor: t.surface,
                      gap: 10,
                    }}
                  >
                    <Pressable
                      onPress={() => openBrand(s)}
                      style={{ flexDirection: "row", gap: 12 }}
                    >
                      <BrandAvatar domain={s.domainGuess} name={s.merchantLabel} size={42} />

                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text, fontWeight: "700" }}>
                          {s.merchantLabel}
                        </Text>
                        <Text style={{ color: t.subtext }}>
                          {formatMoney(s.monthly * 12, s.currency || "USD")}/yr now · could be less annually
                        </Text>
                      </View>
                    </Pressable>

                    <Button
                      title="Check annual pricing"
                      onPress={() => openBrand(s)}
                      left={<Feather name="external-link" size={16} color="#fff" />}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={{ color: t.subtext, marginTop: 10 }}>
              No monthly subscriptions to switch yet.
            </Text>
          )}
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}