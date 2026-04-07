// components/ui/Text.js
import React from "react";
import { Text } from "react-native";
import { TYPO } from "../../lib/ui/tokens";
import { useTheme } from "../../lib/theme";

export function Title({ children, style, ...props }) {
  const t = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: t.text,
          fontSize: TYPO.title,
          fontWeight: "800", // ↓ was too loud
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function H2({ children, style, ...props }) {
  const t = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: t.text,
          fontSize: TYPO.h2,
          fontWeight: "700", // ↓ calmer hierarchy
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, style, ...props }) {
  const t = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: t.text,
          fontSize: TYPO.bodySize,
          fontWeight: "600", // ↓ readable, not aggressive
          lineHeight: TYPO.bodyLH,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Sub({ children, style, ...props }) {
  const t = useTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: t.subtext,
          fontSize: TYPO.subSize,
          fontWeight: "600",
          lineHeight: TYPO.subLH,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
