// app/components/ListItem.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { formatMoney } from '../lib/utils';

export default function ListItem({
  merchant = '',
  subtitle = '',
  amount = 0,
  currency = 'USD',
  onPress
}) {
  const t = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{
          width: 36, height: 36, borderRadius: 10,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: t.soft, borderWidth: 1, borderColor: t.border, marginRight: 12
        }}>
          <Feather name="credit-card" size={18} color={t.text} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontWeight: '800' }}>{merchant}</Text>
          {!!subtitle && <Text style={{ color: t.subtext, marginTop: 2 }}>{subtitle}</Text>}
        </View>

        <Text style={{ color: t.text, fontWeight: '800' }}>
          {formatMoney(amount, currency)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
