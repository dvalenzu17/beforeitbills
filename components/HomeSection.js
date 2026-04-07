// components/HomeSection.js
import React from "react";
import { View } from "react-native";
import { useTheme } from "../lib/theme";
import * as T from "./ui/Text";

export default function HomeSection({
  title,
  subtitle,
  right,
  children,
  style,
  titleStyle,
}) {
  const t = useTheme();

  return (
    <View style={[{ gap: 10 }, style]}>
      {(title || right) ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            {title ? (
              <T.H2 style={[{ color: t.subtext, marginTop: 2 }, titleStyle]}>
                {title}
              </T.H2>
            ) : null}
            {subtitle ? (
              <T.Sub style={{ marginTop: 4 }}>{subtitle}</T.Sub>
            ) : null}
          </View>

          {right ? <View>{right}</View> : null}
        </View>
      ) : null}

      {children}
    </View>
  );
}
