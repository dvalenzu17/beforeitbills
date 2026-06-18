const KNOWN = [
  { cat: 'Streaming', match: ['netflix','spotify','disney','hulu','max','prime','apple tv','paramount'] },
  { cat: 'Productivity', match: ['notion','todoist','evernote','microsoft 365','google one','dropbox'] },
  { cat: 'Developer', match: ['github','gitlab','vercel','render','heroku','digitalocean'] },
  { cat: 'Fitness', match: ['gym','peloton','classpass'] },
  { cat: 'Domains/Hosting', match: ['namecheap','godaddy','porkbun','cloudflare','hostinger'] },
  { cat: 'Utilities', match: ['electric','water','internet','comcast','spectrum','t-mobile'] },
];

export function inferCategory(merchant = '') {
  const m = merchant.toLowerCase();
  for (const row of KNOWN) if (row.match.some(t => m.includes(t))) return row.cat;
  return 'Other';
}
export function groupByCategory(subs = []) {
  const out = {};
  for (const s of subs) {
    const cat = s.category || inferCategory(s.merchant);
    const monthly = s.cadence === 'yearly' ? s.amount/12
      : s.cadence === 'quarterly' ? s.amount/3
      : s.cadence === 'biweekly' ? s.amount*2.1725
      : s.cadence === 'weekly' ? s.amount*4.345 : s.amount;
    out[cat] = (out[cat] ?? 0) + monthly;
  }
  return out;
}
