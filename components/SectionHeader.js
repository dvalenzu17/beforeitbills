import { Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

export default function SectionHeader({ title, action }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: t.spacing(2) }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: t.text }}>{title}</Text>
      {action}
    </View>
  );
}
