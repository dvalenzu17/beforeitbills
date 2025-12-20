import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../lib/theme';

export default function RowBar({ label, right, pct = 0 }) {
  const t = useTheme();
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: t.text, fontWeight: '700' }}>{label}</Text>
        {!!right && <Text style={{ color: t.text }}>{right}</Text>}
      </View>
      <View style={{ height: 10, backgroundColor: t.surface, borderRadius: 999, borderWidth: 1, borderColor: t.border, overflow: 'hidden' }}>
        <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: t.accent }} />
      </View>
    </View>
  );
}
