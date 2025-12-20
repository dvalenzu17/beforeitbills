// lib/sync.js
import { supabase } from './supabase';

export async function getSessionUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function backupSubs(localSubs = []) {
  const user = await getSessionUser();
  if (!user) throw new Error('Not signed in');
  const rows = localSubs.map(s => ({
    user_id: user.id,
    local_id: String(s.id),
    merchant: s.merchant,
    amount: s.amount,
    currency: (s.currency || 'USD').toUpperCase().slice(0,3),
    cadence: s.cadence,
    next_renewal: s.nextRenewal,
    category: s.category ?? null,
  }));
  const { error } = await supabase.from('subscriptions')
    .upsert(rows, { onConflict: 'user_id,local_id' });
  if (error) throw error;
}

export async function restoreSubs() {
  const user = await getSessionUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase.from('subscriptions')
    .select('*').eq('user_id', user.id).order('updated_at', { ascending:false });
  if (error) throw error;
  // Map server → local shape
  return (data ?? []).map(row => ({
    id: row.local_id, // preserve local ids for consistency
    merchant: row.merchant,
    amount: Number(row.amount),
    currency: row.currency,
    cadence: row.cadence,
    nextRenewal: row.next_renewal,
    category: row.category,
    createdAt: row.created_at,
  }));
}

export async function signOutAll() {
  await supabase.auth.signOut();
}
