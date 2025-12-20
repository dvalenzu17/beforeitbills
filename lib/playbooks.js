// Lightweight vendor playbooks. No scraping, just clean steps + links.
const PB = [
    {
      id: 'generic',
      name: 'Any vendor',
      aliases: [],
      webUrl: null,
      iosUrl: 'App-Prefs:root=APPLE_ACCOUNT', // iOS system Subscriptions (user will likely go Settings > Apple ID > Subscriptions)
      androidUrl: 'https://play.google.com/store/account/subscriptions',
      supportUrl: null,
      steps: [
        'If billed via Apple: iOS Settings → [your name] → Subscriptions → select service → Cancel.',
        'If billed via Google Play: open link and cancel the subscription.',
        'If billed directly: open the vendor account page on the web, look for “Billing”, “Membership”, or “Manage subscription”, then Cancel.',
        'After cancelling, look for a confirmation email. Keep it for records.',
      ],
      notes: 'App store billing overrides vendor website in many cases.',
    },
  
    {
      id: 'netflix',
      name: 'Netflix',
      aliases: ['netflix.com', 'netflix inc', 'net flix'],
      webUrl: 'https://www.netflix.com/cancelplan',
      iosUrl: null, // usually not via Apple unless through Apple TV Channels
      androidUrl: null,
      supportUrl: 'https://help.netflix.com/',
      steps: [
        'Open Netflix on the web and go to Account.',
        'Under “Membership & Billing”, choose “Cancel Membership”.',
        'Confirm the cancellation and note the end date.',
      ],
      notes: 'If billed through a third-party (carrier/app store), you’ll be redirected there to cancel.',
    },
  
    {
      id: 'spotify',
      name: 'Spotify',
      aliases: ['spotify ab', 'spotify.com', 'spotify usa'],
      webUrl: 'https://www.spotify.com/account/subscription/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://support.spotify.com/',
      steps: [
        'Visit your Spotify Account → Subscription.',
        'Click “Manage your plan” → “Cancel Premium”.',
        'Confirm cancellation. Free tier remains active.',
      ],
      notes: 'If purchased via Apple/Google, cancel in the respective store.',
    },
  
    {
      id: 'disneyplus',
      name: 'Disney+',
      aliases: ['disney+', 'disney plus', 'disneyplus.com'],
      webUrl: 'https://www.disneyplus.com/billing',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://help.disneyplus.com/',
      steps: [
        'Go to Disney+ Account → Billing details.',
        'Select “Cancel Subscription” and follow prompts.',
      ],
      notes: 'Bundles (e.g., with Hulu/ESPN+) may redirect to partner billing.',
    },
  
    {
      id: 'hulu',
      name: 'Hulu',
      aliases: ['hulu.com'],
      webUrl: 'https://secure.hulu.com/account',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://help.hulu.com/',
      steps: [
        'Open Hulu Account page on the web.',
        'Under “Your Subscription”, click “Cancel”.',
        'Confirm or pause (if offered).',
      ],
      notes: '',
    },
  
    {
      id: 'adobe',
      name: 'Adobe (Creative Cloud)',
      aliases: ['adobe.com', 'creative cloud', 'cc'],
      webUrl: 'https://account.adobe.com/plans',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://helpx.adobe.com/contact.html',
      steps: [
        'Visit Adobe Account → Plans.',
        'Select your plan → “Manage plan” → “Cancel plan”.',
        'Follow prompts (watch for early termination fees on annual contracts).',
      ],
      notes: 'Annual plans may charge a fee when cancelling mid-term.',
    },
  
    {
      id: 'microsoft365',
      name: 'Microsoft 365',
      aliases: ['office 365', 'microsoft.com', 'ms 365'],
      webUrl: 'https://account.microsoft.com/services/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://support.microsoft.com/',
      steps: [
        'Open Services & subscriptions on your Microsoft account.',
        'Find your plan → “Manage” → “Cancel subscription”.',
      ],
      notes: '',
    },
  
    {
      id: 'dropbox',
      name: 'Dropbox',
      aliases: ['dropbox.com'],
      webUrl: 'https://www.dropbox.com/account/plan',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://help.dropbox.com/',
      steps: [
        'Go to Plan → “Cancel plan”.',
        'Confirm and review downgrade date.',
      ],
      notes: '',
    },
  
    {
      id: 'nytimes',
      name: 'The New York Times',
      aliases: ['nytimes', 'new york times'],
      webUrl: 'https://myaccount.nytimes.com/subscriptions',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://help.nytimes.com/',
      steps: [
        'Open Subscriptions in your NYT account.',
        'Select your product → “Cancel subscription”.',
        'Some regions require chat/phone to cancel; follow prompts.',
      ],
      notes: '',
    },
  
    {
      id: 'youtube-premium',
      name: 'YouTube Premium',
      aliases: ['youtube premium', 'yt premium', 'youtube.com'],
      webUrl: 'https://www.youtube.com/paid_memberships',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://support.google.com/youtube/',
      steps: [
        'Visit Paid memberships on YouTube (web).',
        'Click “Manage membership” → “Deactivate” (cancel).',
      ],
      notes: 'If billed via Apple, cancel in iOS Subscriptions.',
    },
  ];
  
  // normalize merchant text → match
  function normalize(s='') {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40);
  }
  
  export function findPlaybook(merchant) {
    const key = normalize(merchant || '');
    if (!key) return PB[0]; // generic
    // exact alias / id match
    for (const p of PB) {
      if (normalize(p.name) === key) return p;
      if (p.aliases.some(a => normalize(a) === key)) return p;
    }
    // loose contains
    for (const p of PB) {
      if (key.includes(normalize(p.name))) return p;
      if (p.aliases.some(a => key.includes(normalize(a)))) return p;
    }
    return PB[0];
  }
  
  export function listPlaybooks() {
    return PB;
  }
  