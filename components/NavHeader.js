// components/NavHeader.js
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

export default function NavHeader({ title, subtitle, onBack, right }) {
  const t = useTheme();

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity
          onPress={onBack}
          activeOpacity={0.8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            backgroundColor: t.surface2,
            borderWidth: 1,
            borderColor: t.hairline,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Ionicons name="chevron-back" size={20} color={t.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 18, fontWeight: '900' }}>{title}</Text>
          {subtitle ? (
            <Text style={{ color: t.subtext, marginTop: 2, fontWeight: '700' }}>{subtitle}</Text>
          ) : null}
        </View>

        {right ? <View style={{ marginLeft: 10 }}>{right}</View> : null}
      </View>
    </View>
  );
}