// app/(tabs)/account.js
import React from 'react';
import { ScrollView, View, Text, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTheme } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

import profilePic from '../../assets/profile.png';

export default function Account() {
  const t = useTheme();
  const router = useRouter();

  const settingsItems = [
    {
      label: 'Personal Information',
      subtext: 'Update your name, email, or billing details',
      icon: 'person-outline',
      route: '/account/personal',
    },
    {
      label: 'Login & Security',
      subtext: 'Password, 2FA, connected accounts',
      icon: 'lock-closed-outline',
      route: '/account/security',
    },
    {
      label: 'Notifications',
      subtext: 'Manage alerts and reminders',
      icon: 'notifications-outline',
      route: '/account/notifications',
    },
    {
      label: 'Connected Accounts',
      subtext: 'Link Gmail or bank for auto-detect',
      icon: 'link-outline',
      route: '/account/connected',
    },
  ];

  const appInfoItems = [
    {
      label: 'Help',
      subtext: 'FAQs and contact support',
      icon: 'help-circle-outline',
      route: '/account/help',
    },
    {
      label: 'Legals',
      subtext: 'Terms of Service, Privacy Policy',
      icon: 'document-text-outline',
      route: '/account/legals',
    },
    {
      label: 'Export Data',
      subtext: 'Download subscription history',
      icon: 'download-outline',
      route: '/account/export',
    },
    {
      label: 'About',
      subtext: 'App version, credits, and more',
      icon: 'information-circle-outline',
      route: '/account/about',
    },
  ];

  const renderCard = (items) => (
    <View
      style={{
        backgroundColor: t.card || '#1c1c1e',
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        marginBottom: 24,
      }}
    >
      {items.map((item, idx) => (
        <TouchableOpacity
          key={idx}
          onPress={() => router.push(item.route)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 16,
            paddingHorizontal: 16,
            borderBottomWidth: idx === items.length - 1 ? 0 : 1,
            borderBottomColor: t.border || '#333',
          }}
        >
          {/* Left icon */}
          <Ionicons name={item.icon} size={22} color={t.text} style={{ marginRight: 12 }} />

          {/* Label + subtext */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '500', color: t.text }}>{item.label}</Text>
            {item.subtext && (
              <Text style={{ fontSize: 13, color: t.muted || '#999', marginTop: 2 }}>
                {item.subtext}
              </Text>
            )}
          </View>

          {/* Right chevron */}
          <Ionicons name="chevron-forward" size={20} color={t.text} />
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        {/* Title */}
        <Text style={{ fontSize: 22, fontWeight: '900', color: t.text, marginBottom: 12 }}>
          Account
        </Text>

        {/* Profile card */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            backgroundColor: t.card || '#1c1c1e',
            borderRadius: 12,
            shadowColor: '#000',
            shadowOpacity: 0.1,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            marginBottom: 24,
          }}
        >
          <Image source={profilePic} style={{ width: 80, height: 80, borderRadius: 40 }} />
          <View style={{ marginLeft: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: t.text }}>Daniel Valenzuela</Text>
            <Text style={{ fontSize: 14, color: t.muted || '#888', marginTop: 4 }}>
              Personal Account
            </Text>
          </View>
        </View>

        {/* Settings card */}
        {renderCard(settingsItems)}

        {/* App info card */}
        {renderCard(appInfoItems)}

        {/* Version info */}
        <Text
          style={{
            fontSize: 13,
            color: t.muted || '#888',
            textAlign: 'center',
            marginTop: 10,
          }}
        >
          v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}


