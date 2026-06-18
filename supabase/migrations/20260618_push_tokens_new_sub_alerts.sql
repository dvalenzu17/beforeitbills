-- Per-user preference for "new subscription detected" push notifications.
--
-- Written by the app (lib/push.js → updateNewSubAlertPref) when the user flips
-- the "New subscription alerts" toggle, and honored by the backend
-- (email-import-api → getPushTokensForUser) which only pushes to tokens where
-- this is not false.
--
-- Default true = opted in, so existing rows keep receiving alerts.

alter table public.push_tokens
  add column if not exists new_sub_alerts boolean not null default true;
