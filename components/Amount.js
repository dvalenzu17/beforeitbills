import { Text, View } from 'react-native';
import { useTheme } from '../lib/theme';

export default function Amount({ currency='$', value='0.00' }) {
  const t = useTheme();
  const [whole, cents] = String(value).split('.');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text style={{ color: t.text, opacity: 0.9, fontSize: 28, fontWeight: '800', marginRight: 6 }}>{currency}</Text>
      <Text style={{ color: t.text, fontSize: 48, fontWeight: '900', letterSpacing: 0.5 }}>{whole}</Text>
      <Text style={{ color: t.text, opacity: 0.9, fontSize: 24, fontWeight: '800', marginLeft: 2 }}>{cents ? `.${cents}` : ''}</Text>
    </View>
  );
}
