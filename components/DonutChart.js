// app/components/DonutChart.js
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { useTheme } from '../lib/theme';
import { A } from '../lib/arr';

function arcPath(cx, cy, r, startAngle, endAngle) {
  const sx = cx + r * Math.cos(startAngle);
  const sy = cy + r * Math.sin(startAngle);
  const ex = cx + r * Math.cos(endAngle);
  const ey = cy + r * Math.sin(endAngle);
  const largeArc = endAngle - startAngle <= Math.PI ? 0 : 1;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} Z`;
}

export default function DonutChart({
  data = [],
  size = 180,
  inner = 60
}) {
  const t = useTheme();
  const C = size;
  const R = size / 2;

  const clean = A(data).map(d => ({ label: d?.label ?? '', value: Number(d?.value) || 0 }));
  const total = clean.reduce((a, b) => a + b.value, 0);

  const segments = useMemo(() => {
    if (total === 0) return [];
    let angle = -Math.PI / 2;
    return clean.map((d, i) => {
      const slice = (d.value / total) * Math.PI * 2;
      const start = angle;
      const end = angle + slice;
      angle = end;
      return {
        key: `${d.label}-${i}`,
        label: d.label,
        value: d.value,
        path: arcPath(R, R, R, start, end)
      };
    });
  }, [data]);

  const palette = [t.grad1 || '#7C3AED', t.grad2 || '#8B5CF6', t.grad3 || '#C4B5FD', '#7DD3FC', '#FDE68A', '#FCA5A5'];

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={C} height={C}>
        <G>
          {A(segments).map((s, i) => <Path key={s.key} d={s.path} fill={palette[i % palette.length]} />)}
          <Path d={arcPath(R, R, inner, 0, Math.PI * 2)} fill={t.bg} />
        </G>
      </Svg>
      <Text style={{ color: t.subtext, marginTop: 6 }}>{total === 0 ? 'No data' : ''}</Text>
    </View>
  );
}
