// components/SoftCard.js
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../lib/theme';
import { SPACING } from "../lib/ui/tokens";
export default function SoftCard({ children, style }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.soft,
          borderRadius: t.radius,
          borderWidth: 1,
          borderColor: t.border,
          padding: SPACING.screen,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
