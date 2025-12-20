// app/components/Card.js
import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../lib/theme';



export default function Card({ children, style }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: t.border,
          padding: 12
        },
        style
      ]}
    >
      {children}
    </View>
  );
}
