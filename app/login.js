// app/login.js
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useRouter } from 'expo-router';

export default function Login() {
  const r = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function signIn() {
    if (!email || !password) return Alert.alert('Missing', 'Email and password required.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return Alert.alert('Sign in failed', error.message);
    // ensure profile row
    const user = (await supabase.auth.getUser()).data.user;
    if (user) await supabase.from('profiles').upsert({ id: user.id, email: user.email ?? null }).select();
    r.replace('/settings');
  }

  async function signUp() {
    if (!email || !password) return Alert.alert('Missing', 'Email and password required.');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return Alert.alert('Sign up failed', error.message);
    Alert.alert('Check your inbox', 'Confirm your email, then sign in.');
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ padding: 20, gap: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: '800' }}>Sign in</Text>

        <Text>Email</Text>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize='none'
          keyboardType='email-address' style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12 }} />
        <Text>Password</Text>
        <TextInput value={password} onChangeText={setPassword} secureTextEntry
          style={{ borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, padding:12 }} />

        <TouchableOpacity onPress={signIn} style={{ backgroundColor:'#111827', padding:14, borderRadius:10, alignItems:'center' }}>
          <Text style={{ color:'white', fontWeight:'800' }}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={signUp} style={{ backgroundColor:'#F3F4F6', padding:12, borderRadius:10, alignItems:'center' }}>
          <Text style={{ color:'#111827', fontWeight:'700' }}>Create account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
