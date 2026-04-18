// components/RecapSheet.js
import React, { useMemo, useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Share, PanResponder, Animated } from 'react-native';
import { useTheme } from '../lib/theme';
import { useStore } from '../lib/store';
import { formatMoney } from '../lib/utils';
import { track } from '../lib/analytics';

function Chip({ active, label, onPress, t }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? t.accent : t.hairline,
        backgroundColor: active ? t.accent + '22' : t.surface2,
      }}
    >
      <Text style={{ color: active ? t.accent : t.subtext, fontWeight: '900' }}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionCard({ children, t }) {
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: t.hairline,
        padding: 16,
      }}
    >
      {children}
    </View>
  );
}

function DecisionBadge({ decision, t }) {
  const colour =
    decision === 'Cancel' ? '#FF3B30' :
    decision === 'Downgrade/Pause' ? '#FF9F0A' :
    '#30D158';
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: colour + '22',
        borderWidth: 1,
        borderColor: colour + '55',
        alignSelf: 'flex-start',
        marginTop: 4,
      }}
    >
      <Text style={{ color: colour, fontWeight: '900', fontSize: 12 }}>{decision}</Text>
    </View>
  );
}

export default function RecapSheet({ visible, onClose }) {
  const t = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) translateY.setValue(g.dy);
    },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 80) {
        onClose?.();
        translateY.setValue(0);
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      }
    },
  })).current;

  const subs = useStore((s) => s.subs);
  const recap = useStore((s) => s.recap);
  const saveRecapAnswer = useStore((s) => s.saveRecapAnswer);
  const completeRecap = useStore((s) => s.completeRecap);
  const getRecapRecommendations = useStore((s) => s.getRecapRecommendations);

  const mk = recap?.currentMonth;
  const month = recap?.months?.[mk] || { completedAt: null, answers: {} };
  const answers = month.answers || {};
  const completed = !!month.completedAt;

  const recs = useMemo(() => getRecapRecommendations?.() || [], [getRecapRecommendations, subs, recap]);

  const buckets = useMemo(() => {
    const out = { cancel: 0, downgrade: 0, keep: 0 };
    for (const x of recs) {
      if (x.decision === 'Cancel') out.cancel += 1;
      else if (x.decision === 'Downgrade/Pause') out.downgrade += 1;
      else out.keep += 1;
    }
    return out;
  }, [recs]);

  const totalMonthly = useMemo(
    () => (subs || []).reduce((s, x) => s + (Number(x.amount) || 0), 0),
    [subs]
  );

  const potentialSavings = useMemo(
    () => recs
      .filter((x) => x.decision === 'Cancel' || x.decision === 'Downgrade/Pause')
      .reduce((s, x) => s + (x.estMonthly || 0), 0),
    [recs]
  );

  async function markDone() {
    await completeRecap?.();
    Alert.alert('Recap saved', 'Now go cancel at least one. You know which one.');
    onClose?.();
  }

  async function handleShare() {
    const lines = [
      `📊 My ${mk} subscription recap — BeforeItBills`,
      ``,
      `💸 Total monthly spend: ${formatMoney(totalMonthly, 'USD')}`,
      `✂️  Cancel: ${buckets.cancel}  |  ⬇️ Downgrade: ${buckets.downgrade}  |  ✅ Keep: ${buckets.keep}`,
    ];

    if (potentialSavings > 0) {
      lines.push(`💰 Potential savings: ${formatMoney(potentialSavings, 'USD')}/mo`);
    }

    if (recs.length > 0) {
      lines.push('');
      lines.push('Top decisions:');
      recs.slice(0, 4).forEach((x) => {
        const icon = x.decision === 'Cancel' ? '❌' : x.decision === 'Downgrade/Pause' ? '⬇️' : '✅';
        lines.push(`${icon} ${x.sub.merchant} — ${x.decision}`);
      });
    }

    lines.push('');
    lines.push('Track yours → beforeitbills.com');

    try {
      track('recap_shared');
      await Share.share({ message: lines.join('\n') });
    } catch (e) {
      // user dismissed — no-op
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Animated.View
          style={{
            backgroundColor: t.bg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderTopWidth: 1,
            borderColor: t.hairline,
            maxHeight: '92%',
            transform: [{ translateY }],
          }}
        >
          {/* Drag handle */}
          <View {...panResponder.panHandlers} style={{ paddingVertical: 10, alignItems: 'center' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.hairline }} />
          </View>
          {/* Header */}
          <View
            style={{
              paddingHorizontal: 16,
              paddingBottom: 12,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottomWidth: 1,
              borderBottomColor: t.hairline,
            }}
          >
            <View>
              <Text style={{ color: t.text, fontSize: 18, fontWeight: '900' }}>Monthly Recap</Text>
              <Text style={{ color: t.subtext, marginTop: 2, fontWeight: '700', fontSize: 13 }}>{mk}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
              <TouchableOpacity onPress={handleShare} activeOpacity={0.75}>
                <Text style={{ color: t.accent, fontWeight: '900' }}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} activeOpacity={0.75}>
                <Text style={{ color: t.subtext, fontWeight: '900' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 14 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={{ color: t.subtext, lineHeight: 19 }}>
              Rate each subscription → get keep / downgrade / cancel recommendations.
            </Text>

            {/* Summary */}
            <SectionCard t={t}>
              <Text style={{ color: t.text, fontWeight: '900', marginBottom: 12 }}>
                This month's decisions
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[
                  { label: 'Cancel', value: buckets.cancel, colour: '#FF3B30' },
                  { label: 'Downgrade', value: buckets.downgrade, colour: '#FF9F0A' },
                  { label: 'Keep', value: buckets.keep, colour: '#30D158' },
                ].map((x) => (
                  <View
                    key={x.label}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 14,
                      backgroundColor: t.surface2,
                      borderWidth: 1,
                      borderColor: t.hairline,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: x.colour, fontWeight: '900', fontSize: 22 }}>{x.value}</Text>
                    <Text style={{ color: t.subtext, fontWeight: '700', fontSize: 12, marginTop: 4 }}>{x.label}</Text>
                  </View>
                ))}
              </View>
              {potentialSavings > 0 && (
                <View
                  style={{
                    marginTop: 12,
                    padding: 12,
                    borderRadius: 14,
                    backgroundColor: '#30D15822',
                    borderWidth: 1,
                    borderColor: '#30D15844',
                  }}
                >
                  <Text style={{ color: '#30D158', fontWeight: '900' }}>
                    💰 Potential savings: {formatMoney(potentialSavings, 'USD')}/mo
                  </Text>
                </View>
              )}
            </SectionCard>

            {/* Questionnaire */}
            {subs.length === 0 ? (
              <SectionCard t={t}>
                <Text style={{ color: t.subtext, lineHeight: 19 }}>
                  Add subscriptions first — then Recap becomes your savings cheat code.
                </Text>
              </SectionCard>
            ) : null}

            {(subs || []).map((s) => {
              const a = answers[String(s.id)] || {};
              const usageDays = String(a.usageDays ?? '');
              const divisor = s?.shared ? (Number(s?.sharedCount) || 1) : 1;
              const displayAmt = (Number(s.amount) || 0) / (divisor || 1);

              return (
                <SectionCard key={String(s.id)} t={t}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Text style={{ color: t.text, fontWeight: '900', fontSize: 16, flex: 1 }}>
                      {s.merchant}
                    </Text>
                    <Text style={{ color: t.subtext, fontWeight: '800', fontSize: 13 }}>
                      {formatMoney(displayAmt, s.currency || 'USD')}/{s.cadence}
                      {s?.shared ? '\n(your share)' : ''}
                    </Text>
                  </View>

                  <Text style={{ color: t.subtext, marginTop: 14, fontWeight: '700' }}>
                    Days used this month
                  </Text>
                  <TextInput
                    keyboardType="number-pad"
                    value={usageDays}
                    onChangeText={(v) =>
                      saveRecapAnswer?.(s.id, {
                        usageDays: Number(String(v).replace(/[^0-9]/g, '')),
                      })
                    }
                    placeholder="0"
                    placeholderTextColor={t.tertiary}
                    style={{
                      marginTop: 8,
                      borderWidth: 1,
                      borderColor: t.hairline,
                      backgroundColor: t.surface2,
                      borderRadius: 14,
                      padding: 12,
                      color: t.text,
                      fontWeight: '900',
                    }}
                  />

                  {[
                    { key: 'satisfaction', label: 'Satisfaction' },
                    { key: 'missIt', label: 'Would you miss it?' },
                    { key: 'pricePain', label: 'Price pain' },
                  ].map(({ key, label }) => (
                    <View key={key}>
                      <Text style={{ color: t.subtext, marginTop: 14, fontWeight: '700' }}>{label}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Chip
                            key={`${key}-${n}`}
                            t={t}
                            active={Number(a[key]) === n}
                            label={`${n}`}
                            onPress={() => saveRecapAnswer?.(s.id, { [key]: n })}
                          />
                        ))}
                      </View>
                    </View>
                  ))}

                  <Text style={{ color: t.subtext, marginTop: 14, fontWeight: '700' }}>
                    Do you have an alternative?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                    <Chip t={t} active={a.hasAlt === true} label="Yes" onPress={() => saveRecapAnswer?.(s.id, { hasAlt: true })} />
                    <Chip t={t} active={a.hasAlt === false} label="No" onPress={() => saveRecapAnswer?.(s.id, { hasAlt: false })} />
                  </View>
                </SectionCard>
              );
            })}

            {/* Recommendations */}
            <SectionCard t={t}>
              <Text style={{ color: t.text, fontWeight: '900', fontSize: 16 }}>Recommendations</Text>
              <Text style={{ color: t.subtext, marginTop: 4, lineHeight: 19 }}>
                Based on your answers — not financial advice, just operational excellence.
              </Text>

              {recs.length === 0 ? (
                <Text style={{ color: t.subtext, marginTop: 12, lineHeight: 19 }}>
                  Answer the questions above to generate recommendations.
                </Text>
              ) : (
                <View style={{ marginTop: 12, gap: 12 }}>
                  {recs.slice(0, 6).map((x) => (
                    <View
                      key={String(x.sub.id)}
                      style={{
                        borderTopWidth: 1,
                        borderTopColor: t.hairline,
                        paddingTop: 12,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ color: t.text, fontWeight: '900', flex: 1 }}>
                          {x.sub.merchant}
                        </Text>
                        <Text style={{ color: t.subtext, fontWeight: '700', fontSize: 12 }}>
                          ~{formatMoney(x.estMonthly, x.sub.currency || 'USD')}/mo
                        </Text>
                      </View>
                      <DecisionBadge decision={x.decision} t={t} />
                      <Text style={{ color: t.subtext, marginTop: 6, fontSize: 13, lineHeight: 18 }}>
                        {x.why} · value score {(x.valueScore * 100).toFixed(0)}%
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  onPress={handleShare}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    backgroundColor: t.surface2,
                    borderWidth: 1,
                    borderColor: t.hairline,
                    paddingVertical: 14,
                    borderRadius: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: t.text, fontWeight: '900' }}>Share recap</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={markDone}
                  disabled={completed}
                  activeOpacity={0.85}
                  style={{
                    flex: 1,
                    backgroundColor: completed ? t.surface2 : t.accent,
                    borderWidth: 1,
                    borderColor: completed ? t.hairline : t.accent,
                    paddingVertical: 14,
                    borderRadius: 16,
                    alignItems: 'center',
                    opacity: completed ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: completed ? t.subtext : '#fff', fontWeight: '900' }}>
                    {completed ? 'Completed ✓' : 'Mark done'}
                  </Text>
                </TouchableOpacity>
              </View>
            </SectionCard>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}