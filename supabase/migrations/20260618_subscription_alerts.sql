-- Server-side time-based subscription alerts: big-renewal heads-up and
-- trial-ending. Both are driven by the backend cron and need (a) trial dates
-- stored server-side and (b) a dedup ledger so an alert fires once per occurrence.

-- trial_end: when a free trial converts to a paid charge. Written by the app
-- (lib/store.js mapLocalToDb) and read by the backend cron.
alter table public.subscriptions
  add column if not exists trial_end timestamptz;

-- Dedup ledger. period_key identifies the specific occurrence being alerted
-- (e.g. the renewal/trial date), so the same renewal isn't re-alerted every
-- cron cycle. When the date advances next billing period, a new period_key
-- allows the next alert.
create table if not exists public.subscription_alerts (
  id              bigserial primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  alert_type      text not null,            -- 'renewal' | 'trial_ending'
  period_key      text not null,            -- occurrence id (the date being alerted)
  sent_at         timestamptz not null default now(),
  unique (subscription_id, alert_type, period_key)
);

create index if not exists subscription_alerts_user_idx
  on public.subscription_alerts (user_id, sent_at desc);
