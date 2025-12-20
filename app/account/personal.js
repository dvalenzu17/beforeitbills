// app/account/personal.js
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';

export default function PersonalInfo() {
  const t = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: t.text }}>
        Personal Information Page
      </Text>
      <Text style={{ marginTop: 8, fontSize: 14, color: t.muted || '#888' }}>
        Placeholder content here
      </Text>
    </SafeAreaView>
  );
}
