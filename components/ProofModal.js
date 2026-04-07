// components/ProofModal.js
import React, { useMemo } from "react";
import { Modal, View, Text, Pressable, ScrollView } from "react-native";
import { useTheme } from "../lib/theme";
import { useRouter } from "expo-router";
import BrandAvatar from "./BrandAvatar";
import Button from "./Button";

function fmtDate(d) {
  if (!d) return "";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
}

export default function ProofModal({ visible, onClose, item }) {
  const t = useTheme();
  const r = useRouter();

  const proof = useMemo(() => {
    const ev = item?.evidence?.[0] || item?.proof || null;

    const merchant = item?.merchant || item?.name || item?.title || "Unknown";
    const domain = item?.domain || item?.fromDomain || item?.merchantDomain || item?.brandDomain || "";
    const cadence = item?.cadence || item?.interval || "monthly";

    return {
      merchant,
      domain,
      cadence,
      subject: ev?.subject || item?.subject || `Receipt from ${merchant}`,
      from:
        ev?.from ||
        item?.from ||
        (domain ? `billing@${domain}` : "billing@merchant.com"),
      date: ev?.date || item?.date || item?.nextDate || new Date().toISOString(),
      snippet:
        ev?.snippet ||
        item?.snippet ||
        "Payment confirmed. Your plan will renew automatically unless you cancel.",
      why:
        ev?.why ||
        item?.whyDetected || [
          "Multiple billing/renewal emails over time.",
          "Message contained a price and renewal language.",
          "Sender matched the merchant domain.",
        ],
    };
  }, [item]);

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: t.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: t.hairline,
            padding: 18,
            paddingBottom: 20,
            maxHeight: "80%",
          }}
        >
  
          {/* grab handle */}
          <View
            style={{
              alignSelf: "center",
              width: 42,
              height: 5,
              borderRadius: 999,
              backgroundColor: t.hairline,
              marginBottom: 14,
            }}
          />
  
          {/* header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <BrandAvatar
              domain={proof.domain}
              name={proof.merchant}
              size={46}
            />
  
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: t.text,
                  fontSize: 18,
                  fontWeight: "900",
                }}
              >
                {proof.merchant}
              </Text>
  
              <Text
                style={{
                  color: t.subtext,
                  marginTop: 2,
                  fontWeight: "600",
                }}
              >
                {proof.cadence} · {fmtDate(proof.date)}
              </Text>
            </View>
  
            <Pressable onPress={onClose} style={{ padding: 6 }}>
              <Text
                style={{
                  color: t.subtext,
                  fontSize: 20,
                  fontWeight: "800",
                }}
              >
                ✕
              </Text>
            </Pressable>
          </View>
  
          <View style={{ height: 16 }} />
  
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 10,
              gap: 14,
            }}
          >
  
            {/* EMAIL PROOF CARD */}
            <View
              style={{
                padding: 16,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: t.hairline,
                backgroundColor: t.surface2,
              }}
            >
              <Text
                style={{
                  color: t.subtext,
                  fontWeight: "900",
                  fontSize: 12,
                  letterSpacing: 0.4,
                }}
              >
                EMAIL PROOF
              </Text>
  
              <View style={{ height: 10 }} />
  
              <Text
                style={{
                  color: t.text,
                  fontWeight: "800",
                  fontSize: 15,
                }}
              >
                {proof.subject}
              </Text>
  
              <Text style={{ color: t.subtext, marginTop: 6 }}>
                From: {proof.from}
              </Text>
  
              <Text style={{ color: t.subtext, marginTop: 2 }}>
                Date: {fmtDate(proof.date)}
              </Text>
  
              <View style={{ height: 10 }} />
  
              <Text
                style={{
                  color: t.text,
                  lineHeight: 20,
                }}
              >
                {proof.snippet}
              </Text>
            </View>
  
            {/* DETECTION CARD */}
            <View
              style={{
                padding: 16,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: t.hairline,
                backgroundColor: t.surface2,
              }}
            >
              <Text
                style={{
                  color: t.subtext,
                  fontWeight: "900",
                  fontSize: 12,
                  letterSpacing: 0.4,
                }}
              >
                WHY WE DETECTED THIS
              </Text>
  
              <View style={{ height: 10 }} />
  
              {(proof.why || []).slice(0, 3).map((w, idx) => (
                <Text
                  key={idx}
                  style={{
                    color: t.text,
                    lineHeight: 20,
                    marginBottom: 6,
                  }}
                >
                  • {w}
                </Text>
              ))}
            </View>
  
            {/* actions */}
            <View
              style={{
                flexDirection: "row",
                gap: 10,
                marginTop: 6,
              }}
            >
  
              <View style={{ flex: 1 }}>
                <Button
                  title="Close"
                  variant="secondary"
                  onPress={onClose}
                />
              </View>
  
              <View style={{ flex: 1 }}>
                <Button
                  title="View subscription"
                  onPress={() => {
                    onClose?.();
                    r.push({
                      pathname: "/brand",
                      params: {
                        domain: proof.domain || "",
                        name: proof.merchant || "",
                      },
                    });
                  }}
                />
              </View>
  
            </View>
  
          </ScrollView>
  
        </Pressable>
      </Pressable>
    </Modal>
  );
}
