-- Mail connections (store tokens). For MVP we store tokens as-is.
-- In production: encrypt refresh tokens at rest.

create table if not exists public.mail_connections (
  user_id uuid not null,
  provider text not null,
  access_token text,
  refresh_token text,
  expires_at timestamp with time zone,
  scope text,
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  primary key (user_id, provider)
);

alter table public.mail_connections enable row level security;

-- Only the owner can read/write their connection (backend uses service role anyway)
create policy if not exists "mail_connections_owner" on public.mail_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Suggestions discovered from email scanning (user reviews + imports)
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
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now(),
  primary key (user_id, provider, message_id)
);

alter table public.mail_subscription_suggestions enable row level security;

create policy if not exists "mail_suggestions_owner" on public.mail_subscription_suggestions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
