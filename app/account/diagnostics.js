// app/account/diagnostics.js
import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';

import { useTheme } from '../../lib/theme';
import { getErrorLogs, clearErrorLogs } from '../../lib/logger';
import Card from '../../components/Card';
import Button from '../../components/Button';

export default function Diagnostics() {
  // Not accessible in production builds
  if (!__DEV__) {
    return <Redirect href="/(tabs)" />;
  }

  const t = useTheme();
  const [logs, setLogs] = useState([]);

  async function refresh() {
    const list = await getErrorLogs();
    setLogs(list);
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '900' }}>Diagnostics</Text>
        <Text style={{ color: t.subtext, marginTop: -6 }}>Local error logs (last {logs.length}).</Text>

        <Card>
          <Button title="Refresh" onPress={refresh} />
          <View style={{ height: 10 }} />
          <Button
            title="Clear logs"
            variant="ghost"
            onPress={async () => {
              await clearErrorLogs();
              await refresh();
            }}
          />
        </Card>

        {logs.length === 0 ? (
          <Card>
            <Text style={{ color: t.subtext }}>No logs 🎉</Text>
          </Card>
        ) : (
          logs.map((l) => (
            <Card key={l.id}>
              <Text style={{ color: t.text, fontWeight: '900' }}>{l.name}</Text>
              <Text style={{ color: t.subtext, marginTop: 4 }}>{l.message}</Text>
              <Text style={{ color: t.subtext, marginTop: 8, fontSize: 12 }}>{l.ts}</Text>
              {l.context ? (
                <Text style={{ color: t.subtext, marginTop: 6, fontSize: 12 }}>
                  {JSON.stringify(l.context)}
                </Text>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
