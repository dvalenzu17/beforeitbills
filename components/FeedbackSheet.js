// components/FeedbackSheet.js
// Shake-to-report bottom sheet — inspired by Instagram's problem reporter.
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useTheme } from '../lib/theme';
import { track } from '../lib/analytics';
import { useFeedbackStore } from '../lib/feedbackStore';

const SHEET_HEIGHT = 380;

export default function FeedbackSheet() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const visible = useFeedbackStore((s) => s.visible);
  const hide = useFeedbackStore((s) => s.hide);

  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSent(false);
      setMessage('');
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          damping: 22,
          mass: 0.6,
          stiffness: 260,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: SHEET_HEIGHT,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  async function handleSend() {
    if (!message.trim() || sending) return;

    setSending(true);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      track('bug_report_submitted', {
        message: message.trim(),
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
      });
      setSent(true);
      setTimeout(() => hide(), 1600);
    } catch {
      // Silent — track is best-effort
      setSent(true);
      setTimeout(() => hide(), 1600);
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    Haptics.selectionAsync().catch(() => {});
    hide();
  }

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)', opacity: overlayOpacity }]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* Sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        keyboardVerticalOffset={0}
      >
        <Animated.View
          style={{
            transform: [{ translateY }],
            backgroundColor: t.surface,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: t.hairline,
            paddingBottom: insets.bottom + 12,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.hairline }} />
          </View>

          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${t.accent}22`, alignItems: 'center', justifyContent: 'center' }}>
                <Feather name="alert-circle" size={17} color={t.accent} />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: t.text, letterSpacing: -0.3 }}>
                Report a problem
              </Text>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              style={({ pressed }) => ({
                width: 30, height: 30, borderRadius: 15,
                backgroundColor: pressed ? t.surface2 : t.bg,
                borderWidth: 1, borderColor: t.hairline,
                alignItems: 'center', justifyContent: 'center',
              })}
            >
              <Feather name="x" size={15} color={t.subtext} />
            </Pressable>
          </View>

          <View style={{ paddingHorizontal: 20, gap: 16 }}>
            {sent ? (
              /* Success state */
              <View style={{ alignItems: 'center', paddingVertical: 24, gap: 12 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#34D39922', alignItems: 'center', justifyContent: 'center' }}>
                  <Feather name="check" size={26} color="#34D399" />
                </View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: t.text }}>Got it, thanks</Text>
                <Text style={{ fontSize: 13, color: t.subtext, textAlign: 'center', lineHeight: 18 }}>
                  We'll look into it and fix it as fast as we can.
                </Text>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: t.subtext, lineHeight: 18 }}>
                  What's going wrong? Be as specific as you can — what you tapped, what you expected, what happened.
                </Text>

                <TextInput
                  multiline
                  numberOfLines={4}
                  placeholder="Describe the problem…"
                  placeholderTextColor={t.tertiary || t.subtext}
                  value={message}
                  onChangeText={setMessage}
                  autoFocus
                  style={{
                    backgroundColor: t.bg,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: message.length > 0 ? t.accent : t.hairline,
                    padding: 14,
                    color: t.text,
                    fontSize: 14,
                    lineHeight: 20,
                    minHeight: 100,
                    textAlignVertical: 'top',
                  }}
                />

                <Pressable
                  onPress={handleSend}
                  disabled={!message.trim() || sending}
                  style={({ pressed }) => ({
                    backgroundColor: message.trim() ? t.accent : t.surface2,
                    borderRadius: 14,
                    paddingVertical: 15,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  })}
                >
                  <Text style={{
                    fontSize: 15,
                    fontWeight: '800',
                    color: message.trim() ? '#0B0F17' : t.subtext,
                  }}>
                    {sending ? 'Sending…' : 'Send report'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}
