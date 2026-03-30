-- Cleanup / forward migration for mail tables.
-- Safe to run even if you already applied earlier migrations.

-- Add missing columns to mail_connections
alter table if exists public.mail_connections
  add column if not exists token_type text,
  add column if not exists expires_at timestamptz,
  add column if not exists client_id text;

-- Ensure updated_at exists
alter table if exists public.mail_connections
  add column if not exists updated_at timestamptz default now();

-- Suggestions: ensure updated_at exists
alter table if exists public.mail_subscription_suggestions
  add column if not exists updated_at timestamptz default now();

-- Indexes to speed up scan review screens
create index if not exists mail_suggestions_user_idx on public.mail_subscription_suggestions (user_id, created_at desc);
