// app/subs.js
import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useStore } from '../lib/store';
import { useTheme } from '../lib/theme';
import { formatMoney } from '../lib/utils';

export default function Subscriptions() {
  const t = useTheme();
  const r = useRouter();
  const { subs, fetchSubs } = useStore();

  useEffect(() => {
    fetchSubs?.();
  }, [fetchSubs]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '900', marginBottom: 12 }}>All subscriptions</Text>
        <FlatList
          data={subs}
          keyExtractor={(x) => String(x.id)}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: t.border, marginVertical: 8 }} />
          )}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => r.push(`/sub/${item.id}`)}
              style={{ paddingVertical: 8 }}
            >
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 16 }}>{item.merchant}</Text>
              <Text style={{ color: t.subtext }}>
                {formatMoney(item.amount, item.currency || 'USD')} · {item.cadence} · {item.nextRenewal}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ color: t.subtext }}>No subscriptions yet.</Text>}
        />
      </View>
    </SafeAreaView>
  );
}
