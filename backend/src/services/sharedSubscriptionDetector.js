/**
 * Shared Subscription Detection
 *
 * Detects when two linked users independently pay for the same service,
 * and surfaces a saving opportunity based on known family plan prices.
 */

import pg from 'pg';
import { dispatchDigest } from './notificationDispatcher.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

// Known family/shared plan monthly prices (USD). Static — never fetched.
const FAMILY_PLAN_PRICES = {
  'spotify':           16.99,
  'netflix':           22.99,
  'apple one':         25.95,
  'apple music':       16.99,
  'youtube premium':   22.99,
  'youtube':           22.99,
  'hulu':              17.99,
  'disney+':           19.99,
  'amazon prime':      23.99,
  'amazon':            23.99,
  'nintendo switch online': 34.99 / 12,
  'xbox game pass':    14.99,
  'playstation plus':  17.99,
  'paramount+':        22.99,
  'peacock':           13.99,
  'tidal':             14.99,
  'deezer':            14.99,
  'duolingo':          9.99,
};

function getFamilyPlanPrice(merchant) {
  const key = (merchant || '').toLowerCase().trim();
  return FAMILY_PLAN_PRICES[key] ?? null;
}

/**
 * Detect shared subscriptions between two linked users.
 */
export async function detectSharedSubscriptions(userIdA, userIdB, logger = console) {
  const { rows: subsA } = await pool.query(
    `SELECT merchant, renewal_amount, currency FROM subscriptions
     WHERE user_id = $1 AND is_active = true`,
    [userIdA]
  );
  const { rows: subsB } = await pool.query(
    `SELECT merchant, renewal_amount, currency FROM subscriptions
     WHERE user_id = $1 AND is_active = true`,
    [userIdB]
  );

  const merchantsB = new Map(subsB.map(s => [s.merchant.toLowerCase(), s]));

  for (const subA of subsA) {
    const key = subA.merchant.toLowerCase();
    if (!merchantsB.has(key)) continue;

    const subB = merchantsB.get(key);
    const amtA = Number(subA.renewal_amount || 0);
    const amtB = Number(subB.renewal_amount || 0);
    const combined = amtA + amtB;

    const familyPrice = getFamilyPlanPrice(subA.merchant);
    const saving = familyPrice ? Math.max(0, combined - familyPrice) : null;

    try {
      // Upsert (unique on user_id_a, user_id_b, merchant)
      await pool.query(
        `INSERT INTO shared_subscription_suggestions
           (user_id_a, user_id_b, merchant, combined_monthly_cost, suggested_saving)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id_a, user_id_b, merchant) DO UPDATE SET
           combined_monthly_cost = EXCLUDED.combined_monthly_cost,
           suggested_saving      = EXCLUDED.suggested_saving`,
        [userIdA, userIdB, subA.merchant, combined, saving]
      );

      const payload = {
        merchant: subA.merchant,
        combined,
        saving,
        currency: subA.currency || 'USD',
        partnerUserId: userIdB,
      };

      // Notify both users (digest tier — not urgent)
      const { rows: existing } = await pool.query(
        `SELECT id FROM notifications
         WHERE user_id = $1 AND type = 'shared_subscription'
           AND payload->>'merchant' = $2
           AND created_at > now() - interval '30 days'
         LIMIT 1`,
        [userIdA, subA.merchant]
      );
      if (!existing.length) {
        await dispatchDigest(userIdA, 'shared_subscription', { ...payload, partnerUserId: userIdB });
        await dispatchDigest(userIdB, 'shared_subscription', { ...payload, partnerUserId: userIdA });
      }
    } catch (err) {
      logger.warn?.({ err, merchant: subA.merchant }, '[shared-sub] error');
    }
  }
}

/**
 * Process all accepted user_links pairs.
 * Called daily from backgroundScanner.
 */
export async function processLinkedPairs(logger = console) {
  const { rows: links } = await pool.query(
    `SELECT user_id_a, user_id_b FROM user_links WHERE status = 'accepted'`
  );

  for (const link of links) {
    try {
      await detectSharedSubscriptions(link.user_id_a, link.user_id_b, logger);
    } catch (err) {
      logger.warn?.({ err }, '[shared-sub] pair failed');
    }
  }
}
