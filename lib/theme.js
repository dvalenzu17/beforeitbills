// lib/theme.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Platform, useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_MODE_KEY = "settings.themeMode"; // "system" | "light" | "dark"

// --- Brand palette inspired by your logo (blue/indigo + green pop) ---
const BRAND = {
  indigo: "#2F4DFF",  // deep-ish brand blue
  indigo2: "#5B7CFF", // softer blue
  violet: "#7C3AED",  // your current grad vibe
  mint: "#34D399",    // green check vibe
  mint2: "#22C55E",
  sky: "#7DD3FC",
};

// Shared sizing + helpers
const BASE = {
  radius: 18,
  r16: 16,
  r20: 20,
  r24: 24,
  spacing: (n = 1) => 8 * Number(n || 0),
};

function matteShadow(level, color = "#000") {
  // less blur + less opacity than typical “glow” shadows
  const isIOS = Platform.OS === "ios";
  const map = {
    sm: { y: 2, blur: 8,  opacity: 0.10, elevation: 2 },
    md: { y: 6, blur: 16, opacity: 0.12, elevation: 4 },
    lg: { y: 10, blur: 24, opacity: 0.14, elevation: 6 },
  };
  const v = map[level] || map.md;

  return isIOS
    ? {
        shadowColor: color,
        shadowOffset: { width: 0, height: v.y },
        shadowOpacity: v.opacity,
        shadowRadius: v.blur,
      }
    : { elevation: v.elevation };
}

const shadow = (level = "md", shadowColor = "#000") =>
  Platform.select({
    ios: level === "sm"
      ? {
          shadowColor,
          shadowOpacity: 0.14,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
        }
      : level === "lg"
      ? {
          shadowColor,
          shadowOpacity: 0.22,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
        }
      : {
          shadowColor,
          shadowOpacity: 0.18,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 10 },
        },
    android: level === "sm"
      ? { elevation: 6 }
      : level === "lg"
      ? { elevation: 14 }
      : { elevation: 10 },
    default: {},
  });

// DARK: glossy, deep, neon-ish accents
const DARK = {
  ...BASE,

  // Brand / accents
  primary: BRAND.violet,
  accent: BRAND.sky,
  accent2: BRAND.mint,
  grad1: BRAND.indigo,
  grad2: BRAND.violet,
  grad3: "#C4B5FD",

  // Surfaces
  bg: "#0B0F17",
  bg2: "#070A10",
  surface: "#161B24",
  surface2: "#1C2230",
  card: "#161B24",

  // Text
  text: "#EAF0FF",
  subtext: "rgba(234,240,255,0.75)",
  tertiary: "rgba(234,240,255,0.45)",

  // Lines
  border: "rgba(255,255,255,0.08)",
  hairline: "rgba(255,255,255,0.12)",

  // Overlays
  soft: "rgba(255,255,255,0.04)",
  muted: "rgba(232,236,241,0.65)",

  // Shadows (slightly blue-tinted looks more “brand”)
  shadowSm: matteShadow("sm", "#000"),
  shadowMd: matteShadow("md", "#000"),
  shadowLg: matteShadow("lg", "#000"),
};

// LIGHT: brand-tinted, not sterile white — mirrors dark's matte feel
const LIGHT = {
  ...BASE,

  primary: BRAND.indigo,
  accent: BRAND.indigo,
  accent2: BRAND.mint2,

  grad1: "#E8EEF8",
  grad2: "#DDE6F4",
  grad3: "#A7F3D0",

  // Opaque tinted ground — not transparent, so Screen/SafeAreaView have a real bg
  bg: "#EEF2FA",
  bg2: "#E6ECF6",

  // Surfaces sit slightly above the bg, with a blue tint
  surface: "#F6F8FE",
  surface2: "#EDF1FB",
  card: "#F6F8FE",

  text: "#0D1321",
  subtext: "rgba(13,19,33,0.68)",
  tertiary: "rgba(13,19,33,0.45)",

  border: "rgba(47,77,255,0.07)",
  hairline: "rgba(47,77,255,0.10)",

  soft: "rgba(47,77,255,0.04)",

  shadowSm: matteShadow("sm", "#1A2A5E"),
  shadowMd: matteShadow("md", "#1A2A5E"),
  shadowLg: matteShadow("lg", "#1A2A5E"),
};


const Ctx = createContext({
  theme: DARK,
  mode: "system",
  setThemeMode: async () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // "light" | "dark" | null
  const [mode, setMode] = useState("system");

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_MODE_KEY);
        if (saved === "system" || saved === "light" || saved === "dark") setMode(saved);
      } catch {}
    })();
  }, []);

  const resolved = mode === "system" ? (systemScheme || "dark") : mode;
  const theme = resolved === "light" ? LIGHT : DARK;

  const setThemeMode = async (next) => {
    setMode(next);
    try {
      await AsyncStorage.setItem(THEME_MODE_KEY, next);
    } catch {}
  };

  const value = useMemo(() => ({ theme, mode, setThemeMode }), [theme, mode]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Keep your existing API: useTheme() returns tokens
export function useTheme() {
  return useContext(Ctx).theme;
}

// Settings page needs mode + setter
export function useThemeSettings() {
  const { mode, setThemeMode } = useContext(Ctx);
  return { mode, setThemeMode };
}