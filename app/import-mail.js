// app/import-mail.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../lib/theme';
import { useStore } from '../lib/store';
import { formatMoney } from '../lib/utils';
import Card from '../components/Card';
import Button from '../components/Button';

export default function ImportMail() {
  const t = useTheme();
  const r = useRouter();
  const { mail, loadMail, setMail, addSub } = useStore();
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    loadMail?.();
  }, [loadMail]);

  async function onImport(item) {
    try {
      setBusyId(String(item.id || item.messageId || item.merchant));
      const sub = {
        merchant: item.merchant,
        amount: Number(item.amount) || 0,
        currency: (item.currency || 'USD').toUpperCase(),
        cadence: item.cadence || 'monthly',
        nextRenewal: item.nextRenewal || null,
        category: item.category || 'Other',
        tags: ['email-scan'],
      };
      const { error } = await addSub(sub);
      if (error) throw error;

      const remaining = (mail.suggestions || []).filter((s) => s !== item);
      await setMail({ suggestions: remaining });
      Alert.alert('Added', `${item.merchant} added to your list.`);
    } catch (e) {
      Alert.alert('Import failed', e?.message || String(e));
    } finally {
      setBusyId(null);
    }
  }

  const suggestions = Array.isArray(mail.suggestions) ? mail.suggestions : [];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, gap: 12, flex: 1 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '900' }}>Mail scan results</Text>
        <Text style={{ color: t.subtext, lineHeight: 18 }}>
          These look like subscription charges. Review and import what’s legit.
        </Text>

        <FlatList
          data={suggestions}
          keyExtractor={(x, i) => String(x.id || x.messageId || `${x.merchant}-${i}`)}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <Card>
              <Text style={{ color: t.text, fontWeight: '900', fontSize: 16 }}>{item.merchant || 'Unknown'}</Text>
              <Text style={{ color: t.subtext, marginTop: 6 }}>
                {formatMoney(item.amount, item.currency || 'USD')} · {item.cadence || 'monthly'}
              </Text>
              {item.rawSubject ? (
                <Text style={{ color: t.subtext, marginTop: 6 }} numberOfLines={2}>
                  “{item.rawSubject}”
                </Text>
              ) : null}
              <View style={{ height: 12 }} />
              <Button
                title={busyId === String(item.id || item.messageId || item.merchant) ? 'Adding…' : 'Add subscription'}
                onPress={() => onImport(item)}
                disabled={!!busyId}
              />
              <TouchableOpacity
                onPress={async () => {
                  const remaining = suggestions.filter((s) => s !== item);
                  await setMail({ suggestions: remaining });
                }}
                style={{ paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: t.subtext, fontWeight: '800' }}>Dismiss</Text>
              </TouchableOpacity>
            </Card>
          )}
          ListEmptyComponent={<Text style={{ color: t.subtext, marginTop: 16 }}>No scan results yet.</Text>}
        />

        <TouchableOpacity onPress={() => r.back()} style={{ paddingVertical: 12, alignItems: 'center' }}>
          <Text style={{ color: t.accent, fontWeight: '800' }}>Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
