// app/components/CancelPlaybookCard.js
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../lib/theme';
import Card from './Card';
import Button from './Button';
import { findPlaybook } from '../lib/playbooks';
import { useStore } from '../lib/store';
import { A } from '../lib/arr';

const SUPABASE_FUNC_URL = 'https://YOUR-PROJECT.functions.supabase.co/ai-playbook'; // replace

export default function CancelPlaybookCard({ sub }) {
  const t = useTheme();
  const { updateSub, startCancelFollowup, clearCancelFollowup } = useStore();
  const [pb, setPb] = useState(null);
  const [loading, setLoading] = useState(true);
  const isInProgress = !!sub?.cancelFollowupAt;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!sub?.merchant) throw new Error('no merchant');
        const qs = new URLSearchParams({ q: sub.merchant }).toString();
        const res = await fetch(`${SUPABASE_FUNC_URL}?${qs}`);
        const data = await res.json();
        if (!alive) return;
        if (data?.status === 'ok' && A(data?.steps).length) {
          setPb({
            name: data.vendor || sub.merchant,
            webUrl: data.webUrl,
            iosUrl: data.iosUrl,
            androidUrl: data.androidUrl,
            supportUrl: data.supportUrl,
            steps: A(data.steps),
            notes: data.notes,
            source: 'ai'
          });
        } else {
          const local = findPlaybook(sub.merchant);
          setPb(local ? {
            name: local.name, webUrl: local.webUrl, iosUrl: local.iosUrl, androidUrl: local.androidUrl,
            supportUrl: local.supportUrl, steps: A(local.steps), notes: local.notes, source: 'local'
          } : null);
        }
      } catch {
        const local = findPlaybook(sub?.merchant || '');
        setPb(local ? { name: local.name, webUrl: local.webUrl, iosUrl: local.iosUrl, androidUrl: local.androidUrl,
          supportUrl: local.supportUrl, steps: A(local.steps), notes: local.notes, source: 'local' } : null);
      } finally {
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [sub?.merchant]);

  function open(url) {
    if (!url) return Alert.alert('No link', 'Use the steps below.');
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open link.'));
  }

  function markCanceled() {
    const tags = Array.from(new Set([...(sub?.tags || []), 'canceled']));
    updateSub(sub.id, { tags });
    Alert.alert('Marked canceled', 'Tagged as canceled.');
  }

  if (loading) {
    return (
      <Card>
        <Text style={{ color: t.subtext, marginBottom: 8, fontWeight: '700' }}>Cancel playbook</Text>
        <ActivityIndicator />
      </Card>
    );
  }

  if (!pb) return null;

  return (
    <Card>
      <Text style={{ color: t.subtext, fontWeight: '700', marginBottom: 8 }}>Cancel playbook</Text>
      <Text style={{ color: t.text, fontWeight: '900', marginBottom: 6 }}>{pb.name} {pb.source === 'ai' ? '• AI' : ''}</Text>
      {!!pb?.notes && <Text style={{ color: t.subtext, marginBottom: 8 }}>{pb.notes}</Text>}

      <View style={{ gap: 6, marginBottom: 10 }}>
        {A(pb?.steps).map((s, i) => <Text key={i} style={{ color: t.text }}>{s}</Text>)}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {!!pb?.webUrl && <Button title="Open cancel page" onPress={() => open(pb.webUrl)} variant="secondary" />}
        {!!pb?.iosUrl && <Button title="iOS Subscriptions" onPress={() => open(pb.iosUrl)} variant="secondary" />}
        {!!pb?.androidUrl && <Button title="Google Play" onPress={() => open(pb.androidUrl)} variant="secondary" />}
        {!!pb?.supportUrl && <Button title="Support" onPress={() => open(pb.supportUrl)} variant="secondary" />}
      </View>

      <View style={{ height: 10 }} />
      {!isInProgress ? (
        <Button title="Start 24h confirm timer" onPress={() => startCancelFollowup(sub.id, 24)} />
      ) : (
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.subtext }}>Follow-up: {new Date(sub.cancelFollowupAt).toLocaleString()}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Clear timer" onPress={() => clearCancelFollowup(sub.id)} variant="secondary" />
            <Button title="Mark canceled" onPress={markCanceled} />
          </View>
        </View>
      )}

      <TouchableOpacity
        onLongPress={async () => { await Clipboard.setStringAsync(pb.webUrl || pb.supportUrl || ''); Alert.alert('Copied', 'Link copied.'); }}
        activeOpacity={0.7}
        style={{ alignSelf: 'flex-start', marginTop: 8 }}
      >
        <Text style={{ color: t.subtext, fontSize: 12 }}>Long-press to copy link</Text>
      </TouchableOpacity>
    </Card>
  );
}
