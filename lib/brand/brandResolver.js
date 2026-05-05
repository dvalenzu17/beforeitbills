// lib/brand/brandResolver.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const LOGO_DEV_TOKEN = Constants?.expoConfig?.extra?.EXPO_PUBLIC_LOGO_DEV_TOKEN || "";
const BRANDFETCH_KEY = Constants?.expoConfig?.extra?.EXPO_PUBLIC_BRANDFETCH_API_KEY || "";

const CACHE_PREFIX = "brandmeta:v3:";
const TTL_MS = 1000 * 60 * 60 * 24 * 14;

// 🔥 hard guarantees for the “top brands”
// Keys MUST match normalizeBrandKey(): lowercase, no spaces, punctuation stripped (except "+").
export const BRAND_DOMAIN_ALIASES = {
  // ---- Streaming / Video ----
  netflix: "netflix.com",
  hulu: "hulu.com",
  "disney+": "disneyplus.com",
  disneyplus: "disneyplus.com",
  primevideo: "primevideo.com",
  amazonprimevideo: "primevideo.com",
  amazonprime: "amazon.com",
  max: "max.com",
  hbomax: "max.com",
  "paramount+": "paramountplus.com",
  paramountplus: "paramountplus.com",
  peacock: "peacocktv.com",
  "appletv+": "tv.apple.com",
  appletvplus: "tv.apple.com",
  tvapple: "tv.apple.com",
  youtube: "youtube.com",
  youtubepremium: "youtube.com",
  youtubetv: "tv.youtube.com",
  crunchyroll: "crunchyroll.com",
  funimation: "funimation.com",
  tubi: "tubi.tv",
  pluto: "pluto.tv",
  plutotv: "pluto.tv",
  roku: "roku.com",
  rokuchannel: "therokuchannel.roku.com",
  sling: "sling.com",
  slingtv: "sling.com",
  fubo: "fubo.tv",
  fubotv: "fubo.tv",
  showtime: "showtime.com",
  starz: "starz.com",
  britbox: "britbox.com",
  acorntv: "acorn.tv",
  curiositystream: "curiositystream.com",
  "discovery+": "discoveryplus.com",
  discoveryplus: "discoveryplus.com",
  "espn+": "espnplus.com",
  espnplus: "espnplus.com",
  nba: "nba.com",
  nbatv: "nba.com",
  "nfl+": "nfl.com",
  nflplus: "nfl.com",
  mlb: "mlb.com",
  mlbtv: "mlb.com",
  ufcfightpass: "ufcfightpass.com",
  dazn: "dazn.com",
  mlstv: "mlssoccer.com",

  // ---- Music / Audio ----
  spotify: "spotify.com",
  applemusic: "music.apple.com",
  musicapple: "music.apple.com",
  youtubemusic: "music.youtube.com",
  tidal: "tidal.com",
  deezer: "deezer.com",
  soundcloud: "soundcloud.com",
  pandora: "pandora.com",
  amazonmusic: "music.amazon.com",
  siriusxm: "siriusxm.com",
  audible: "audible.com",
  pocketcasts: "pocketcasts.com",

  // ---- Gaming ----
  xboxgamepass: "xbox.com",
  gamepass: "xbox.com",
  playstationplus: "playstation.com",
  psplus: "playstation.com",
  nintendoswitchonline: "nintendo.com",
  nintendoonline: "nintendo.com",
  steam: "steampowered.com",
  epicgames: "epicgames.com",
  eaplay: "ea.com",
  "ubisoft+": "ubisoftplus.com",
  ubisoftplus: "ubisoftplus.com",
  riotgames: "riotgames.com",
  twitch: "twitch.tv",
  discord: "discord.com",

  // ---- Productivity / Office / Storage ----
  googleone: "one.google.com",
  googleworkspace: "workspace.google.com",
  gmail: "google.com",
  microsoft365: "microsoft.com",
  office365: "microsoft.com",
  onedrive: "onedrive.live.com",
  icloud: "icloud.com",
  "icloud+": "icloud.com",
  icloudplus: "icloud.com",
  dropbox: "dropbox.com",
  box: "box.com",
  evernote: "evernote.com",
  notion: "notion.so",
  airtable: "airtable.com",
  trello: "trello.com",
  asana: "asana.com",
  clickup: "clickup.com",
  monday: "monday.com",
  mondaycom: "monday.com",
  slack: "slack.com",
  zoom: "zoom.us",
  googlemeet: "meet.google.com",
  calendly: "calendly.com",
  grammarly: "grammarly.com",
  canva: "canva.com",
  figma: "figma.com",
  miro: "miro.com",
  jira: "atlassian.com",
  confluence: "atlassian.com",
  bitbucket: "atlassian.com",
  atlassian: "atlassian.com",
  github: "github.com",
  gitlab: "gitlab.com",
  linear: "linear.app",
  "1password": "1password.com",
  lastpass: "lastpass.com",
  dashlane: "dashlane.com",

  // ---- Developer / Hosting / APIs ----
  vercel: "vercel.com",
  netlify: "netlify.com",
  heroku: "heroku.com",
  aws: "aws.amazon.com",
  amazonwebservices: "aws.amazon.com",
  gcp: "cloud.google.com",
  googlecloud: "cloud.google.com",
  azure: "azure.microsoft.com",
  digitalocean: "digitalocean.com",
  vultr: "vultr.com",
  linode: "linode.com",
  cloudflare: "cloudflare.com",
  firebase: "firebase.google.com",
  supabase: "supabase.com",
  mongodb: "mongodb.com",
  planetscale: "planetscale.com",
  render: "render.com",
  railway: "railway.app",
  flyio: "fly.io",
  postman: "postman.com",
  sentry: "sentry.io",
  datadog: "datadoghq.com",
  newrelic: "newrelic.com",
  twilio: "twilio.com",
  sendgrid: "sendgrid.com",
  mailgun: "mailgun.com",
  openai: "openai.com",
  chatgpt: "openai.com",

  // ---- E-commerce / Payments ----
  shopify: "shopify.com",
  shopifypay: "shopify.com",
  stripe: "stripe.com",
  paypal: "paypal.com",
  venmo: "venmo.com",
  cashapp: "cash.app",
  square: "squareup.com",
  klarna: "klarna.com",
  afterpay: "afterpay.com",
  affirm: "affirm.com",
  patreon: "patreon.com",
  etsy: "etsy.com",
  ebay: "ebay.com",
  amazon: "amazon.com",
  walmart: "walmart.com",
  target: "target.com",
  instacart: "instacart.com",
  doordash: "doordash.com",
  ubereats: "ubereats.com",

  // ---- Finance / Banking / Investing ----
  chase: "chase.com",
  bankofamerica: "bankofamerica.com",
  wellsfargo: "wellsfargo.com",
  citi: "citi.com",
  capitalone: "capitalone.com",
  americanexpress: "americanexpress.com",
  amex: "americanexpress.com",
  discover: "discover.com",
  wise: "wise.com",
  revolut: "revolut.com",
  robinhood: "robinhood.com",
  fidelity: "fidelity.com",
  schwab: "schwab.com",
  vanguard: "vanguard.com",
  coinbase: "coinbase.com",
  binance: "binance.com",
  kraken: "kraken.com",
  paypalcredit: "paypal.com",

  // ---- Security / VPN ----
  nordvpn: "nordvpn.com",
  expressvpn: "expressvpn.com",
  surfshark: "surfshark.com",
  protonvpn: "protonvpn.com",
  protonmail: "proton.me",
  bitdefender: "bitdefender.com",
  malwarebytes: "malwarebytes.com",
  mcafee: "mcafee.com",
  norton: "norton.com",

  // ---- Social / Creator / Comms ----
  linkedin: "linkedin.com",
  x: "x.com",
  twitter: "x.com",
  instagram: "instagram.com",
  facebook: "facebook.com",
  meta: "meta.com",
  whatsapp: "whatsapp.com",
  telegram: "telegram.org",
  snapchat: "snapchat.com",
  tiktok: "tiktok.com",
  reddit: "reddit.com",
  medium: "medium.com",
  substack: "substack.com",

  // ---- News / Education ----
  nytimes: "nytimes.com",
  theathletic: "theathletic.com",
  washingtonpost: "washingtonpost.com",
  wsj: "wsj.com",
  wallstreetjournal: "wsj.com",
  economist: "economist.com",
  bloomberg: "bloomberg.com",
  coursera: "coursera.org",
  udemy: "udemy.com",
  skillshare: "skillshare.com",
  masterclass: "masterclass.com",
  duolingo: "duolingo.com",

  // ---- Fitness / Wellness ----
  peloton: "onepeloton.com",
  strava: "strava.com",
  fitbit: "fitbit.com",
  myfitnesspal: "myfitnesspal.com",
  calm: "calm.com",
  headspace: "headspace.com",

  // ---- Delivery / Mobility ----
  uber: "uber.com",
  uberone: "uber.com",
  "uber one": "uber.com",
  lyft: "lyft.com",
  doordashdashpass: "doordash.com",
  grubhub: "grubhub.com",
  postmates: "postmates.com",
  instacartplus: "instacart.com",

  // ---- Utilities / Telco (common) ----
  tmobile: "t-mobile.com",
  verizon: "verizon.com",
  att: "att.com",
  comcast: "xfinity.com",
  xfinity: "xfinity.com",

  // ---- Design / Photo / Video tools ----
  adobe: "adobe.com",
  creativecloud: "adobe.com",
  photoshop: "adobe.com",
  lightroom: "adobe.com",
  premierepro: "adobe.com",
  capcut: "capcut.com",

  // ---- BeforeItBills (self) ----
  beforeitbills: "beforeitbills.com",

  // ---- Misc common subscriptions ----
  ikea: "ikea.com",
  costco: "costco.com",
  samsclub: "samsclub.com",
};


