// app/(tabs)/insights.js
import React, { useEffect, useMemo } from 'react';
import { ScrollView, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import { formatMoney } from '../../lib/utils';
import { A } from '../../lib/arr';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';

import SoftCard from '../../components/SoftCard';
import Card from '../../components/Card';
import PrettyDonut from '../../components/PrettyDonut';

export default function Insights() {
  const t = useTheme();
  const { subs = [], fetchSubs } = useStore();

  useEffect(() => {
    fetchSubs?.();
  }, [fetchSubs]);

  // === Monthly Spend ===
  const monthlySpend = useMemo(() => {
    return A(subs).reduce((sum, s) => {
      const factor =
        s.cadence === 'yearly' ? 1 / 12 :
        s.cadence === 'quarterly' ? 1 / 3 :
        s.cadence === 'weekly' ? 4.345 : 1;
      return sum + (Number(s.amount) || 0) * factor;
    }, 0);
  }, [subs]);

  // === Annual Spend Projection ===
  const annualSpend = useMemo(() => monthlySpend * 12, [monthlySpend]);

  // === Category Breakdown ===
  const byCategory = useMemo(() => {
    const m = {};
    for (const s of A(subs)) {
      const key = s.category || 'Other';
      const factor =
        s.cadence === 'yearly' ? 1 / 12 :
        s.cadence === 'quarterly' ? 1 / 3 :
        s.cadence === 'weekly' ? 4.345 : 1;
      m[key] = m[key] || { label: key, value: 0, items: [] };
      m[key].value += (Number(s.amount) || 0) * factor;
      m[key].items.push(s);
    }
    return A(Object.values(m)).sort((a, b) => b.value - a.value);
  }, [subs]);

  // === Top Vendors ===
  const topVendors = useMemo(() => {
    const m = {};
    for (const s of A(subs)) {
      const key = s.merchant;
      const factor =
        s.cadence === 'yearly' ? 1 / 12 :
        s.cadence === 'quarterly' ? 1 / 3 :
        s.cadence === 'weekly' ? 4.345 : 1;
      m[key] = (m[key] || 0) + (Number(s.amount) || 0) * factor;
    }
    return A(Object.entries(m || {}))
      .map(([merchant, value]) => ({ merchant, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [subs]);

  // === Upcoming Payments (next renewals) ===
  const upcomingPayments = useMemo(() => {
    return A(subs)
      .filter(s => s.nextRenewal)
      .sort((a, b) => new Date(a.nextRenewal) - new Date(b.nextRenewal))
      .slice(0, 4);
  }, [subs]);

  // === Next 30 Days Cashflow ===
  const cashflow30 = useMemo(() => {
    const today = new Date();
    const cutoff = new Date();
    cutoff.setDate(today.getDate() + 30);

    return A(subs).reduce((sum, s) => {
      if (s.nextRenewal) {
        const d = new Date(s.nextRenewal);
        if (d >= today && d <= cutoff) {
          sum += Number(s.amount) || 0;
        }
      }
      return sum;
    }, 0);
  }, [subs]);

  // === Top Drains (annualized biggest costs) ===
  const topDrains = useMemo(() => {
    return A(subs)
      .map(s => ({
        merchant: s.merchant,
        annual: (Number(s.amount) || 0) *
          (s.cadence === 'yearly' ? 1 :
           s.cadence === 'quarterly' ? 4 :
           s.cadence === 'monthly' ? 12 : 52)
      }))
      .sort((a, b) => b.annual - a.annual)
      .slice(0, 5);
  }, [subs]);

  // === Shared Subscriptions ===
  const sharedSubs = useMemo(() => {
    return A(subs).filter(s => s.shared); // expecting subs to have shared + owner + myShare fields
  }, [subs]);

  // === Recent Transactions (placeholder, depends on data structure) ===
  const recentTransactions = useMemo(() => {
    return A(subs)
      .flatMap(s => s.transactions || [])
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [subs]);

  const segments = A(byCategory).map(c => ({ label: c.label, value: c.value }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 48 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: t.text }}>Insights</Text>

        {/* Hero Donut */}
        <SoftCard style={{ alignItems: 'center', paddingVertical: 24 }}>
          <PrettyDonut
            segments={segments.length ? segments : [{ label: 'No data', value: 1 }]}
            centerLabel="Monthly"
            centerValue={formatMoney(monthlySpend, 'USD')}
          />
          <Text style={{ marginTop: 12, fontSize: 14, color: t.subtext }}>
            Your monthly burn rate
          </Text>
        </SoftCard>

        {/* Projected Annual Spend */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="trending-up-outline" size={18} color={t.subtext} style={{ marginRight: 6 }} />
            <Text style={{ color: t.subtext, fontWeight: '700' }}>Projected Annual Spend</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: t.text }}>
            {formatMoney(annualSpend, 'USD')}
          </Text>
        </Card>

        {/* Next 30 Days Cashflow */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="calendar-clear-outline" size={18} color={t.subtext} style={{ marginRight: 6 }} />
            <Text style={{ color: t.subtext, fontWeight: '700' }}>Next 30 Days Cashflow</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '800', color: t.text }}>
            {formatMoney(cashflow30, 'USD')}
          </Text>
          <Text style={{ color: t.subtext, marginTop: 4 }}>Expected renewals in next 30 days</Text>
        </Card>

        {/* Upcoming Payments */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="calendar-outline" size={18} color={t.subtext} style={{ marginRight: 6 }} />
            <Text style={{ color: t.subtext, fontWeight: '700' }}>Upcoming Payments</Text>
          </View>
          {A(upcomingPayments).length === 0 ? (
            <Text style={{ color: t.subtext }}>No upcoming renewals.</Text>
          ) : (
            A(upcomingPayments).map((p, i) => (
              <View
                key={i}
                style={{
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: t.text, fontWeight: '600' }}>{p.merchant}</Text>
                <Text style={{ color: t.text }}>
                  {formatMoney(p.amount, 'USD')} / {p.cadence}
                </Text>
              </View>
            ))
          )}
        </Card>

        {/* Top Drains */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="flame-outline" size={18} color="orange" style={{ marginRight: 6 }} />
            <Text style={{ color: t.subtext, fontWeight: '700' }}>Top Drains</Text>
          </View>
          {A(topDrains).length === 0 ? (
            <Text style={{ color: t.subtext }}>No data yet.</Text>
          ) : (
            A(topDrains).map((d, i) => (
              <View
                key={i}
                style={{
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: t.text, fontWeight: '600' }}>{d.merchant}</Text>
                <Text style={{ color: 'orange' }}>{formatMoney(d.annual, 'USD')}/yr</Text>
              </View>
            ))
          )}
        </Card>

        {/* Shared Subscriptions */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="people-outline" size={18} color={t.subtext} style={{ marginRight: 6 }} />
            <Text style={{ color: t.subtext, fontWeight: '700' }}>Shared Subscriptions</Text>
          </View>
          {A(sharedSubs).length === 0 ? (
            <Text style={{ color: t.subtext }}>No shared subscriptions added.</Text>
          ) : (
            A(sharedSubs).map((s, i) => (
              <View
                key={i}
                style={{
                  paddingVertical: 10,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.border,
                }}
              >
                <Text style={{ color: t.text, fontWeight: '600' }}>{s.merchant}</Text>
                <Text style={{ color: t.subtext }}>
                  {s.owner === 'me'
                    ? 'You pay this, others owe you'
                    : `Paid by ${s.owner}, you owe ${formatMoney(s.myShare, 'USD')}`}
                </Text>
              </View>
            ))
          )}
        </Card>

        {/* Recent Transactions */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="time-outline" size={18} color={t.subtext} style={{ marginRight: 6 }} />
            <Text style={{ color: t.subtext, fontWeight: '700' }}>Recent Transactions</Text>
          </View>
          {A(recentTransactions).length === 0 ? (
            <Text style={{ color: t.subtext }}>No recent activity.</Text>
          ) : (
            A(recentTransactions).map((tx, i) => (
              <View
                key={i}
                style={{
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: t.border,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: t.text }}>{tx.merchant || 'Unknown'}</Text>
                <Text style={{ color: tx.amount < 0 ? 'red' : 'green' }}>
                  {formatMoney(tx.amount, 'USD')}
                </Text>
              </View>
            ))
          )}
        </Card>

        {/* Suggestions */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="bulb-outline" size={18} color={t.subtext} style={{ marginRight: 6 }} />
            <Text style={{ color: t.subtext, fontWeight: '700' }}>Suggestions</Text>
          </View>
          {A(byCategory).length > 1 ? (
            <>
              <Text style={{ color: t.text, marginBottom: 6 }}>
                • Consolidate overlapping categories like multiple streaming services.
              </Text>
              <Text style={{ color: t.text, marginBottom: 6 }}>
                • Track free trials and cancel before they bill.
              </Text>
              <Text style={{ color: t.text }}>
                • Use Cancel Center for subs you haven’t used in a while.
              </Text>
            </>
          ) : (
            <Text style={{ color: t.subtext }}>Add more subscriptions to unlock suggestions.</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
