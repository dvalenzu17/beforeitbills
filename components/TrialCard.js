// app/components/TrialCard.js
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../lib/theme';
import { useStore } from '../lib/store';
import SoftCard from './SoftCard';
import { A } from '../lib/arr';

export default function TrialCard() {
  const t = useTheme();
  const { subs = [] } = useStore();

  const trials = useMemo(() => {
    const now = new Date();
    return A(subs)
      .filter(s => s?.trial?.isTrial && s?.trial?.end && new Date(s.trial.end) > now)
      .sort((a,b)=>new Date(a.trial.end) - new Date(b.trial.end));
  }, [subs]);

  if (A(trials).length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
      <SoftCard>
        <Text style={{ color: t.subtext, fontWeight: '700', marginBottom: 8 }}>Trial Shield</Text>
        <View style={{ gap: 6 }}>
          {A(trials).slice(0, 4).map(s => {
            const days = Math.ceil((new Date(s.trial.end) - new Date()) / (1000*60*60*24));
            return (
              <View key={s.id} style={{ flexDirection:'row', justifyContent:'space-between' }}>
                <Text style={{ color: t.text, fontWeight: '800' }}>{s.merchant}</Text>
                <Text style={{ color: t.text }}>{days} days left</Text>
              </View>
            );
          })}
        </View>
        <TouchableOpacity style={{ marginTop: 8 }}>
          <Text style={{ color: t.accent, fontWeight: '800' }}>Manage trials</Text>
        </TouchableOpacity>
      </SoftCard>
    </View>
  );
}
