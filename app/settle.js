// app/settle.js
import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { useStore } from '../lib/store';
import Card from '../components/Card';
import Button from '../components/Button';
import { A } from '../lib/arr';
import { formatMoney } from '../lib/utils';

function parseMembers(text) {
  return String(text || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(pair => {
      const [name, pct] = pair.split(':').map(x => x.trim());
      return { name, pct: Number(pct) || 0 };
    });
}

export default function Settle() {
  const t = useTheme();
  const { subs = [] } = useStore();

  const [membersText, setMembersText] = useState('');
  const members = useMemo(() => parseMembers(membersText), [membersText]);

  const totalMonthly = useMemo(() => {
    return A(subs).reduce((sum, s) => {
      const factor =
        s.cadence === 'yearly' ? 1 / 12 :
        s.cadence === 'quarterly' ? 1 / 3 :
        s.cadence === 'weekly' ? 4.345 : 1;
      return sum + (Number(s.amount) || 0) * factor;
    }, 0);
  }, [subs]);

  const shares = useMemo(() => {
    const pctSum = A(members).map(m => m.pct).reduce((a, b) => a + b, 0);
    if (pctSum <= 0) return [];
    return A(members).map(m => ({
      name: m.name,
      share: (m.pct / pctSum) * totalMonthly
    }));
  }, [members, totalMonthly]);

  const lines = useMemo(() => {
    // simple settle: everyone pays vs equal average
    if (A(shares).length === 0) return [];
    const avg = totalMonthly / A(shares).length;
    const deltas = A(shares).map(s => ({ name: s.name, delta: s.share - avg }));
    const creditors = A(deltas).filter(d => d.delta > 0).sort((a, b) => b.delta - a.delta);
    const debtors = A(deltas).filter(d => d.delta < 0).sort((a, b) => a.delta - b.delta);
    const out = [];
    let i = 0, j = 0;
    while (i < creditors.length && j < debtors.length) {
      const give = Math.min(creditors[i].delta, -debtors[j].delta);
      out.push({ from: debtors[j].name, to: creditors[i].name, amount: give });
      creditors[i].delta -= give;
      debtors[j].delta += give;
      if (creditors[i].delta <= 1e-6) i++;
      if (debtors[j].delta >= -1e-6) j++;
    }
    return out;
  }, [shares, totalMonthly]);

  const bullets = useMemo(() => {
    return A(lines).map(l => `${l.from} → ${l.to}: ${formatMoney(l.amount, 'USD')}`);
  }, [lines]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '900' }}>Settle Up</Text>

        <Card>
          <Text style={{ color: t.subtext, marginBottom: 6 }}>Members (name:percent, comma separated)</Text>
          <TextInput
            value={membersText}
            onChangeText={setMembersText}
            placeholder="Alice:50, Bob:50"
            placeholderTextColor={t.subtext}
            style={{ color: t.text, backgroundColor: t.surface, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: t.border }}
          />
        </Card>

        <Card>
          <Text style={{ color: t.subtext, marginBottom: 8, fontWeight: '700' }}>Monthly total</Text>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '900' }}>{formatMoney(totalMonthly, 'USD')}</Text>
        </Card>

        <Card>
          <Text style={{ color: t.subtext, marginBottom: 8, fontWeight: '700' }}>Shares</Text>
          {A(shares).length === 0 ? (
            <Text style={{ color: t.subtext }}>Add members to compute shares.</Text>
          ) : (
            A(shares).map((s, idx) => (
              <View key={`${s.name}-${idx}`} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ color: t.text, fontWeight: '800' }}>{s.name}</Text>
                <Text style={{ color: t.text }}>{formatMoney(s.share, 'USD')}/mo</Text>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={{ color: t.subtext, marginBottom: 8, fontWeight: '700' }}>Transfers</Text>
          {A(lines).length === 0 ? (
            <Text style={{ color: t.subtext }}>No transfers required.</Text>
          ) : (
            A(lines).map((l, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ color: t.text }}>{l.from} → {l.to}</Text>
                <Text style={{ color: t.text }}>{formatMoney(l.amount, 'USD')}</Text>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={{ color: t.subtext, marginBottom: 8, fontWeight: '700' }}>Summary</Text>
          {A(bullets).length === 0 ? (
            <Text style={{ color: t.subtext }}>Add members to generate a summary.</Text>
          ) : (
            A(bullets).map((b, i) => (
              <Text key={i} style={{ color: t.text }}>{b}</Text>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
