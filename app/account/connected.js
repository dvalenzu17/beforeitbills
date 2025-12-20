// app/account/connected.js
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '../../lib/theme';
import { useStore } from '../../lib/store';
import { connectGmail, scanGmail } from '../../lib/mail';
import Card from '../../components/Card';
import Button from '../../components/Button';

export default function Connected() {
  const t = useTheme();
  const r = useRouter();
  const { mail, loadMail, setMail } = useStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadMail?.();
  }, [loadMail]);

  async function onConnect() {
    try {
      setBusy(true);
      const out = await connectGmail();
      if (!out.ok) return;
      await setMail({ connected: true, provider: 'google' });
      Alert.alert('Connected', 'Gmail connected (read-only).');
    } catch (e) {
      Alert.alert('Connect failed', e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onScan() {
    try {
      setBusy(true);
      const out = await scanGmail();
      const suggestions = Array.isArray(out.suggestions) ? out.suggestions : [];
      await setMail({ lastScanAt: new Date().toISOString(), suggestions });
      Alert.alert('Scan complete', `Found ${suggestions.length} potential subscriptions.`);
    } catch (e) {
      Alert.alert('Scan failed', e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const lastScan = mail.lastScanAt ? new Date(mail.lastScanAt).toLocaleString() : 'Never';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, gap: 14 }}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '900' }}>Connected mail</Text>

        <Card>
          <Text style={{ color: t.text, fontWeight: '900', fontSize: 16 }}>Gmail</Text>
          <Text style={{ color: t.subtext, marginTop: 6 }}>
            Status: {mail.connected ? 'Connected ✅ (read-only)' : 'Not connected'}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 6 }}>
            Last scan: {lastScan}
          </Text>

          <View style={{ height: 14 }} />
          {!mail.connected ? (
            <Button title={busy ? 'Connecting…' : 'Connect Gmail'} onPress={onConnect} disabled={busy} />
          ) : (
            <View style={{ gap: 10 }}>
              <Button title={busy ? 'Scanning…' : 'Scan for subscription charges'} onPress={onScan} disabled={busy} />
              <TouchableOpacity
                onPress={() => r.push('/import-mail')}
                style={{ paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: t.accent, fontWeight: '800' }}>
                  Review results ({mail.suggestions?.length || 0}) →
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </Card>

        <Card>
          <Text style={{ color: t.text, fontWeight: '900', fontSize: 16 }}>Privacy</Text>
          <Text style={{ color: t.subtext, marginTop: 6, lineHeight: 18 }}>
            We only request Gmail read access and only look for receipts / subscription charge signals.
            No sending, no deleting. You can disconnect anytime.
          </Text>
        </Card>

        <TouchableOpacity onPress={() => r.back()} style={{ paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ color: t.subtext }}>Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
