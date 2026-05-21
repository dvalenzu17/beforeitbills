// components/BrandAvatar.js
import React, { useEffect, useState } from "react";
import { View, Image, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { resolveBrandMeta } from "../lib/brand/brandResolver";
import { getBillIcon } from "../lib/billIcons";
import { useTheme } from "../lib/theme";

/**
 * BrandAvatar
 *
 * For subscriptions: resolves brand logo/favicon via brandResolver.
 * For bills: renders a themed Feather vector icon using billIconKey.
 *
 * Props:
 *   domain      – brand domain (subscriptions)
 *   name        – display name fallback
 *   size        – diameter in px (default 44)
 *   billIconKey – if set, renders a bill icon instead of brand resolution
 */
export default function BrandAvatar({ domain, name, size = 44, billIconKey, logoUrl: propLogoUrl }) {
  const t = useTheme();
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    // Don't hit the brand resolver for bills or when a direct logo URL is provided.
    if (billIconKey || propLogoUrl) return;

    let alive = true;
    (async () => {
      const m = await resolveBrandMeta({ domain, name });
      if (alive) setMeta(m);
    })();
    return () => { alive = false; };
  }, [domain, name, billIconKey, propLogoUrl]);

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size * 0.28,   // squircle feel
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  // ── Bill: vector icon ─────────────────────────────────────────────────────
  if (billIconKey) {
    const billMeta = getBillIcon(billIconKey);
    return (
      <View
        style={[
          containerStyle,
          {
            borderColor: billMeta.color + "55",
            backgroundColor: billMeta.color + "18",
          },
        ]}
      >
        <Feather name={billMeta.icon} size={size * 0.44} color={billMeta.color} />
      </View>
    );
  }

  // ── Subscription: brand logo / initials ───────────────────────────────────
  const initials =
    (name || "")
      .replace(/[+&]/g, " ")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  const uri = propLogoUrl || meta?.logoUrl || meta?.faviconUrl;
  const ring = meta?.color || t.hairline;

  return (
    <View
      style={[
        containerStyle,
        {
          borderColor: ring,
          backgroundColor: t.surface2,
        },
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size - 10, height: size - 10, borderRadius: 8 }}
          resizeMode="contain"
          onError={() => setMeta((m) => (m ? { ...m, logoUrl: "", faviconUrl: "" } : m))}
        />
      ) : (
        <Text style={{ color: t.text, fontWeight: "900", fontSize: size * 0.32 }}>
          {initials}
        </Text>
      )}
    </View>
  );
}