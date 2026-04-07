// app/_error.js
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '../lib/theme';
import { logError } from '../lib/logger';
import Button from '../components/Button';

export default function GlobalError({ error, retry }) {
  const t = useTheme();
  const r = useRouter();

  useEffect(() => {
    logError(error, { type: 'router', where: 'app/_error' });
  }, [error]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, padding: 20, justifyContent: 'center', gap: 12 }}>
      <Text style={{ color: t.text, fontSize: 26, fontWeight: '900' }}>Well… that wasn’t supposed to happen.</Text>
      <Text style={{ color: t.subtext, lineHeight: 20 }}>
        BeforeItBills hit an error. Your data is still safe on this device.
      </Text>

      <View style={{ height: 10 }} />

      <Button
        title="Try again"
        onPress={() => {
          try { retry?.(); } catch { r.replace('/(tabs)'); }
        }}
      />

      <Button
        title="Go to Home"
        variant="ghost"
        onPress={() => r.replace('/(tabs)')}
      />


    </View>
  );
}