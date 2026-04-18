import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTheme } from '../lib/theme';
import Card from '../components/Card';
import Button from '../components/Button';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../lib/supabase';
import { backupSubs, restoreSubs, signOutAll } from '../lib/sync';
import { useStore } from '../lib/store';

export default function Account() {
  const t = useTheme();
  const { subs, addSub, deleteSub } = useStore();
  const [email, setEmail] = useState(null);

  useFocusEffect(useCallback(() => {
    let ok = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (ok) setEmail(data.user?.email ?? null);
    })();
    return () => { ok = false; };
  }, []));

  async function doBackup() {
    try { await backupSubs(subs); alert('Backed up to cloud.'); } catch (e) { alert(String(e?.message ?? e)); }
  }
  async function doRestore() {
    try {
      const cloud = await restoreSubs();
      (subs || []).forEach(s => deleteSub(s.id));
      (cloud || []).forEach(s => addSub(s));
      alert('Restored from cloud.');
    } catch (e) { alert(String(e?.message ?? e)); }
  }
  async function doSignOut() {
    await signOutAll(); setEmail(null); alert('Signed out.');
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: t.text }}>Account</Text>

        <Card>
          {email ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="person-circle" size={36} color={t.text} />
                <View style={{ marginLeft: 10 }}>
                  <Text style={{ color: t.text, fontWeight: '800' }}>{email}</Text>
                  <Text style={{ color: t.subtext }}>Signed in</Text>
                </View>
              </View>
              <Button title="Backup to Cloud" onPress={doBackup} style={{ marginBottom: 10 }} />
              <Button title="Restore from Cloud" onPress={doRestore} variant="secondary" />
              <TouchableOpacity onPress={doSignOut} style={{ marginTop: 14 }}>
                <Text style={{ color: '#FCA5A5', fontWeight: '800' }}>Sign out</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={{ color: t.subtext, marginBottom: 12 }}>
                You’re not signed in. Sign in to sync across devices.
              </Text>
              <Link href="/login" asChild>
                <Button title="Sign in / Create account" />
              </Link>
            </>
          )}
        </Card>

        <Card>
          <Text style={{ color: t.subtext, marginBottom: 10, fontWeight: '700' }}>App</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Export (CSV)</Text>
            <Text style={{ color: t.subtext }}>Coming soon</Text>
          </View>
          <View style={{ height: 1, backgroundColor: t.border, marginVertical: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
            <Text style={{ color: t.text, fontWeight: '700' }}>Delete account</Text>
            <Text style={{ color: t.subtext }}>Coming soon</Text>
          </View>
        </Card>
      </View>
    </SafeAreaView>
  );
}
