// app/components/PrettyDonut.js
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { G, Circle } from 'react-native-svg';
import { useTheme } from '../lib/theme';
import { A } from '../lib/arr';

export default function PrettyDonut({ segments = [], size=200, stroke=18, gap=4, centerLabel='Total', centerValue='$0' }) {
  const t = useTheme();
  const r = (size/2) - stroke/2;
  const C = 2 * Math.PI * r;
  const total = A(segments).reduce((a,b)=>a+(Number(b?.value)||0), 0) || 1;

  let offset = 0;
  const arcs = A(segments).map((s, i) => {
    const pct = (Number(s?.value)||0) / total;
    const len = (C - gap * A(segments).length) * pct;
    const dash = `${len} ${C}`;
    const o = offset;
    offset += len + gap;
    return { ...s, dash, o };
  });

  const palette = [t.grad1 || '#7C3AED', t.grad2 || '#8B5CF6', t.grad3 || '#C4B5FD', '#7DD3FC', '#FDE68A', '#FCA5A5'];

  return (
    <View style={{ alignItems:'center' }}>
      <Svg width={size} height={size}>
        <G rotation="-90" originX={size/2} originY={size/2}>
          <Circle cx={size/2} cy={size/2} r={r} stroke={t.surface} strokeWidth={stroke} fill="none" />
          {A(arcs).map((a, i) => (
            <Circle key={i}
              cx={size/2} cy={size/2} r={r}
              stroke={palette[i % palette.length]}
              strokeWidth={stroke}
              strokeDasharray={a.dash}
              strokeDashoffset={-a.o}
              strokeLinecap="round"
              fill="none"
            />
          ))}
        </G>
      </Svg>
      <View style={{ position:'absolute', alignItems:'center', justifyContent:'center', top: size/2-24 }}>
        <Text style={{ color: t.subtext, fontSize: 12 }}>{centerLabel}</Text>
        <Text style={{ color: t.text, fontSize: 20, fontWeight:'900' }}>{centerValue}</Text>
      </View>
    </View>
  );
}
