import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';

import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { formatMoney } from '../../lib/utils';

export default function Home() {
  const { subs, user, fetchSubs } = useStore();
  const t = useTheme();
  const r = useRouter();

  useEffect(() => {
    fetchSubs?.();
  }, [fetchSubs]);

  const monthlySpend = useMemo(() => {
    return subs.reduce((sum, s) => {
      const factor =
        s.cadence === 'yearly' ? 1 / 12 :
        s.cadence === 'quarterly' ? 1 / 3 :
        s.cadence === 'weekly' ? 4.345 : 1;
      return sum + (Number(s.amount) || 0) * factor;
    }, 0);
  }, [subs]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' :
    hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>
      <Text style={{ color: t.text, fontSize: 20, fontWeight: '700', marginBottom: 8 }}>
        {greeting}, {user?.user_metadata?.name || user?.email?.split('@')?.[0] || 'User'}
      </Text>
      <Text style={{ color: t.text, fontSize: 28, fontWeight: '900' }}>
        {formatMoney(monthlySpend, 'USD')}/mo
      </Text>

      <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={{ flex: 1, backgroundColor: t.surface, borderRadius: 14, padding: 12 }}
        >
          <Text style={{ color: t.subtext }}>Active</Text>
          <Text style={{ color: t.text, fontWeight: '900', fontSize: 22 }}>{subs.length}</Text>
        </MotiView>
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          style={{ flex: 1, backgroundColor: t.surface, borderRadius: 14, padding: 12 }}
        >
          <Text style={{ color: t.subtext }}>Monthly total</Text>
          <Text style={{ color: t.text, fontWeight: '900', fontSize: 22 }}>
            {formatMoney(monthlySpend, 'USD')}
          </Text>
        </MotiView>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(); r.push('/add'); }}
          style={{ flex: 1, backgroundColor: t.accent, padding: 14, borderRadius: 14, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '900' }}>Add subscription</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(); r.push('/account/connected'); }}
          style={{ flex: 1, backgroundColor: t.surface, padding: 14, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: t.border }}
        >
          <Text style={{ color: t.text, fontWeight: '900' }}>Connect mail</Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 24, flex: 1 }}>
        <Text style={{ color: t.subtext, fontWeight: '700', marginBottom: 12 }}>Recent / Upcoming</Text>
        <FlatList
          data={subs}
          keyExtractor={(x) => String(x.id)}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => r.push(`/sub/${item.id}`)}
              style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}
            >
              <Text style={{ color: t.text, fontWeight: '700' }}>{item.merchant}</Text>
              <Text style={{ color: t.subtext }}>
                {formatMoney(item.amount, item.currency || 'USD')} · {item.cadence} · {item.nextRenewal}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={{ color: t.subtext }}>No subscriptions yet.</Text>}
        />
        <TouchableOpacity onPress={() => r.push('/subs')} style={{ marginTop: 12, alignSelf: 'center' }}>
          <Text style={{ color: t.accent, fontWeight: '700' }}>See all →</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
