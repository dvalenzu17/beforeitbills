-- Mail connections (OAuth tokens). Store refresh tokens with RLS.
-- NOTE: You should consider encrypting refresh_token at rest (Vault, KMS, etc).

create table if not exists public.mail_connections (
  user_id uuid not null,
  provider text not null,
  access_token text,
  refresh_token text,
  scope text,
  token_type text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.mail_connections enable row level security;

create policy "mail_connections_select_own" on public.mail_connections
  for select
  using (auth.uid() = user_id);

create policy "mail_connections_update_own" on public.mail_connections
  for update
  using (auth.uid() = user_id);

create policy "mail_connections_insert_own" on public.mail_connections
  for insert
  with check (auth.uid() = user_id);

-- Suggestions from email scans (review before adding)
create table if not exists public.mail_subscription_suggestions (
  user_id uuid not null,
  provider text not null,
  message_id text not null,
  merchant text,
  amount numeric,
  currency text,
  cadence text,
  confidence numeric,
  raw_subject text,
  raw_from text,
  raw_date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider, message_id)
);

alter table public.mail_subscription_suggestions enable row level security;

create policy "mail_suggestions_select_own" on public.mail_subscription_suggestions
  for select
  using (auth.uid() = user_id);

create policy "mail_suggestions_insert_own" on public.mail_subscription_suggestions
  for insert
  with check (auth.uid() = user_id);

create policy "mail_suggestions_update_own" on public.mail_subscription_suggestions
  for update
  using (auth.uid() = user_id);

create policy "mail_suggestions_delete_own" on public.mail_subscription_suggestions
  for delete
  using (auth.uid() = user_id);
