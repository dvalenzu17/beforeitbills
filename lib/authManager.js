// lib/authManager.js
// Centralized auth bootstrap so the app has one source of truth.

import { supabase, SUPABASE_CONFIGURED } from './supabase';
import { logError } from './logger';

async function safeUpsertProfile(user) {
  // Best-effort. DB trigger should create this anyway.
  try {
    if (!user?.id) return;
    await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          email: user.email ?? null,
          currency: 'USD',
        },
        { onConflict: 'id' }
      );
  } catch (e) {
    if (__DEV__) console.warn('[authManager] safeUpsertProfile failed:', e?.message);
  }
}

async function fetchCurrency(user) {
  try {
    if (!user?.id) return null;
    const { data } = await supabase
      .from('profiles')
      .select('currency')
      .eq('id', user.id)
      .maybeSingle();
    const c = data?.currency;
    return typeof c === 'string' && c.length ? c : null;
  } catch {
    return null;
  }
}

/**
 * Boot auth state + subscribe to changes.
 */
export async function bootstrapAuth(deps) {
  const { setUser, setAuthReady, setCurrency, hydrateAuthBypass } = deps;

  // Read local bypass first so UI can render immediately.
  try {
    await hydrateAuthBypass?.();
  } catch (e) {
    if (__DEV__) console.warn('[authManager] hydrateAuthBypass failed:', e?.message);
  }

  if (!SUPABASE_CONFIGURED || !supabase) {
    setUser(null);
    setAuthReady(true);
    return { unsubscribe: () => {} };
  }

  // Initial restore
  try {
    const { data } = await supabase.auth.getSession();
    const u = data?.session?.user ?? null;
    setUser(u);

    if (u) {
      await safeUpsertProfile(u);
      const c = await fetchCurrency(u);
      if (c) setCurrency?.(c);
    }
  } catch (e) {
    setUser(null);
    logError(e, { where: 'bootstrapAuth:getSession' });
  } finally {
    setAuthReady(true);
  }

  // Subscribe
  let sub = null;
  try {
    const res = supabase.auth.onAuthStateChange(async (_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) {
        await safeUpsertProfile(u);
        const c = await fetchCurrency(u);
        if (c) setCurrency?.(c);
      }
    });
    sub = res?.data?.subscription ?? null;
  } catch (e) {
    logError(e, { where: 'bootstrapAuth:onAuthStateChange' });
  }

  return { unsubscribe: () => sub?.unsubscribe?.() };
}
