// app/components/SparkLine.js
import React, { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Polyline, Circle } from 'react-native-svg';
import { useTheme } from '../lib/theme';
import { A } from '../lib/arr';

export default function SparkLine({ values = [], width=160, height=40, padding=6 }) {
  const t = useTheme();
  const data = A(values);
  const min = Math.min(...data, 0);
  const max = Math.max(...data, 1);
  const range = Math.max(1e-6, max - min);

  const points = useMemo(() => {
    const n = Math.max(1, data.length);
    return data.map((v, i) => {
      const x = padding + (i/(n-1||1)) * (width - padding*2);
      const y = height - padding - ((v - min) / range) * (height - padding*2);
      return { x, y };
    });
  }, [values, width, height, padding]);

  return (
    <View>
      <Svg width={width} height={height}>
        <Polyline
          fill="none"
          stroke={t.accent}
          strokeWidth="2"
          points={A(points).map(p => `${p.x},${p.y}`).join(' ')}
        />
        {A(points).map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={t.accent} />)}
      </Svg>
    </View>
  );
}
