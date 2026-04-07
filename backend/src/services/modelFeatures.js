/**
 * Feature vector extraction for the subscription ML model.
 *
 * Each feature is a number in [0, 1]. The vector is passed to
 * subscriptionModel.js for logistic regression scoring.
 *
 * Features are designed to be interpretable — every weight in the model
 * maps to a named feature here.
 */

import { brandFromDomain } from './subscriptionEngine.js';

// Known subscription-dominant domains (not one-time senders)
const SUBSCRIPTION_DOMAINS = new Set([
  'netflix', 'spotify', 'hulu', 'disney', 'hbo', 'max', 'peacock', 'paramount',
  'apple', 'google', 'microsoft', 'adobe', 'dropbox', 'notion', 'slack',
  'github', 'zoom', 'canva', 'figma', 'grammarly', 'audible', 'twitch',
  'crunchyroll', 'duolingo', 'headspace', 'calm', 'peloton', 'medium',
  'substack', 'patreon', 'openai', 'claude', 'cursor', 'vercel', 'netlify',
  'datadog', 'sentry', 'intercom', 'zendesk', 'hubspot', 'salesforce',
  'mailchimp', 'airtable', 'asana', 'monday', 'trello', 'jira', 'atlassian',
  'linkedin', 'youtube', 'chatgpt',
]);

const ONE_TIME_DOMAINS = new Set([
  'amazon', 'ebay', 'etsy', 'walmart', 'target', 'bestbuy',
  'doordash', 'ubereats', 'grubhub', 'instacart',
  'lyft', 'uber', 'airbnb', 'booking', 'expedia', 'eventbrite',
]);

/**
 * Extract a feature vector from an email candidate.
 *
 * @param {{ subject, from, snippet, senderDomain, amount, bodyText? }} candidate
 * @returns {number[]} feature vector of length FEATURE_NAMES.length
 */
export function extractFeatures(candidate) {
  const { subject = '', from = '', snippet = '', senderDomain = '', amount, bodyText = '' } = candidate;
  const allLow  = `${subject} ${from} ${snippet} ${bodyText}`.toLowerCase();
  const subLow  = subject.toLowerCase();
  const brand   = brandFromDomain(senderDomain);

  return [
    // 0: subject contains "subscription"
    subLow.includes('subscription') ? 1 : 0,
    // 1: subject contains "renewal" or "renew"
    (subLow.includes('renewal') || subLow.includes('renew')) ? 1 : 0,
    // 2: subject contains "membership"
    subLow.includes('membership') ? 1 : 0,
    // 3: subject contains "billing" or "billed" or "charge"
    (subLow.includes('billing') || subLow.includes('billed') || subLow.includes('charged')) ? 1 : 0,
    // 4: subject contains "plan"
    subLow.includes('plan') ? 1 : 0,
    // 5: subject contains "invoice" or "receipt"
    (subLow.includes('invoice') || subLow.includes('receipt')) ? 1 : 0,
    // 6: a dollar/euro/gbp amount is present
    amount != null && amount > 0 ? 1 : 0,
    // 7: cadence keyword present (monthly, yearly, weekly, quarterly)
    (allLow.includes('monthly') || allLow.includes('yearly') || allLow.includes('weekly') || allLow.includes('quarterly') || allLow.includes('annual')) ? 1 : 0,
    // 8: sender is a known subscription brand
    SUBSCRIPTION_DOMAINS.has(brand) ? 1 : 0,
    // 9: explicit auto-renew or "renews on"
    (allLow.includes('auto-renew') || allLow.includes('auto renew') || allLow.includes('renews on')) ? 1 : 0,
    // 10 (penalty): one-time purchase / shipping signals
    (allLow.includes('your order') || allLow.includes('shipped') || allLow.includes('delivered') || allLow.includes('delivery') || allLow.includes('tracking') || allLow.includes('order confirmation')) ? 1 : 0,
    // 11 (penalty): auth / account security emails
    (allLow.includes('password') || allLow.includes('verify') || allLow.includes('sign in') || allLow.includes('security code') || allLow.includes('login')) ? 1 : 0,
    // 12 (penalty): sender is a known one-time purchase brand
    ONE_TIME_DOMAINS.has(brand) ? 1 : 0,
    // 13: free trial signals
    (allLow.includes('free trial') || allLow.includes('trial period') || allLow.includes('trial ends')) ? 1 : 0,
    // 14: body text was available (signal that we have richer context)
    bodyText.length > 50 ? 1 : 0,
  ];
}

export const FEATURE_NAMES = [
  'subject_subscription', 'subject_renewal', 'subject_membership', 'subject_billing',
  'subject_plan', 'subject_invoice_receipt', 'has_amount', 'has_cadence',
  'known_sub_brand', 'explicit_auto_renew',
  'PENALTY_order_ship', 'PENALTY_auth_security', 'PENALTY_one_time_brand',
  'trial_signal', 'has_body_text',
];
