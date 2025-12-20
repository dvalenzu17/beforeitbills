// app/components/GradientHeader.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { formatMoney } from '../lib/utils';

export default function GradientHeader({
  title = 'Personal · All accounts',
  amount = 0,
  onPressSearch,
}) {
  const t = useTheme();

  // Hardcode a valid colors array so expo-linear-gradient never sees undefined
  const colors = [t.grad1 || '#7C3AED', t.grad2 || '#8B5CF6', t.grad3 || '#C4B5FD'];

  return (
    <View style={{ padding: 16, paddingBottom: 12 }}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          borderRadius: 20,
          paddingVertical: 18,
          paddingHorizontal: 16,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '700' }}>{title}</Text>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4 }}>
              {formatMoney(amount, 'USD')}/mo
            </Text>
          </View>

          <TouchableOpacity
            onPress={onPressSearch}
            activeOpacity={0.8}
            style={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              borderRadius: 14,
              paddingVertical: 10,
              paddingHorizontal: 12,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather name="search" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '800' }}>Search</Text>
            </View>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}
