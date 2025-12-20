import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../lib/theme';
import { useStore } from '../lib/store';
import CardView from '../components/Card';
import Button from '../components/Button';

export default function Cards() {
  const t = useTheme();
  const { cards, loadCards, addCard, deleteCard } = useStore();

  useEffect(() => {
    loadCards?.();
  }, [loadCards]);
  const [label, setLabel] = useState('');
  const [last4, setLast4] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');

  function save() {
    if (!label.trim()) return Alert.alert('Validation', 'Label required.');
    const m = parseInt(expMonth, 10), y = parseInt(expYear, 10);
    if (!m || m < 1 || m > 12 || !y) return Alert.alert('Validation', 'Enter valid expiry.');
    addCard({ label: label.trim(), last4: last4.trim(), expMonth: m, expYear: y });
    setLabel(''); setLast4(''); setExpMonth(''); setExpYear('');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: t.text }}>Cards</Text>

        <CardView>
          <Text style={{ color: t.subtext, marginBottom: 6, fontWeight: '700' }}>Add card</Text>
          <TextInput placeholder="Label (e.g., Chase Sapphire)" placeholderTextColor={t.subtext} value={label} onChangeText={setLabel}
            style={{ borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />
          <View style={{ height: 10 }} />
          <TextInput placeholder="Last 4 (optional)" placeholderTextColor={t.subtext} value={last4} onChangeText={setLast4} keyboardType="number-pad"
            style={{ borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />
          <View style={{ height: 10 }} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput placeholder="MM" placeholderTextColor={t.subtext} value={expMonth} onChangeText={setExpMonth} keyboardType="number-pad"
              style={{ flex:1, borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />
            <TextInput placeholder="YYYY" placeholderTextColor={t.subtext} value={expYear} onChangeText={setExpYear} keyboardType="number-pad"
              style={{ flex:1, borderWidth:1, borderColor:t.border, borderRadius:t.radius, padding:12, color:t.text }} />
          </View>
          <View style={{ height: 12 }} />
          <Button title="Save" onPress={save} />
        </CardView>

        <CardView>
          <Text style={{ color: t.subtext, marginBottom: 12, fontWeight: '700' }}>Your cards</Text>
          {cards.length === 0 ? (
            <Text style={{ color: t.subtext }}>No cards yet.</Text>
          ) : (
            <FlatList
              data={cards}
              keyExtractor={c => c.id}
              renderItem={({ item }) => (
                <View style={{ paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: t.text, fontWeight: '800' }}>{item.label}</Text>
                    <Text style={{ color: t.subtext, fontSize: 12 }}>
                      {item.last4 ? `•••• ${item.last4} • ` : ''}exp {String(item.expMonth).padStart(2,'0')}/{item.expYear}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => {
                    Alert.alert('Delete card', `Remove ${item.label}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => deleteCard(item.id) },
                    ]);
                  }}>
                    <Text style={{ color: '#EF4444', fontWeight: '800' }}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: t.border }} />}
            />
          )}
        </CardView>
      </View>
    </SafeAreaView>
  );
}
