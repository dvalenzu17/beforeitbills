import * as AuthSession from 'expo-auth-session';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
};
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export async function connectGmailAsync(clientId) {
  const redirectUri = AuthSession.makeRedirectUri({ useProxy: true });
  const url = `${discovery.authorizationEndpoint}?response_type=token&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(SCOPES.join(' '))}`;
  const res = await AuthSession.startAsync({ authUrl: url });
  if (res.type !== 'success') throw new Error('Cancelled');
  return res.params.access_token;
}

export async function fetchReceipts(accessToken) {
  const q = 'newer_than:365d ("receipt" OR "subscription" OR "renewed" OR "charged" OR "trial")';
  const list = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=50`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(r=>r.json());

  const msgs = [];
  for (const m of (list.messages || [])) {
    const full = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(r=>r.json());
    msgs.push(full);
  }
  return parseReceipts(msgs);
}

function parseReceipts(msgs=[]) {
  const out = [];
  for (const m of msgs) {
    const headers = Object.fromEntries((m.payload?.headers||[]).map(h => [h.name.toLowerCase(), h.value]));
    const subject = headers['subject'] || '';
    const from = headers['from'] || '';
    const date = new Date(headers['date'] || Date.now());

    const merchantRaw = (subject.match(/(?:Your|Receipt from|Invoice from|Thanks for|You were charged(?: by)?|Trial for)\\s+(.+?)(?:$|:| - | – )/i)?.[1]) || from.replace(/<.*?>/,'');
    const merchant = merchantRaw.replace(/["']/g,'').trim();

    const amountMatch = subject.match(/([$€£]\\s?\\d+[\\.,]?\\d*)/);
    const amount = amountMatch ? Number(amountMatch[1].replace(/[$€£,\\s]/g,'')) : NaN;

    const isTrial = /free trial|trial ending|trial expires|your trial/i.test(subject);
    const cadence = guessCadence(subject);
    const next = guessNext(date, subject);

    const rec = {
      merchant,
      amount: Number.isNaN(amount) ? 0 : amount,
      currency: subject.includes('$') ? 'USD' : subject.includes('€') ? 'EUR' : subject.includes('£') ? 'GBP' : 'USD',
      cadence,
      nextRenewal: next,
      tags: isTrial ? ['trial'] : [],
    };

    if (isTrial) rec.trial = { isTrial: true, end: next };

    if (merchant) out.push(rec);
  }
  return out;
}
function guessCadence(subject='') {
  if (/annual|yearly|12[-\\s]?month/i.test(subject)) return 'yearly';
  if (/quarter/i.test(subject)) return 'quarterly';
  if (/weekly/i.test(subject)) return 'weekly';
  return 'monthly';
}
function guessNext(chargedAt, subject='') {
  const d = new Date(chargedAt);
  if (/year/i.test(subject)) d.setFullYear(d.getFullYear()+1);
  else if (/quarter/i.test(subject)) d.setMonth(d.getMonth()+3);
  else if (/week/i.test(subject)) d.setDate(d.getDate()+7);
  else d.setMonth(d.getMonth()+1);
  return d.toISOString().slice(0,10);
}
