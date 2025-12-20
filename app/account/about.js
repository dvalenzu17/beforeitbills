import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';
export default function About() {
    const t = useTheme();
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: t.text }}>About</Text>
        <Text style={{ marginTop: 8, fontSize: 14, color: t.muted || '#888' }}>
          Version info and credits
        </Text>
      </SafeAreaView>
    );
  }