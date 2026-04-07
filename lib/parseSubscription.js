// lib/parseSubscription.js
import { BACKEND_URL } from './config';
import { supabase } from './supabase';

/**
 * Sends natural language text to the backend parser.
 * Returns { name, amount, currency, cadence, kind, nextRenewal, notes }
 * Throws on network / auth errors so the caller can show a graceful fallback.
 */
export async function parseSubscriptionText(text) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const res = await fetch(`${BACKEND_URL}/parse-subscription`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ text: text.trim() }),
  });

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(json.message || `Server error ${res.status}`);
  }

  return json.result;
}
