import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../lib/store';
import { formatMoney } from '../../lib/utils';
import { useTheme } from '../../lib/theme';
import Card from '../../components/Card';
import Button from '../../components/Button';
import CancelPlaybookCard from '../../components/CancelPlaybookCard';

export default function SubDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { subs, updateSub, deleteSub } = useStore();
  const t = useTheme();
  const sub = useMemo(() => subs.find(s => String(s.id) === String(id)), [subs, id]);

  const [merchant, setMerchant] = useState(sub?.merchant ?? '');
  const [amount, setAmount] = useState(String(sub?.amount ?? ''));
  const [cadence, setCadence] = useState(sub?.cadence ?? 'monthly');
  const [nextRenewal, setNextRenewal] = useState(sub?.nextRenewal ?? '');
  const [tags, setTags] = useState((sub?.tags || []).join(', '));

  const [isTrial, setIsTrial] = useState(!!sub?.trial?.isTrial);
  const [trialEnd, setTrialEnd] = useState(sub?.trial?.end || '');

  if (!sub) {
    return <SafeAreaView style={{ flex: 1 }}><View style={{ padding: 20 }}><Text>Subscription not found.</Text></View></SafeAreaView>;
  }

  function save() {
    const a = parseFloat(amount);
    if (!merchant.trim() || isNaN(a) || a <= 0) { Alert.alert('Validation', 'Fix the fields.'); return; }
    const trial = isTrial && trialEnd ? { isTrial: true, end: trialEnd } : null;
    updateSub(sub.id, { merchant: merchant.trim(), amount: a, cadence, nextRenewal, tags: tags.split(',').map(t=>t.trim()).filter(Boolean), trial });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  }

  function remove() {
    Alert.alert('Delete', `Delete ${sub.merchant}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteSub(sub.id); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); router.replace('/(tabs)'); } }
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: t.text, marginBottom: 12 }}>{sub.merchant}</Text>
        <Text style={{ color: t.subtext, marginBottom: 12 }}>{sub.cadence} • {formatMoney(sub.amount, sub.currency)} • next {sub.nextRenewal}</Text>

        {/* Edit core fields */}
        <Card>
          <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: '700' }}>Merchant</Text>
          <TextInput value={merchant} onChangeText={setMerchant} style={{ borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />

          <View style={{ height: 16 }} />
          <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: '700' }}>Amount</Text>
          <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />

          <View style={{ height: 16 }} />
          <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: '700' }}>Cadence</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {['monthly','yearly','quarterly','weekly'].map(c => (
              <Text key={c}
                style={{ backgroundColor: cadence===c? t.primary : t.surface, color: cadence===c? '#000' : t.text, paddingVertical:8, paddingHorizontal:12, borderRadius:t.radius, fontWeight:'800', borderWidth: cadence===c?0:1, borderColor:t.border }}
                onPress={() => setCadence(c)}
              >{c}</Text>
            ))}
          </View>

          <View style={{ height: 16 }} />
          <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: '700' }}>Next Renewal (YYYY-MM-DD)</Text>
          <TextInput value={nextRenewal} onChangeText={setNextRenewal} style={{ borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />

          <View style={{ height: 16 }} />
          <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: '700' }}>Tags</Text>
          <TextInput value={tags} onChangeText={setTags} placeholder="streaming, family"
            placeholderTextColor={t.subtext} style={{ borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />
        </Card>

        {/* Trial block */}
        <Card>
          <Text style={{ color: t.subtext, marginBottom: 10, fontWeight: '700' }}>Trial</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: t.text, fontWeight: '800' }}>Is free trial?</Text>
            <Switch
              value={isTrial}
              onValueChange={(v) => setIsTrial(v)}
              thumbColor={isTrial ? '#000' : undefined}
              trackColor={{ false: t.border, true: t.primary }}
            />
          </View>
          {isTrial && (
            <>
              <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: '700' }}>Trial ends (YYYY-MM-DD)</Text>
              <TextInput value={trialEnd} onChangeText={setTrialEnd} style={{ borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />
              <Text style={{ color: t.subtext, marginTop: 6, fontSize: 12 }}>You’ll get reminders 3 days and 1 day before this date.</Text>
            </>
          )}
        </Card>

        {/* Cancel playbook */}
        <CancelPlaybookCard sub={sub} />

        <Card>
          <Button title="Save" onPress={save} />
          <TouchableOpacity onPress={remove} style={{ backgroundColor:'#FEE2E2', paddingVertical:12, borderRadius:t.radius, marginTop: 10, alignItems:'center' }}>
            <Text style={{ color:'#B91C1C', fontWeight:'800' }}>Delete</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
