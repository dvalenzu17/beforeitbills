// components/SocialProofBanner.js
// Shows aggregate community activity. Static baseline numbers —
// replace STATS values with real API data when backend supports it.
import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';

const STATS = [
  { icon: 'users',        labelKey: 'social.trackingLabel', value: '14,209' },
  { icon: 'trending-down', labelKey: 'social.avgSavedLabel', value: '$138' },
  { icon: 'x-circle',    labelKey: 'social.cancelledLabel', value: '2,847' },
];

export default function SocialProofBanner() {
  const t = useTheme();
  const { t: tt } = useTranslation();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, mass: 0.35, stiffness: 220 }}
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: t.hairline,
        backgroundColor: t.surface,
        paddingTop: 14,
        paddingBottom: 16,
        paddingHorizontal: 16,
        gap: 12,
      }}
    >
      <Text style={{ color: t.subtext, fontWeight: '700', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
        {tt('social.title')}
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {STATS.map((s) => (
          <View key={s.icon} style={{ alignItems: 'center', flex: 1, gap: 4 }}>
            <Feather name={s.icon} size={15} color={t.accent} />
            <Text style={{ color: t.text, fontWeight: '900', fontSize: 16 }}>{s.value}</Text>
            <Text style={{ color: t.subtext, fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 13 }}>
              {tt(s.labelKey)}
            </Text>
          </View>
        ))}
      </View>
    </MotiView>
  );
}
