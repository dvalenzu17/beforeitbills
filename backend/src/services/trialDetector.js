/**
 * Free Trial Detection
 *
 * Rule-based classifier — detects trial confirmation emails and schedules
 * countdown push notifications before the trial converts to paid.
 *
 * Uses chrono-node (already in package.json) for date extraction.
 */

import pg from 'pg';
import { parse as chronoParse } from 'chrono-node';
import { parseAmount } from './subscriptionEngine.js';
import { sendPushToUser } from './pushService.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

// Subject/body patterns that indicate a free trial email
const TRIAL_SUBJECT_PATTERNS = [
  /free trial/i,
  /trial (starts?|begin|activated|confirmation)/i,
  /your trial/i,
  /trial period/i,
  /start(ed|ing) your (free )?trial/i,
];

const TRIAL_BODY_PATTERNS = [
  /free trial/i,
  /trial ends?/i,
  /trial (expires?|expiration)/i,
  /won[''']t be charged until/i,
  /you[''']ll be charged (on|after|starting)/i,
  /no charge until/i,
  /trial period (ends?|expires?)/i,
  /cancel (anytime|at any time) before/i,
  /first charge (on|after|will be)/i,
];

/**
 * Attempt to extract a trial-end date from email text.
 * Returns a Date or null.
 */
function extractTrialEndDate(text, referenceDate = new Date()) {
  if (!text) return null;

  // chrono-node finds dates mentioned in natural language
  const results = chronoParse(text, referenceDate, { forwardDate: true });
  if (!results.length) return null;

  // Prefer dates that appear near trial-related keywords
  const lower = text.toLowerCase();
  let best = null;
  let bestScore = -1;

  for (const r of results) {
    const date = r.date();
    if (!date || isNaN(date)) continue;

    // Must be in the future (trials ending in the past are not actionable)
    if (date <= referenceDate) continue;

    // Within 90 days (realistic trial window)
    const daysOut = (date - referenceDate) / (1000 * 60 * 60 * 24);
    if (daysOut > 90) continue;

    // Score by proximity to trial keywords in surrounding text
    const contextStart = Math.max(0, r.index - 100);
    const contextEnd   = Math.min(lower.length, r.index + 100);
    const context      = lower.slice(contextStart, contextEnd);

    let score = 0;
    if (/trial|charged|free|cancel/.test(context)) score += 2;
    if (/ends?|expires?|expiration|until/.test(context)) score += 1;
    if (daysOut < 45) score += 1; // prefer near-term dates

    if (score > bestScore) {
      bestScore = score;
      best = date;
    }
  }

  return best;
}

/**
 * Classify a single email as a trial email.
 *
 * @param {string} subject
 * @param {string} body      - plain text or snippet
 * @returns {{ isTrial: boolean, trialEndDate: Date|null, amountAfterTrial: number|null }}
 */
export function classifyTrialEmail(subject = '', body = '') {
  const subjectMatch = TRIAL_SUBJECT_PATTERNS.some(p => p.test(subject));
  const bodyMatch    = TRIAL_BODY_PATTERNS.some(p => p.test(body));

  if (!subjectMatch && !bodyMatch) {
    return { isTrial: false, trialEndDate: null, amountAfterTrial: null };
  }

  const combined     = `${subject} ${body}`;
  const trialEndDate = extractTrialEndDate(combined);

  // Only treat as actionable if we found a date
  if (!trialEndDate) {
    return { isTrial: false, trialEndDate: null, amountAfterTrial: null };
  }

  // Try to extract the amount that will be charged after trial
  const amountAfterTrial = parseAmount(combined) || null;

  return { isTrial: true, trialEndDate, amountAfterTrial };
}

/**
 * Process emails from a scan looking for trial records.
 * Upserts into subscription_trials (skips if user already has confirmed sub for merchant).
 *
 * @param {string} userId
 * @param {Array}  emails   - array of email objects with { subject, snippet, merchant }
 * @param {object} logger
 */
export async function processTrialEmails(userId, emails, logger = console) {
  let found = 0;

  for (const email of (emails || [])) {
    const subject = email.subject || '';
    const body    = email.snippet || email.text || '';

    const { isTrial, trialEndDate, amountAfterTrial } = classifyTrialEmail(subject, body);
    if (!isTrial || !trialEndDate) continue;

    // Need a merchant name — use the email's merchant field or skip
    const merchant = email.merchant || email.normalizedMerchant;
    if (!merchant) continue;

    // Skip if user already has an active confirmed subscription for this merchant
    const { rows: existing } = await pool.query(
      `SELECT id FROM subscriptions
       WHERE user_id = $1 AND merchant = $2 AND is_active = true AND user_status = 'confirmed'
       LIMIT 1`,
      [userId, merchant]
    );
    if (existing.length) continue;

    // Upsert trial record
    try {
      await pool.query(
        `INSERT INTO subscription_trials
           (user_id, merchant, trial_end_date, amount_after_trial, currency)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, merchant, trial_end_date) DO NOTHING`,
        [userId, merchant, trialEndDate.toISOString().slice(0, 10), amountAfterTrial, email.currency || 'USD']
      );
      found++;
    } catch (err) {
      logger.warn?.({ err, merchant }, '[trial] upsert failed');
    }
  }

  if (found > 0) {
    logger.info?.({ userId, found }, '[trial] trial records saved');
  }
}

/**
 * Scheduled check: fire push notifications for trials ending in 3 or 1 day.
 * Called daily from node-cron in backgroundScanner.js.
 */
export async function checkTrialNotifications(logger = console) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const threeDaysOut = new Date(today);
  threeDaysOut.setDate(threeDaysOut.getDate() + 3);

  const oneDayOut = new Date(today);
  oneDayOut.setDate(oneDayOut.getDate() + 1);

  // Trials ending in exactly 3 days (not yet notified)
  await fireTrialNotifications(threeDaysOut, 3, 'notified_3day', logger);

  // Trials ending in exactly 1 day (not yet notified)
  await fireTrialNotifications(oneDayOut, 1, 'notified_1day', logger);
}

async function fireTrialNotifications(targetDate, daysLeft, notifiedCol, logger) {
  const dateStr = targetDate.toISOString().slice(0, 10);

  const { rows: trials } = await pool.query(
    `SELECT id, user_id, merchant, amount_after_trial, currency
     FROM subscription_trials
     WHERE trial_end_date = $1 AND ${notifiedCol} = false`,
    [dateStr]
  );

  for (const trial of trials) {
    try {
      const sym     = currencySymbol(trial.currency);
      const dayWord = daysLeft === 1 ? 'tomorrow' : `in ${daysLeft} days`;
      const title   = `${trial.merchant} trial ends ${dayWord}`;
      const body    = trial.amount_after_trial
        ? `You'll be charged ${sym}${Number(trial.amount_after_trial).toFixed(2)}/mo after your trial.`
        : 'Remember to cancel if you don\'t want to be charged.';

      await sendPushToUser(trial.user_id, title, body, {
        type:     'trial_ending',
        merchant: trial.merchant,
        daysLeft,
      }, logger);

      // Mark as notified
      await pool.query(
        `UPDATE subscription_trials SET ${notifiedCol} = true, updated_at = now()
         WHERE id = $1`,
        [trial.id]
      );
    } catch (err) {
      logger.warn?.({ err, trialId: trial.id }, '[trial] notification failed');
    }
  }
}

function currencySymbol(currency) {
  switch ((currency || 'USD').toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'GBP': return '£';
    case 'CAD': return 'CA$';
    default:    return `${currency} `;
  }
}
