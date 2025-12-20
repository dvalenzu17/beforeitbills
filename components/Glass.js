// app/components/Glass.js
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../lib/theme';

// Simple glass card; exports default to satisfy Expo Router requirement
export default function Glass({ children, style }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderColor: t.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
