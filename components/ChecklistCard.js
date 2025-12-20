// app/components/ChecklistCard.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import SoftCard from './SoftCard';
import { useTheme } from '../lib/theme';
import { useRouter } from 'expo-router';
import { A } from '../lib/arr';

export default function ChecklistCard({ tasks = [] }) {
  const t = useTheme();
  const r = useRouter();
  const done = A(tasks).filter(tk => tk?.done).length;
  const total = Math.max(1, A(tasks).length);
  const pct = Math.round((done / total) * 100);

  return (
    <SoftCard>
      <Text style={{ color: t.subtext, fontWeight:'700', marginBottom: 8 }}>Getting set up</Text>
      <View style={{ height: 8, backgroundColor: t.surface, borderRadius: 999, overflow: 'hidden', marginBottom: 8 }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: t.accent }} />
      </View>
      {A(tasks).map((tk, i) => (
        <TouchableOpacity key={i} onPress={() => tk?.route && r.push(tk.route)} style={{ paddingVertical: 8, opacity: tk?.done ? 0.6 : 1 }}>
          <Text style={{ color: t.text }}>{tk?.done ? '✅' : '⬜️'} {tk?.title || ''}</Text>
        </TouchableOpacity>
      ))}
    </SoftCard>
  );
}
