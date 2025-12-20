// app/account/security.js
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';

export default function Security() {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: t.text }}>Login & Security</Text>
      <Text style={{ marginTop: 8, fontSize: 14, color: t.muted || '#888' }}>
        Placeholder for login & security settings
      </Text>
    </SafeAreaView>
  );
}
