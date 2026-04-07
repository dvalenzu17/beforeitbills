// backend/src/routes/parseRoutes.js
import { z } from 'zod';
import { requireUser } from '../lib/auth.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const bodySchema = z.object({
  text: z.string().min(2).max(400),
});

// Valid cadences the app understands
const CADENCES = ['monthly', 'yearly', 'weekly', 'quarterly'];

const SYSTEM_PROMPT = `You are a subscription parser for a personal finance app.
Extract subscription/bill details from natural language. Return ONLY valid JSON with these fields:
- name: string (merchant/service name, title-cased, e.g. "Netflix", "Adobe Creative Cloud")
- amount: number | null (numeric value only, no currency symbols)
- currency: string | null (3-letter ISO code inferred from context, default "USD" if amount is mentioned but currency is unclear)
- cadence: "monthly" | "yearly" | "weekly" | "quarterly" | null
- nextRenewal: string | null (YYYY-MM-DD if a specific date is mentioned, otherwise null)
- kind: "subscription" | "bill" (subscriptions recur automatically; bills are one-off or utility charges)
- notes: string | null (any extra context worth preserving, max 60 chars)

Rules:
- If a field cannot be determined, use null. Never guess amounts.
- "per month", "monthly", "/mo", "/month" → cadence: "monthly"
- "per year", "annual", "/yr", "yearly" → cadence: "yearly"
- "per week", "weekly" → cadence: "weekly"
- "per quarter", "quarterly" → cadence: "quarterly"
- Currency symbols: $ → USD, € → EUR, £ → GBP, CA$ or C$ → CAD
- If the text says "trial", set notes to "trial"
- Do NOT include any text outside the JSON object.`;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function callOpenAI(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Today is ${todayISO()}. Parse this: "${text}"`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown error');
    throw new Error(`OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI');
  return JSON.parse(raw);
}

function sanitize(parsed) {
  const name     = typeof parsed.name === 'string' ? parsed.name.trim().slice(0, 100) : null;
  const amount   = typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) && parsed.amount > 0
    ? Math.round(parsed.amount * 100) / 100
    : null;
  const currency = typeof parsed.currency === 'string' ? parsed.currency.toUpperCase().slice(0, 3) : null;
  const cadence  = CADENCES.includes(parsed.cadence) ? parsed.cadence : null;
  const kind     = parsed.kind === 'bill' ? 'bill' : 'subscription';

  // Validate YYYY-MM-DD format
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const nextRenewal = typeof parsed.nextRenewal === 'string' && dateRe.test(parsed.nextRenewal)
    ? parsed.nextRenewal
    : null;

  const notes = typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 60) : null;

  return { name, amount, currency, cadence, kind, nextRenewal, notes };
}

export function registerParseRoutes(server) {
  server.post('/parse-subscription', {
    config: {
      rateLimit: { max: 20, timeWindow: '1 minute' },
    },
    handler: async (req, reply) => {
      const auth = requireUser(req, reply);
      if (!auth) return;

      if (!OPENAI_API_KEY) {
        return reply.code(503).send({
          error: 'service_unavailable',
          message: 'Natural language parsing is not configured on this server.',
        });
      }

      const parsed = bodySchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_request',
          details: parsed.error.flatten(),
        });
      }

      try {
        const raw = await callOpenAI(parsed.data.text);
        const result = sanitize(raw);

        if (!result.name) {
          return reply.code(422).send({
            error: 'parse_failed',
            message: 'Could not identify a subscription name from that text.',
          });
        }

        return reply.send({ ok: true, result });
      } catch (e) {
        req.log.error({ err: e }, '[parse] OpenAI call failed');
        return reply.code(502).send({
          error: 'upstream_error',
          message: 'Parsing failed. You can fill in the details manually.',
        });
      }
    },
  });
}
