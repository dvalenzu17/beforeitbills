// components/ReferralSheet.js
// "Give 30 days free, get 30 days free" referral mechanic.
// Shows after the user's first successful scan result.

import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  Pressable,
  Share,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../lib/theme";
import { useStore } from "../lib/store";
import { supabase } from "../lib/supabase";
import { track } from "../lib/analytics";

export default function ReferralSheet({ visible, onClose }) {
  const t = useTheme();
  const user = useStore((s) => s.user);
  const profile = useStore((s) => s.profile);

  const [refCode, setRefCode] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !user?.id) return;
    loadRefCode();
  }, [visible, user?.id]);

  async function loadRefCode() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("profiles")
        .select("ref_code, ref_count, ref_bonus_days")
        .eq("id", user.id)
        .single();

      setRefCode(data?.ref_code ?? null);
    } catch {}
    setLoading(false);
  }

  async function handleCopy() {
    if (!refCode) return;
    await Clipboard.setStringAsync(refCode);
    setCopied(true);
    track("referral_code_copied", { ref_code: refCode });
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!refCode) return;
    track("referral_shared", { ref_code: refCode });
    try {
      await Share.share({
        message:
          `Use my code ${refCode} on BeforeItBills and get 30 days free.\n\n` +
          `BeforeItBills scans your inbox and shows every subscription before it charges you.\n\n` +
          `Download: https://beforeitbills.com`,
      });
    } catch {}
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      >
        <View
          style={{
            backgroundColor: t.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: t.hairline,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 99,
              backgroundColor: t.hairline,
              alignSelf: "center",
              marginBottom: 20,
            }}
          />

          <Text
            style={{ color: t.text, fontSize: 22, fontWeight: "900", textAlign: "center" }}
          >
            Give 30 days free 🎁
          </Text>
          <Text
            style={{
              color: t.subtext,
              marginTop: 8,
              textAlign: "center",
              lineHeight: 20,
              fontWeight: "600",
            }}
          >
            Share your code. Your friend gets 30 days free.{"\n"}
            You get 30 days free when they sign up.
          </Text>

          <View style={{ height: 24 }} />

          {loading ? (
            <ActivityIndicator />
          ) : refCode ? (
            <>
              {/* Code display */}
              <Pressable
                onPress={handleCopy}
                style={{
                  backgroundColor: t.surface,
                  borderWidth: 1,
                  borderColor: t.hairline,
                  borderRadius: 18,
                  padding: 20,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    color: t.accent,
                    fontSize: 28,
                    fontWeight: "900",
                    letterSpacing: 4,
                  }}
                >
                  {refCode}
                </Text>
                <Feather
                  name={copied ? "check" : "copy"}
                  size={20}
                  color={copied ? "#30D158" : t.subtext}
                />
              </Pressable>

              {copied && (
                <Text
                  style={{
                    color: "#30D158",
                    textAlign: "center",
                    fontWeight: "800",
                    marginTop: 8,
                  }}
                >
                  Copied!
                </Text>
              )}

              <View style={{ height: 16 }} />

              {/* Share button */}
              <Pressable
                onPress={handleShare}
                style={{
                  backgroundColor: t.accent,
                  borderRadius: 16,
                  paddingVertical: 16,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 10,
                }}
              >
                <Feather name="share-2" size={18} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                  Share your code
                </Text>
              </Pressable>
            </>
          ) : (
            <Text style={{ color: t.subtext, textAlign: "center" }}>
              Could not load referral code. Try again later.
            </Text>
          )}

          <View style={{ height: 16 }} />

          <Pressable onPress={onClose} style={{ alignItems: "center", padding: 10 }}>
            <Text style={{ color: t.subtext, fontWeight: "700" }}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}