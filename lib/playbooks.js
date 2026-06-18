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

    {
      id: 'amazon-prime',
      name: 'Amazon Prime',
      aliases: ['amazon prime', 'prime', 'amazon.com'],
      webUrl: 'https://www.amazon.com/gp/primecentral',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://www.amazon.com/gp/help/customer/',
      steps: [
        'Open Prime Central (Account → Prime Membership).',
        'Choose “Manage membership” → “End membership”.',
        'Confirm — you can keep benefits until the period ends.',
      ],
      notes: 'Prime Video-only plans are cancelled in the same Prime settings.',
    },

    {
      id: 'max',
      name: 'Max (HBO)',
      aliases: ['hbo max', 'hbo', 'max.com', 'hbomax'],
      webUrl: 'https://www.max.com/account',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://help.max.com/',
      steps: [
        'Sign in to Max on the web → Account.',
        'Under “Subscription”, choose “Manage subscription” → “Cancel”.',
      ],
      notes: 'If you subscribed via Amazon/Apple/Roku, cancel through that provider.',
    },

    {
      id: 'paramount-plus',
      name: 'Paramount+',
      aliases: ['paramount+', 'paramount plus', 'paramountplus.com'],
      webUrl: 'https://www.paramountplus.com/account/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://help.paramountplus.com/',
      steps: [
        'Open Account on the web.',
        'Under your plan, select “Cancel Subscription” and confirm.',
      ],
      notes: '',
    },

    {
      id: 'peacock',
      name: 'Peacock',
      aliases: ['peacock', 'peacocktv.com'],
      webUrl: 'https://www.peacocktv.com/account/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://www.peacocktv.com/help',
      steps: [
        'Sign in on the web → Account → Plans.',
        'Select “Change or Cancel Plan” → “Cancel”.',
      ],
      notes: '',
    },

    {
      id: 'audible',
      name: 'Audible',
      aliases: ['audible', 'audible.com'],
      webUrl: 'https://www.audible.com/account/membership',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://help.audible.com/',
      steps: [
        'Open Account Details on the web (not the app).',
        'Choose “Cancel membership” and follow the prompts.',
      ],
      notes: 'Membership cancellation must be done on the website, not the app.',
    },

    {
      id: 'apple',
      name: 'Apple (iCloud+/Apple One/TV+/Music)',
      aliases: ['apple', 'apple.com', 'icloud', 'icloud+', 'apple one', 'apple tv+', 'apple music', 'itunes'],
      webUrl: null,
      iosUrl: 'App-Prefs:root=APPLE_ACCOUNT',
      androidUrl: null,
      supportUrl: 'https://support.apple.com/HT202039',
      steps: [
        'iPhone/iPad: Settings → [your name] → Subscriptions.',
        'Select the Apple service → “Cancel Subscription”.',
        'Mac: App Store → your name → Account Settings → Subscriptions.',
      ],
      notes: 'All Apple subscriptions are managed in your Apple Account, not a website.',
    },

    {
      id: 'chatgpt',
      name: 'ChatGPT Plus',
      aliases: ['chatgpt', 'chatgpt plus', 'openai', 'openai.com', 'chat gpt'],
      webUrl: 'https://chatgpt.com/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://help.openai.com/',
      steps: [
        'Open ChatGPT → your profile → “Settings”.',
        'Go to “Subscription” → “Manage” → “Cancel plan”.',
      ],
      notes: 'If you subscribed in the iOS app, cancel in iOS Subscriptions instead.',
    },

    {
      id: 'claude',
      name: 'Claude (Anthropic)',
      aliases: ['claude', 'anthropic', 'anthropic.com', 'claude.ai'],
      webUrl: 'https://claude.ai/settings/billing',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://support.anthropic.com/',
      steps: [
        'Open Claude → Settings → Billing.',
        'Select “Manage subscription” → “Cancel plan”.',
      ],
      notes: 'If billed via the App Store, cancel in iOS Subscriptions.',
    },

    {
      id: 'nordvpn',
      name: 'NordVPN',
      aliases: ['nordvpn', 'nord vpn', 'nordvpn.com'],
      webUrl: 'https://my.nordaccount.com/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://support.nordvpn.com/',
      steps: [
        'Sign in to Nord Account on the web.',
        'Go to “Billing” → turn off auto-renewal / cancel.',
      ],
      notes: 'Auto-renewal is what to disable; access continues until period end.',
    },

    {
      id: '1password',
      name: '1Password',
      aliases: ['1password', '1password.com', 'one password'],
      webUrl: 'https://my.1password.com/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://support.1password.com/',
      steps: [
        'Sign in to your 1Password account on the web.',
        'Open “Billing” → “Cancel subscription”.',
      ],
      notes: '',
    },

    {
      id: 'linkedin-premium',
      name: 'LinkedIn Premium',
      aliases: ['linkedin premium', 'linkedin', 'linkedin.com'],
      webUrl: 'https://www.linkedin.com/premium/manage/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://www.linkedin.com/help/linkedin/',
      steps: [
        'Open Premium subscription settings on the web.',
        'Select “Cancel subscription” and confirm.',
      ],
      notes: 'If billed via Apple, cancel in iOS Subscriptions.',
    },

    {
      id: 'playstation-plus',
      name: 'PlayStation Plus',
      aliases: ['playstation plus', 'ps plus', 'ps+', 'playstation', 'sony'],
      webUrl: 'https://www.playstation.com/subscriptions/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://www.playstation.com/support/',
      steps: [
        'Sign in → Account → “Subscription”.',
        'Select PlayStation Plus → turn off auto-renew / cancel.',
        'Or on console: Settings → Account → Subscriptions.',
      ],
      notes: '',
    },

    {
      id: 'xbox-gamepass',
      name: 'Xbox Game Pass',
      aliases: ['xbox game pass', 'game pass', 'xbox', 'gamepass'],
      webUrl: 'https://account.microsoft.com/services/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://support.xbox.com/',
      steps: [
        'Open Services & subscriptions on your Microsoft account.',
        'Find Game Pass → “Manage” → “Cancel” / turn off recurring billing.',
      ],
      notes: '',
    },

    {
      id: 'patreon',
      name: 'Patreon',
      aliases: ['patreon', 'patreon.com'],
      webUrl: 'https://www.patreon.com/settings/memberships',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://support.patreon.com/',
      steps: [
        'Open Settings → Memberships on the web.',
        'Select the creator → “Edit” → “Cancel membership”.',
      ],
      notes: 'Each creator membership is cancelled separately.',
    },

    {
      id: 'canva',
      name: 'Canva',
      aliases: ['canva', 'canva.com', 'canva pro'],
      webUrl: 'https://www.canva.com/settings/billing-and-teams/',
      iosUrl: null,
      androidUrl: null,
      supportUrl: 'https://www.canva.com/help/',
      steps: [
        'Open Account settings → “Billing & teams”.',
        'Under your plan, choose “Cancel subscription”.',
      ],
      notes: '',
    },

    {
      id: 'duolingo',
      name: 'Duolingo (Super)',
      aliases: ['duolingo', 'duolingo plus', 'super duolingo', 'duolingo.com'],
      webUrl: 'https://www.duolingo.com/settings/account',
      iosUrl: 'App-Prefs:root=APPLE_ACCOUNT',
      androidUrl: 'https://play.google.com/store/account/subscriptions',
      supportUrl: 'https://support.duolingo.com/',
      steps: [
        'Most Super plans are billed via the App Store or Google Play.',
        'iOS: Settings → Subscriptions → Duolingo → Cancel.',
        'Android: Play Store → Subscriptions → Duolingo → Cancel.',
      ],
      notes: 'If you subscribed on the website, cancel under Account settings there.',
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
      if (p.aliases?.some(a => normalize(a) === key) ?? false) return p;
    }
    // loose contains
    for (const p of PB) {
      if (key.includes(normalize(p.name))) return p;
      if (p.aliases?.some(a => key.includes(normalize(a))) ?? false) return p;
    }
    return PB[0];
  }
  
  export function listPlaybooks() {
    return PB;
  }
  