import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false
  }),
});

export async function registerPushToken() {
  // permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // get token
  const token = (await Notifications.getExpoPushTokenAsync()).data;

  // ensure user
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return token; // user can sign in later; we can upsert then

  // upsert token
  await supabase.from('push_tokens').upsert({
    user_id: user.id,
    token,
    device: `${Platform.OS} ${Platform.Version}`
  }, { onConflict: 'user_id,token' });

  // Android: create a default channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return token;
}
