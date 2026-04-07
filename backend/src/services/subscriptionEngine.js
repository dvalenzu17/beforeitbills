/**
 * Subscription detection engine.
 *
 * All scoring, normalisation, and deduplication logic lives here.
 * Used by both the Gmail scan route and the IMAP scan route.
 */

// ── Brand metadata ────────────────────────────────────────────────────────────

const BRAND_NAME_MAP = {
  netflix: 'Netflix', spotify: 'Spotify', amazon: 'Amazon', youtube: 'YouTube',
  google: 'Google', apple: 'Apple', disney: 'Disney+', hulu: 'Hulu',
  hbo: 'HBO Max', max: 'Max', peacock: 'Peacock', paramount: 'Paramount+',
  microsoft: 'Microsoft', adobe: 'Adobe', dropbox: 'Dropbox', notion: 'Notion',
  slack: 'Slack', github: 'GitHub', openai: 'OpenAI', zoom: 'Zoom',
  canva: 'Canva', figma: 'Figma', grammarly: 'Grammarly', audible: 'Audible',
  twitch: 'Twitch', crunchyroll: 'Crunchyroll', duolingo: 'Duolingo',
  headspace: 'Headspace', calm: 'Calm', peloton: 'Peloton', medium: 'Medium',
  substack: 'Substack', patreon: 'Patreon', nytimes: 'New York Times',
  klaviyo: 'Klaviyo', interactivebrokers: 'Interactive Brokers',
  uberone: 'Uber One', hoyoverse: 'HoYoverse', chatgpt: 'ChatGPT',
  icloud: 'iCloud', appletv: 'Apple TV+', applemusic: 'Apple Music',
  amazonprime: 'Amazon Prime', primevideo: 'Prime Video',
  linkedin: 'LinkedIn', twitter: 'X (Twitter)', x: 'X (Twitter)',
  claude: 'Claude', anthropic: 'Anthropic', cursor: 'Cursor',
  webflow: 'Webflow', framer: 'Framer', loom: 'Loom', miro: 'Miro',
  airtable: 'Airtable', hubspot: 'HubSpot', salesforce: 'Salesforce',
  mailchimp: 'Mailchimp', typeform: 'Typeform', monday: 'Monday.com',
  asana: 'Asana', trello: 'Trello', jira: 'Jira', confluence: 'Confluence',
  atlassian: 'Atlassian', vercel: 'Vercel', netlify: 'Netlify',
  heroku: 'Heroku', digitalocean: 'DigitalOcean', linode: 'Linode',
  fastly: 'Fastly', cloudflare: 'Cloudflare', datadog: 'Datadog',
  sentry: 'Sentry', mixpanel: 'Mixpanel', amplitude: 'Amplitude',
  segment: 'Segment', intercom: 'Intercom', zendesk: 'Zendesk',
};

// ── Text helpers ──────────────────────────────────────────────────────────────

export function extractSenderDomain(from = '') {
  const s = String(from);
  const emailMatch = s.match(/<([^>]+)>/) || s.match(/([^\s<>"]+@[^\s<>"]+)/);
  const email = emailMatch?.[1] || '';
  const parts = email.split('@');
  return (parts[1] || '').toLowerCase().trim();
}

export function brandFromDomain(domain = '') {
  if (!domain) return '';
  const parts = domain.replace(/\.(com|co|net|org|io|app|mail|email)(\.[a-z]{2})?$/, '').split('.');
  return parts[parts.length - 1].toLowerCase();
}

