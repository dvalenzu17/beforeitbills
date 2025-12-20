// app/components/Button.js
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../lib/theme';


export default function Button({
  title = 'Continue',
  onPress,
  variant = 'primary',   // 'primary' | 'secondary' | 'danger'
  disabled = false,
  style,
  textStyle,
}) {
  const t = useTheme();

  const bg =
    variant === 'secondary' ? t.soft :
    variant === 'danger' ? '#832b2b' :
    t.accent;

  const border =
    variant === 'secondary' ? t.border :
    variant === 'danger' ? '#a84b4b' :
    'transparent';

  const color =
    variant === 'secondary' ? t.text :
    '#fff';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
      style={[
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: 1,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <Text style={[{ color, fontWeight: '900' }, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}
