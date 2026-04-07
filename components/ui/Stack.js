// components/ui/Stack.js
import React from "react";
import { View } from "react-native";
import { SPACING } from "../../lib/ui/tokens";

export function VStack({ children, gap = SPACING.cardGap, style }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function HStack({ children, gap = SPACING.rowGap, style }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap }, style]}>{children}</View>;
}
