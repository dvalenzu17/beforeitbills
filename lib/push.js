import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from './supabase';

// setNotificationHandler is owned by notifications.js - do NOT set it here.
// Having two calls to setNotificationHandler means whichever file loads second
// silently overwrites the first, producing non-deterministic behaviour.

const PROJECT_ID =
  Constants?.expoConfig?.extra?.eas?.projectId ||
  Constants?.manifest2?.extra?.expoClient?.extra?.eas?.projectId ||
  '';

export async function registerPushToken() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  // projectId is required in Expo SDK 49+ - without it getExpoPushTokenAsync
  // throws "Missing projectId" in production builds.
  const tokenData = await Notifications.getExpoPushTokenAsync(
    PROJECT_ID ? { projectId: PROJECT_ID } : undefined
  );
  const token = tokenData?.data;
  if (!token) return null;

  // Android: ensure the default channel exists before any notification fires
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Persist to Supabase so the backend can send targeted pushes
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (user) {
    await supabase.from('push_tokens').upsert(
      {
        user_id: user.id,
        token,
        device: `${Platform.OS} ${Platform.Version}`,
      },
      { onConflict: 'user_id,token' }
    );
  }
  // If no user yet (unauthenticated onboarding), the token is returned but
  // not stored. Call registerPushToken() again after sign-in to persist it.

  return token;
}