// app/add.js
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../lib/theme';
import { useStore } from '../lib/store';
import Button from '../components/Button';

export default function Add() {
  const t = useTheme();
  const r = useRouter();
  const { addSub } = useStore();

  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState('');
  const [currency] = useState('USD');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [nextRenewal, setNextRenewal] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [shared, setShared] = useState(false);
  const [sharedByMe, setSharedByMe] = useState(true);

  function formatDate(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}-${dd}-${yyyy}`;
  }

  function save() {
    const a = Number(amount);
    if (!merchant || !Number.isFinite(a)) {
      alert('Enter a valid merchant and amount');
      return;
    }
    addSub({
      merchant,
      amount: a,
      currency,
      cadence: billingCycle,
      nextRenewal: formatDate(nextRenewal),
      shared,
      sharedByMe,
    });
    r.back();
  }

  // Shared card style with shadow
  const cardStyle = {
    backgroundColor: t.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 40 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '900' }}>
          Add Subscription
        </Text>

        {/* Merchant */}
        <View style={cardStyle}>
          <Text style={{ color: t.subtext, marginBottom: 6 }}>Merchant</Text>
          <TextInput
            value={merchant}
            onChangeText={setMerchant}
            placeholder="Netflix"
            placeholderTextColor={t.subtext}
            style={{
              color: t.text,
              backgroundColor: t.surface,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: t.border,
            }}
          />
        </View>

        {/* Amount */}
        <View style={cardStyle}>
          <Text style={{ color: t.subtext, marginBottom: 6 }}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="12.99"
            placeholderTextColor={t.subtext}
            style={{
              color: t.text,
              backgroundColor: t.surface,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: t.border,
            }}
          />
        </View>

        {/* Billing Cycle */}
        <View style={cardStyle}>
          <Text style={{ color: t.subtext, marginBottom: 6 }}>Billing Cycle</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {['Daily', 'Weekly', 'Monthly', 'Yearly'].map(option => (
              <Pressable
                key={option}
                onPress={() => setBillingCycle(option.toLowerCase())}
                style={{
                  flex: 1,
                  marginHorizontal: 4,
                  paddingVertical: 12,
                  borderRadius: 12,
                  backgroundColor:
                    billingCycle === option.toLowerCase() ? '#6C63FF' : t.bg,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 3,
                  elevation: 2,
                }}
              >
                <Text
                  style={{
                    color: billingCycle === option.toLowerCase() ? '#fff' : t.text,
                    fontWeight: '600',
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Next Renewal */}
        <View style={cardStyle}>
          <Text style={{ color: t.subtext, marginBottom: 6 }}>Next Renewal</Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              backgroundColor: t.bg,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: t.border,
            }}
          >
            <Text style={{ color: t.text }}>{formatDate(nextRenewal)}</Text>
          </Pressable>
          {showDatePicker && (
            <DateTimePicker
              value={nextRenewal}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, date) => {
                setShowDatePicker(false);
                if (date) setNextRenewal(date);
              }}
            />
          )}
        </View>

        {/* Shared Subscription */}
        <View style={cardStyle}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: t.subtext }}>Shared Subscription</Text>
            <Switch
              value={shared}
              onValueChange={setShared}
              trackColor={{ true: '#6C63FF', false: t.border }}
              thumbColor="#fff"
            />
          </View>
          {shared && (
            <View style={{ marginTop: 16, flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setSharedByMe(true)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: sharedByMe ? '#6C63FF' : t.bg,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: sharedByMe ? '#fff' : t.text }}>Paid by me</Text>
              </Pressable>
              <Pressable
                onPress={() => setSharedByMe(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderRadius: 12,
                  backgroundColor: !sharedByMe ? '#6C63FF' : t.bg,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: !sharedByMe ? '#fff' : t.text }}>
                  Paid by others
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        <Button title="Save" onPress={save} />
      </ScrollView>
    </SafeAreaView>
  );
}
