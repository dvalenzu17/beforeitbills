// app/(onboarding)/_ui.js
import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { SPACING } from "../lib/ui/tokens";
import { useTheme } from "../lib/theme";

export function Screen({ children }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: SPACING.screen }}>
      {children}
    </View>
  );
}

export function HeaderRow({ title, subtitle, onBack, right }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <Pressable onPress={onBack} style={{ padding: 10 }}>
        <Feather name="arrow-left" size={18} color={t.text} />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontWeight: "800", fontSize: 16 }}>{title}</Text>
        {subtitle ? <Text style={{ color: t.subtext, fontWeight: "600", marginTop: 3 }}>{subtitle}</Text> : null}
      </View>

      {right ? right : <View style={{ width: 38 }} />}
    </View>
  );
}

export function MattePanel({ title, icon, children }) {
  const t = useTheme();
  return (
    <View
      style={{
        padding: SPACING.screen,
        borderRadius: 20,
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.hairline,
        ...(t.shadowMd || {}),
        position: "relative",
      }}
    >
      {/* subtle “confidence rail” */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          backgroundColor: t.hairline,
        }}
      />

      {title ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          {icon ? (
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.surface2,
                borderWidth: 1,
                borderColor: t.hairline,
              }}
            >
              <Feather name={icon} size={16} color={t.text} />
            </View>
          ) : null}
          <Text style={{ color: t.subtext, fontWeight: "700" }}>{title}</Text>
        </View>
      ) : null}

      {children}
    </View>
  );
}

export function Label({ children, style }) {
  const t = useTheme();
  return <Text style={[{ color: t.subtext, fontWeight: "700", marginBottom: 8 }, style]}>{children}</Text>;
}

export function Field(props) {
  const t = useTheme();
  return (
    <TextInput
      {...props}
      placeholderTextColor={t.tertiary}
      style={[
        {
          backgroundColor: t.surface2,
          borderWidth: 1,
          borderColor: t.hairline,
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: t.text,
          fontWeight: "600",
          ...(t.shadowSm || {}),
        },
        props.style,
      ]}
    />
  );
}

export function Pill({ active, label, onPress, style }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: active ? t.accent : t.surface2,
          borderWidth: 1,
          borderColor: active ? t.accent : t.hairline,
          ...(t.shadowSm || {}),
        },
        style,
      ]}
    >
      <Text style={{ color: active ? "#fff" : t.text, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

export function ProgressPills({ total, index }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 6,
            borderRadius: 999,
            backgroundColor: i === index ? t.accent : t.hairline,
          }}
        />
      ))}
    </View>
  );
}