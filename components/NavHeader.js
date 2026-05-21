// components/NavHeader.js
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';

export default function NavHeader({ title, subtitle, onBack, right }) {
  const t = useTheme();

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14 }}>
      {(onBack || right) && (
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: pressed ? t.surface2 : t.surface,
                borderWidth: 1,
                borderColor: t.hairline,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              <Feather name="arrow-left" size={18} color={t.text} />
            </Pressable>
          ) : <View />}
          {right ? <View>{right}</View> : null}
        </View>
      )}
      <Text style={{
        fontSize: 28,
        fontWeight: '900',
        color: t.text,
        letterSpacing: -0.5,
        lineHeight: 32,
      }}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={{
          fontSize: 13,
          fontWeight: '500',
          color: t.subtext,
          marginTop: 4,
        }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
