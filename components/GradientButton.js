// app/components/GradientButton.js
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../lib/theme';

export default function GradientButton({ title = 'Continue', onPress, disabled }) {
  const t = useTheme();
  const colors = [t.grad1 || '#7C3AED', t.grad2 || '#8B5CF6', t.grad3 || '#C4B5FD'];
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.85}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          paddingVertical: 14,
          borderRadius: 14,
          alignItems: 'center',
          opacity: disabled ? 0.6 : 1
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '900' }}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}
