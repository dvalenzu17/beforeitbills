// app/cancel-center.js
import React, { useMemo } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { useStore } from '../lib/store';
import Card from '../components/Card';
import Button from '../components/Button';
import { A } from '../lib/arr';

export default function CancelCenter() {
  const t = useTheme();
  const { subs = [] } = useStore();

  const canceled = useMemo(() => A(subs).filter(s => A(s?.tags).includes('canceled')), [subs]);
  const candidates = useMemo(() => {
    return A(subs).filter(s => {
      const tags = A(s?.tags);
      const isTrial = s?.trial?.isTrial;
      const lowSpend = (Number(s?.amount) || 0) <= 6;
      const dupCat = !!A(subs).find(o => o !== s && (o?.category || 'Other') === (s?.category || 'Other'));
      return !tags.includes('canceled') && (isTrial || dupCat || lowSpend);
    });
  }, [subs]);

  const inProgress = useMemo(() => A(subs).filter(s => !!s?.cancelFollowupAt), [subs]);

  const byCategory = useMemo(() => {
    const m = {};
    for (const s of A(subs)) {
      const k = s?.category || 'Other';
      m[k] = (m[k] || 0) + (Number(s?.amount) || 0);
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [subs]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '900' }}>Cancel Center</Text>

        <Card>
          <Text style={{ color: t.subtext, fontWeight: '700', marginBottom: 8 }}>Quick insights</Text>
          <Text style={{ color: t.text }}>Categories by spend</Text>
          {A(Object.entries(byCategory)).length === 0 ? (
            <Text style={{ color: t.subtext, marginTop: 6 }}>No data yet.</Text>
          ) : (
            A(Object.entries(byCategory)).map(([cat, total]) => (
              <View key={String(cat)} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                <Text style={{ color: t.text, fontWeight: '800' }}>{cat}</Text>
                <Text style={{ color: t.text }}>${Number(total).toFixed(2)}</Text>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={{ color: t.subtext, fontWeight: '700', marginBottom: 8 }}>In progress</Text>
          {A(inProgress).length === 0 ? (
            <Text style={{ color: t.subtext }}>Nothing in progress.</Text>
          ) : (
            A(inProgress).map(s => (
              <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={{ color: t.text }}>{s.merchant}</Text>
                <Text style={{ color: t.text }}>{new Date(s.cancelFollowupAt).toLocaleString()}</Text>
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={{ color: t.subtext, fontWeight: '700', marginBottom: 8 }}>Suggestions</Text>
          {A(candidates).length === 0 ? (
            <Text style={{ color: t.subtext }}>No suggestions right now.</Text>
          ) : (
            A(candidates).map(s => (
              <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={{ color: t.text, fontWeight: '800' }}>{s.merchant}</Text>
                <Button title="View" onPress={() => { /* route to /sub/[id] if desired */ }} />
              </View>
            ))
          )}
        </Card>

        <Card>
          <Text style={{ color: t.subtext, fontWeight: '700', marginBottom: 8 }}>Canceled</Text>
          {A(canceled).length === 0 ? (
            <Text style={{ color: t.subtext }}>No canceled subscriptions.</Text>
          ) : (
            A(canceled).map(s => (
              <View key={s.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
                <Text style={{ color: t.text }}>{s.merchant}</Text>
                <Text style={{ color: t.text }}>Tagged canceled</Text>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
