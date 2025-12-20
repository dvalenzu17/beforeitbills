// app/components/SearchSheet.js
import React, { useState, useMemo } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { useTheme } from '../lib/theme';
import { useStore } from '../lib/store';
import { A } from '../lib/arr';

export default function SearchSheet({ visible, onClose }) {
  const t = useTheme();
  const { subs = [] } = useStore();
  const [q, setQ] = useState('');

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return A(subs).filter(s =>
      String(s.merchant || '').toLowerCase().includes(needle) ||
      String(s.category || '').toLowerCase().includes(needle) ||
      A(s.tags).join(' ').toLowerCase().includes(needle)
    );
  }, [q, subs]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <View style={{
          backgroundColor: t.bg,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: 16,
          borderTopWidth: 1,
          borderColor: t.border,
          maxHeight: '70%'
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={{ color: t.text, fontWeight: '900', fontSize: 16 }}>Search</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ color: t.accent, fontWeight: '800' }}>Close</Text></TouchableOpacity>
          </View>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Netflix, mail, streaming…"
            placeholderTextColor={t.subtext}
            style={{
              color: t.text, backgroundColor: t.surface, borderRadius: 12,
              padding: 12, borderWidth: 1, borderColor: t.border, marginBottom: 12
            }}
          />

          <FlatList
            data={A(results)}
            keyExtractor={x => String(x.id)}
            renderItem={({ item }) => (
              <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <Text style={{ color: t.text, fontWeight: '800' }}>{item.merchant}</Text>
                <Text style={{ color: t.subtext, marginTop: 2 }}>{item.category || 'Other'}</Text>
              </View>
            )}
            ListEmptyComponent={<Text style={{ color: t.subtext }}>Type to search subscriptions.</Text>}
          />
        </View>
      </View>
    </Modal>
  );
}
