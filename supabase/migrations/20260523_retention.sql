-- ============================================================
-- Retention Feature Suite — Background Monitoring, Price Change,
-- Trial Detection, Annual Renewal, Re-billing, Creep Score, Digest
-- ============================================================

-- ── Profiles extensions ────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists last_background_scan_at timestamptz,
  add column if not exists first_scan_at            timestamptz,
  add column if not exists baseline_monthly_spend   numeric,
  add column if not exists current_creep_score      numeric;

create index if not exists profiles_last_bg_scan_idx
  on public.profiles (last_background_scan_at);

-- ── Subscriptions extensions ──────────────────────────────────────────────────

alter table public.subscriptions
  add column if not exists annual_renewal_date date;

-- ── push_tokens — ensure table exists ────────────────────────────────────────
-- (frontend already upserts here via lib/push.js; we just guarantee the schema)

create table if not exists public.push_tokens (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  token      text not null,
  device     text,
  created_at timestamptz not null default now(),
  unique(user_id, token)
);

create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- ── subscription_price_history ────────────────────────────────────────────────

create table if not exists public.subscription_price_history (
  id              bigserial primary key,
  subscription_id uuid        not null references public.subscriptions(id) on delete cascade,
  user_id         uuid        not null,
  amount          numeric,
  currency        text        not null default 'USD',
  detected_at     timestamptz not null default now()
);

create index if not exists sub_price_history_sub_idx
  on public.subscription_price_history (subscription_id, detected_at desc);

create index if not exists sub_price_history_user_idx
  on public.subscription_price_history (user_id, detected_at desc);

-- ── subscription_trials ───────────────────────────────────────────────────────

create table if not exists public.subscription_trials (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null,
  merchant           text        not null,
  trial_end_date     date        not null,
  amount_after_trial numeric,
  currency           text        not null default 'USD',
  notified_3day      boolean     not null default false,
  notified_1day      boolean     not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique(user_id, merchant, trial_end_date)
);

create index if not exists sub_trials_user_idx
  on public.subscription_trials (user_id, trial_end_date);

-- ── subscription_events — deduplication and audit log ────────────────────────

create table if not exists public.subscription_events (
  id              bigserial   primary key,
  subscription_id uuid        references public.subscriptions(id) on delete cascade,
  user_id         uuid        not null,
  event_type      text        not null,
  metadata        jsonb,
  created_at      timestamptz not null default now()
);

-- Prevent firing the same event type more than once per subscription per month.
-- event_type values: 'annual_warning', 'rebilling', 'price_increase', 'price_decrease',
--                    'anniversary_digest', 'new_subscription'
create unique index if not exists sub_events_monthly_dedup_idx
  on public.subscription_events (subscription_id, event_type, date_trunc('month', created_at))
  where subscription_id is not null;

-- user-level events (anniversary_digest) deduplicated per year
create unique index if not exists sub_events_user_annual_dedup_idx
  on public.subscription_events (user_id, event_type, date_trunc('year', created_at))
  where subscription_id is null;

create index if not exists sub_events_user_idx
  on public.subscription_events (user_id, created_at desc);