export function applyBrandMap(brand) {
  const key = String(brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return BRAND_NAME_MAP[key] || (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Subscription');
}

export function normalizeMerchant(from = '', senderDomain = '') {
  const withoutBrackets = String(from).replace(/<.*?>/g, '').replace(/"/g, '').trim();
  const looksLikeEmail = !withoutBrackets || withoutBrackets.includes('@');
  if (looksLikeEmail) {
    const brand = brandFromDomain(senderDomain || extractSenderDomain(from));
    return brand ? applyBrandMap(brand) : 'Subscription';
  }
  const clean = withoutBrackets.replace(/\.(com|net|io|org|co|app)$/i, '').trim();
  const brand = brandFromDomain(clean.toLowerCase().replace(/\s/g, ''));
  if (BRAND_NAME_MAP[brand]) return BRAND_NAME_MAP[brand];
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function parseEmailDate(dateStr = '') {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function parseAmount(text = '') {
  const s = String(text);
  const patterns = [
    /(USD|US\$|\$|GBP|£|EUR|€)\s?([0-9]+(?:\.[0-9]{1,2})?)/i,
    /([0-9]+(?:\.[0-9]{1,2})?)\s?(USD|GBP|EUR)/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const num = Number(m[1]) || Number(m[2]);
      if (Number.isFinite(num) && num > 0) return num;
    }
  }
  return null;
}

export function parseCurrency(text = '') {
  const s = String(text).toUpperCase();
  if (s.includes('£') || s.includes('GBP')) return 'GBP';
  if (s.includes('€') || s.includes('EUR')) return 'EUR';
  if (s.includes('CAD')) return 'CAD';
  if (s.includes('AUD')) return 'AUD';
  return 'USD';
}

export function estimateRenewalDate(emailDate, cadence) {
  if (!emailDate) return null;
  const d = new Date(emailDate instanceof Date ? emailDate.getTime() : emailDate);
  if (isNaN(d.getTime())) return null;
  switch (String(cadence || 'monthly')) {
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    default:          d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().slice(0, 10);
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function scoreCandidate({ subject = '', from = '', snippet = '', senderDomain = '' }) {
  const subLow = subject.toLowerCase();
  const allLow = `${subLow} ${from.toLowerCase()} ${snippet.toLowerCase()}`;
  let score = 0;

  const recurringHits = [
    ['subscription',  0.40], ['auto-renew',    0.40], ['auto renew',    0.35],
    ['renewal',       0.35], ['renews',        0.30], ['membership',    0.30],
    ['monthly plan',  0.30], ['annual plan',   0.30], ['billing cycle', 0.30],
    ['next billing',  0.25], ['monthly',       0.15], ['yearly',        0.15],
    ['quarterly',     0.15], ['weekly',        0.15], ['plan',          0.10],
    ['charged',       0.10], ['billed',        0.15], ['free trial',    0.20],
    ['trial',         0.20],
  ];
  for (const [k, w] of recurringHits) {
    if (allLow.includes(k)) score += w;
  }

  if (allLow.includes('receipt'))          score += 0.10;
  if (allLow.includes('invoice'))          score += 0.10;
  if (allLow.includes('charged'))          score += 0.10;
  if (allLow.includes('payment received')) score += 0.10;

  const oneTimePenalties = [
    ['your order',            -0.60], ['order confirmation',    -0.60],
    ['order #',               -0.60], ['order number',          -0.55],
    ['shipped',               -0.70], ['delivery',              -0.60],
    ['out for delivery',      -0.70], ['delivered',             -0.70],
    ['tracking',              -0.50], ['dispatch',              -0.50],
    ['has been shipped',      -0.65], ['arriving',              -0.55],
    ['estimated delivery',    -0.60], ['package',               -0.40],
    ['items ordered',         -0.60], ['purchase confirmation', -0.55],
    ['one-time',              -0.50], ['one time',              -0.50],
    ['refund',                -0.60], ['return',                -0.30],
    ['cancellation',          -0.40], ['verification',          -0.80],
    ['confirm your email',    -0.80], ['security code',         -0.80],
    ['sign in',               -0.70], ['login',                 -0.70],
    ['password',              -0.80], ['forgot',                -0.80],
    ['gift card',             -0.50], ['gift receipt',          -0.50],
    ['donation',              -0.40], ['survey',                -0.60],
    ['unsubscribe',           -0.30],
  ];
  for (const [k, w] of oneTimePenalties) {
    if (allLow.includes(k)) score += w;
  }

  const oneTimeSenders = new Set([
    'amazon', 'ebay', 'etsy', 'walmart', 'target', 'bestbuy',
    'doordash', 'ubereats', 'grubhub', 'instacart', 'shipt',
    'lyft', 'uber', 'airbnb', 'booking', 'expedia', 'hotels', 'eventbrite',
  ]);
  if (oneTimeSenders.has(brandFromDomain(senderDomain))) score -= 0.35;

  return Math.max(0, Math.min(1, score));
}

export function scoreBillCandidate({ subject = '', from = '', snippet = '', senderDomain = '', hasPdf = false, pdfFilename = '' }) {
  const allLow = `${subject} ${from} ${snippet} ${pdfFilename}`.toLowerCase();
  let score = 0;
  let iconKey = 'bill';
  let category = 'Bills';

  if (allLow.includes('payment due'))       score += 0.50;
  if (allLow.includes('amount due'))        score += 0.50;
  if (allLow.includes('balance due'))       score += 0.45;
  if (allLow.includes('bill ready'))        score += 0.45;
  if (allLow.includes('your bill'))         score += 0.40;
  if (allLow.includes('statement ready'))   score += 0.45;
  if (allLow.includes('monthly statement')) score += 0.45;
  if (allLow.includes('due date'))          score += 0.30;
  if (allLow.includes('past due'))          score += 0.55;
  if (allLow.includes('pay now'))           score += 0.35;
  if (allLow.includes('autopay'))           score += 0.30;
  if (hasPdf)                               score += 0.35;

  if (allLow.includes('electric') || allLow.includes('electricity') || allLow.includes('kwh') || allLow.includes('con ed') || allLow.includes('duke energy') || allLow.includes('pg&e') || allLow.includes('pge') || allLow.includes('xcel')) {
    score += 0.40; iconKey = 'electricity'; category = 'Electricity';
  } else if (allLow.includes('water') && (allLow.includes('bill') || allLow.includes('statement') || allLow.includes('due'))) {
    score += 0.40; iconKey = 'water'; category = 'Water';
  } else if ((allLow.includes('natural gas') || allLow.includes(' gas ')) && (allLow.includes('bill') || allLow.includes('statement') || allLow.includes('due'))) {
    score += 0.40; iconKey = 'gas'; category = 'Gas';
  } else if (allLow.includes('internet') || allLow.includes('broadband') || allLow.includes('comcast') || allLow.includes('xfinity') || allLow.includes('spectrum') || allLow.includes('fios')) {
    score += 0.35; iconKey = 'wifi'; category = 'Internet';
  } else if (allLow.includes('wireless') || allLow.includes('t-mobile') || allLow.includes('verizon') || allLow.includes('at&t mobility')) {
    score += 0.30; iconKey = 'phone'; category = 'Phone';
  } else if (allLow.includes('insurance') || allLow.includes('premium due') || allLow.includes('policy renewal') || allLow.includes('geico') || allLow.includes('state farm') || allLow.includes('allstate') || allLow.includes('progressive') || allLow.includes('usaa') || allLow.includes('blue cross') || allLow.includes('cigna') || allLow.includes('aetna') || allLow.includes('kaiser')) {
    score += 0.45;
    if (allLow.includes('health') || allLow.includes('medical') || allLow.includes('dental'))  { iconKey = 'health'; category = 'Health Insurance'; }
    else if (allLow.includes('auto') || allLow.includes('car'))                                 { iconKey = 'car_insurance'; category = 'Car Insurance'; }
    else if (allLow.includes('home') || allLow.includes('renters') || allLow.includes('homeowner')) { iconKey = 'home_insurance'; category = 'Home Insurance'; }
    else if (allLow.includes('life'))                                                            { iconKey = 'life_insurance'; category = 'Life Insurance'; }
    else                                                                                         { iconKey = 'home_insurance'; category = 'Insurance'; }
  } else if (allLow.includes('mortgage') || allLow.includes('home loan') || allLow.includes('escrow') || allLow.includes('rocket mortgage')) {
    score += 0.50; iconKey = 'mortgage'; category = 'Mortgage';
  } else if ((allLow.includes('rent') || allLow.includes('rental payment')) && !allLow.includes('car rental') && !allLow.includes('rent a')) {
    score += 0.40; iconKey = 'home'; category = 'Rent';
  } else if (allLow.includes('student loan') || allLow.includes('personal loan') || allLow.includes('credit card statement') || allLow.includes('sallie mae') || allLow.includes('navient')) {
    score += 0.40; iconKey = 'loan'; category = 'Loan';
  } else if (allLow.includes('auto loan') || allLow.includes('car payment')) {
    score += 0.40; iconKey = 'car_payment'; category = 'Car Payment';
  } else if (allLow.includes('gym') || allLow.includes('fitness') || allLow.includes('planet fitness') || allLow.includes('equinox')) {
    score += 0.25; iconKey = 'gym'; category = 'Gym';
  } else if (allLow.includes('trash') || allLow.includes('waste') || allLow.includes('garbage')) {
    score += 0.35; iconKey = 'trash'; category = 'Trash';
  }

  if (allLow.includes('subscription'))   score -= 0.20;
  if (allLow.includes('cancel anytime')) score -= 0.30;
  if (allLow.includes('your plan'))      score -= 0.20;
  if (allLow.includes('membership'))     score -= 0.15;
  if (allLow.includes('free trial'))     score -= 0.30;

  return { confidence: Math.max(0, Math.min(1, score)), iconKey, category };
}

// ── 24h dedup ─────────────────────────────────────────────────────────────────

export function deduplicateWithin24h(suggestions) {
  const sorted = [...suggestions].sort((a, b) => {
    const ta = a.emailDate ? a.emailDate.getTime() : 0;
    const tb = b.emailDate ? b.emailDate.getTime() : 0;
    return ta - tb;
  });

  const kept = [];
  const lastKeptAt = new Map();

  for (const s of sorted) {
    const domain = s.senderDomain || 'unknown';
    const emailTs = s.emailDate ? s.emailDate.getTime() : null;
    const lastTs  = lastKeptAt.get(domain);

    if (lastTs != null && emailTs != null) {
      const diffMs = emailTs - lastTs;
      if (diffMs >= 0 && diffMs < 24 * 60 * 60 * 1000) {
        const existingIdx = kept.findIndex(k => k.senderDomain === domain);
        if (existingIdx !== -1 && s.confidence > kept[existingIdx].confidence) {
          kept.splice(existingIdx, 1, s);
        }
        continue;
      }
    }
    kept.push(s);
    if (emailTs != null) lastKeptAt.set(domain, emailTs);
  }

  return kept;
}

// ── LLM fallback ──────────────────────────────────────────────────────────────

export async function llmClassifyIfNeeded(candidate) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (candidate.confidence >= 0.70 || candidate.confidence <= 0.20) return null;

  const { fetchJson } = await import('../lib/fetchUtil.js');
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

  const resp = await fetchJson(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: `Classify whether this email represents a RECURRING subscription or membership charge (not one-time purchase, order confirmation, shipping, or transactional email).

Return strict JSON only: {"is_subscription": boolean, "merchant": string, "cadence": "weekly"|"monthly"|"quarterly"|"yearly"|"unknown", "amount": number|null, "currency": string|null, "confidence": number}

Rules:
- is_subscription = true ONLY if there is clear evidence of recurring billing
- Order confirmations, shipping emails, one-time purchases = false
- Amazon order emails = false unless explicitly about Prime/Kindle Unlimited
- confidence: 0.0–1.0

From: ${candidate.rawFrom}
Subject: ${candidate.rawSubject}
Snippet: ${candidate.snippet}`,
        }],
        response_format: { type: 'json_object' },
        max_tokens: 200,
        temperature: 0,
      }),
    },
    15_000
  );

  if (!resp.ok) return null;
  try {
    return JSON.parse(resp.json?.choices?.[0]?.message?.content || '');
  } catch {
    return null;
  }
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

/**
 * Score a batch of raw email objects and return detected subscriptions + bills.
 *
 * @param {Array<{messageId, subject, from, date, senderDomain, snippet, hasPdf, pdfFilename}>} emails
 * @param {string} source — 'gmail_scan' | 'imap_yahoo' | etc.
 * @returns {Promise<Array>} scored subscription/bill objects
 */
export async function detectRecurringSubscriptions(emails, source = 'gmail_scan') {
  const candidates = [];

  for (const email of emails) {
    const { messageId, subject = '', from = '', date, senderDomain = '', snippet = '', hasPdf = false, pdfFilename = '' } = email;
    const allText = `${subject} ${snippet} ${pdfFilename}`;

    const subConfidence  = scoreCandidate({ subject, from, snippet, senderDomain });
    const billResult     = scoreBillCandidate({ subject, from, snippet, senderDomain, hasPdf, pdfFilename });

    // ML model augmentation — only runs for the ambiguous middle band (0.30–0.70)
    // to avoid adding overhead for clear winners/losers
    let finalSubConfidence = subConfidence;
    if (subConfidence >= 0.30 && subConfidence < 0.70) {
      const { predictSubscription } = await import('./subscriptionModel.js');
      const mlResult = predictSubscription({ subject, from, snippet, senderDomain });
      if (mlResult) {
        // Blend: take the higher of heuristic and ML (conservative — don't miss real subs)
        finalSubConfidence = Math.max(subConfidence, mlResult.confidence);
      }
    }

    const isBillSignal = billResult.confidence > 0.40 && billResult.confidence >= finalSubConfidence;
    const isSubSignal  = finalSubConfidence >= 0.55;

    if (!isSubSignal && !isBillSignal) continue;

    const merchant  = normalizeMerchant(from, senderDomain);
    const amount    = parseAmount(allText);
    const currency  = parseCurrency(allText);
    const emailDate = date instanceof Date ? date : parseEmailDate(date);

    const low = allText.toLowerCase();
    let cadence = null;
    if (low.includes('annual') || low.includes('year'))  cadence = 'yearly';
    else if (low.includes('quarter'))                     cadence = 'quarterly';
    else if (low.includes('weekly'))                      cadence = 'weekly';
    else if (low.includes('month'))                       cadence = 'monthly';

    if (isBillSignal && !isSubSignal) {
      if (!cadence) cadence = 'monthly';
      candidates.push({
        messageId, kind: 'bill', merchant, senderDomain, amount, currency, cadence,
        confidence: billResult.confidence, iconKey: billResult.iconKey, category: billResult.category,
        emailDate, rawSubject: subject, rawFrom: from, snippet, hasPdf, pdfFilename, source,
      });
    } else {
      candidates.push({
        messageId, kind: 'subscription', merchant, senderDomain, amount, currency, cadence,
        confidence: finalSubConfidence, emailDate, rawSubject: subject, rawFrom: from, snippet, source,
      });
    }
  }

  // 24h dedup on subscriptions
  const subCandidates  = candidates.filter(c => c.kind === 'subscription');
  const billCandidates = candidates.filter(c => c.kind === 'bill');
  const dedupedSubs    = deduplicateWithin24h(subCandidates);

  // Optional LLM pass on ambiguous subscriptions
  const scoredSubs = [];
  for (const c of dedupedSubs) {
    const llm = await llmClassifyIfNeeded(c);
    const finalConfidence = llm?.confidence ?? c.confidence;
    const isSub = llm
      ? !!llm.is_subscription && finalConfidence >= 0.40
      : c.confidence >= 0.55;

    if (!isSub) continue;

    const finalCadence = (llm?.cadence && llm.cadence !== 'unknown') ? llm.cadence : (c.cadence || 'monthly');
    const llmMerchant  = llm?.merchant;
    const looksLikeBrand = llmMerchant && /^[a-z0-9\s.+\-]{1,40}$/i.test(llmMerchant) && llmMerchant.trim().split(/\s+/).length <= 3;

    scoredSubs.push({
      messageId:    c.messageId,
      kind:         'subscription',
      merchant:     looksLikeBrand ? applyBrandMap(brandFromDomain(llmMerchant.toLowerCase()) || llmMerchant) : c.merchant,
      senderDomain: c.senderDomain,
      amount:       llm?.amount ?? c.amount,
      currency:     llm?.currency || c.currency,
      cadence:      finalCadence,
      renewalDate:  estimateRenewalDate(c.emailDate, finalCadence),
      confidence:   finalConfidence,
      rawSubject:   c.rawSubject,
      rawFrom:      c.rawFrom,
      source:       c.source,
    });
  }

  // Bills — dedup by domain, keep highest confidence
  const billByDomain = new Map();
  for (const c of billCandidates) {
    const existing = billByDomain.get(c.senderDomain);
    if (!existing || c.confidence > existing.confidence) billByDomain.set(c.senderDomain, c);
  }
  for (const c of billByDomain.values()) {
    scoredSubs.push({
      messageId:    c.messageId,
      kind:         'bill',
      merchant:     c.merchant,
      senderDomain: c.senderDomain,
      amount:       c.amount,
      currency:     c.currency,
      cadence:      c.cadence,
      renewalDate:  estimateRenewalDate(c.emailDate, c.cadence),
      confidence:   c.confidence,
      iconKey:      c.iconKey,
      category:     c.category,
      rawSubject:   c.rawSubject,
      rawFrom:      c.rawFrom,
      source:       c.source,
    });
  }

  return scoredSubs;
}
