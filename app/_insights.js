// app/insights.js
import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';

export default function InsightsRoot() {
  const t = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
      <View>
        <Text style={{ color: t.text, fontSize: 18 }}>Use the Insights tab below.</Text>
      </View>
    </SafeAreaView>
  );
}
