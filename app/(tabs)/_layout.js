// app/(tabs)/_layout.js
import React from 'react';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <>
      <StatusBar style="light" />
      <Tabs screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: t.subtext,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.border, height: 64, paddingBottom: 10, paddingTop: 8 },
        tabBarLabelStyle: { fontWeight: '700' },
      }}>
        <Tabs.Screen name="index"    options={{ title: 'Home',     tabBarIcon: ({color,size}) => <Feather name="home" color={color} size={size}/> }} />
        <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: ({color,size}) => <Feather name="bar-chart-2" color={color} size={size}/> }} />
        <Tabs.Screen name="account"  options={{ title: 'Account',  tabBarIcon: ({color,size}) => <Feather name="user" color={color} size={size}/> }} />
      </Tabs>
    </>
  );

  
}