function normalizeDomain(input) {
  if (!input) return "";
  const s = String(input).trim().toLowerCase();
  return s
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0];
}

function normalizeBrandKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^\w+]/g, "");
}

function inferDomain({ domain, name }) {
  const d = normalizeDomain(domain);
  if (d) return d;

  const key = normalizeBrandKey(name);
  if (BRAND_DOMAIN_ALIASES[key]) return BRAND_DOMAIN_ALIASES[key];

  // lightweight heuristics (optional)
  if (key.includes("netflix")) return "netflix.com";
  if (key.includes("spotify")) return "spotify.com";
  if (key.includes("icloud")) return "icloud.com";
  if (key.includes("shopify")) return "shopify.com";
  if (key.includes("uber")) return "uber.com";

  return "";
}

function colorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360}, 70%, 45%)`;
}

function googleFaviconUrl(domain, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

function logoDevUrl(domain) {
  if (!LOGO_DEV_TOKEN) return "";
  return `https://img.logo.dev/${encodeURIComponent(domain)}?token=${encodeURIComponent(LOGO_DEV_TOKEN)}`;
}

async function fetchBrandfetch(domain) {
  if (!BRANDFETCH_KEY) return null;

  const res = await fetch(`https://api.brandfetch.io/v2/brands/${encodeURIComponent(domain)}`, {
    headers: { Authorization: `Bearer ${BRANDFETCH_KEY}` },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const primary =
    data?.colors?.find?.((c) => c?.type === "primary")?.hex ||
    data?.colors?.[0]?.hex ||
    null;

  return { name: data?.name || null, color: primary };
}

export async function resolveBrandMeta({ domain, name }) {
  const d = inferDomain({ domain, name });
  const cacheKey = `${CACHE_PREFIX}${d || normalizeBrandKey(name) || "unknown"}`;

  try {
    const raw = await AsyncStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw);
      if (cached?.ts && Date.now() - cached.ts < TTL_MS) return cached.value;
    }
  } catch {}

  const fallbackColor = colorFromString(d || name || "brand");
  const faviconUrl = d ? googleFaviconUrl(d, 64) : "";
  const logoUrl = d ? (logoDevUrl(d) || faviconUrl) : "";

  let color = fallbackColor;
  let displayName = name || d || "Unknown";

  try {
    const bf = d ? await fetchBrandfetch(d) : null;
    if (bf?.color) color = bf.color;
    if (bf?.name) displayName = bf.name;
  } catch {}

  const value = { domain: d, name: displayName, color, logoUrl, faviconUrl };

  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), value }));
  } catch {}

  return value;
}