// components/StreakCard.js
import React from 'react';
import { View, Text } from 'react-native';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../lib/theme';
import { nextMilestone } from '../lib/streak';

export default function StreakCard({ streak }) {
  const t = useTheme();
  const { t: tt } = useTranslation();

  if (!streak || streak.current < 1) return null;

  const current = streak.current;
  const best = streak.best || current;
  const next = nextMilestone(current);
  const progress = Math.min(current / next, 1);

  const motivationKey =
    current >= 30 ? 'streak.legendStatus' :
    current >= 14 ? 'streak.onFire' :
    current >= 7  ? 'streak.onARoll' :
    current >= 3  ? 'streak.keepGoing' :
                    'streak.started';

  return (
    <MotiView
      from={{ opacity: 0, translateY: 8 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', damping: 18, mass: 0.35, stiffness: 220 }}
      style={{
        backgroundColor: t.surface,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: t.hairline,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}
    >
      {/* Flame + count */}
      <View style={{ alignItems: 'center', minWidth: 54 }}>
        <Text style={{ fontSize: 30 }}>🔥</Text>
        <Text style={{ color: t.text, fontWeight: '900', fontSize: 24, lineHeight: 28, marginTop: 2 }}>
          {current}
        </Text>
        <Text style={{ color: t.subtext, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {current === 1 ? tt('streak.day') : tt('streak.days')}
        </Text>
      </View>

      {/* Progress toward next milestone */}
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 14 }}>
          {tt(motivationKey)}
        </Text>
        <Text style={{ color: t.subtext, fontSize: 12 }}>
          {tt('streak.toNext', { n: next - current, milestone: next })}
        </Text>

        {/* Amber progress bar */}
        <View style={{ height: 5, borderRadius: 3, backgroundColor: t.hairline, overflow: 'hidden' }}>
          <MotiView
            from={{ width: '0%' }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ type: 'timing', duration: 900, delay: 350 }}
            style={{ height: '100%', borderRadius: 3, backgroundColor: '#F59E0B' }}
          />
        </View>

        {best > current && (
          <Text style={{ color: t.tertiary, fontSize: 11 }}>
            {tt('streak.best', { n: best })}
          </Text>
        )}
      </View>
    </MotiView>
  );
}
