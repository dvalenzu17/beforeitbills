# App Store Review — Demo Account & Notes

## Demo Credentials for App Store Connect

Before each submission, enter these in **App Store Connect → App Information → App Review Information**:

- **Demo Account Required**: Yes
- **Username**: `appreview@beforeitbills.com`
- **Password**: `ReviewBIB2026!`

### Setting up the demo account in Supabase

1. Go to your Supabase dashboard → Authentication → Users
2. Create a new user with the email and password above
3. Mark the user's `onboarding_done` metadata as `true` so the reviewer lands on the main app
4. (Optional) Add a few sample subscriptions to the user's account so the reviewer sees a populated dashboard

```sql
-- Run in Supabase SQL editor after creating the auth user:
-- Replace <USER_ID> with the UUID from the auth.users table

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"onboarding_done": true}'::jsonb
WHERE email = 'appreview@beforeitbills.com';

-- Add sample subscriptions so the reviewer sees a populated dashboard
INSERT INTO subscriptions (user_id, merchant, amount, currency, cadence, next_renewal, active, confidence, source)
VALUES
  ('<USER_ID>', 'Netflix', 15.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '15 days', true, 1.0, 'manual'),
  ('<USER_ID>', 'Spotify', 10.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '22 days', true, 1.0, 'manual'),
  ('<USER_ID>', 'iCloud+', 2.99, 'USD', 'monthly', CURRENT_DATE + INTERVAL '8 days', true, 1.0, 'manual');
```

## Review Notes Template

Paste this in **App Store Connect → App Review Information → Notes**:

```
Demo account credentials:
Email: appreview@beforeitbills.com
Password: ReviewBIB2026!

Sign in using the "Sign In" tab (email + password) — no Google account required.

BeforeItBills helps users discover and track recurring subscriptions by scanning their email inbox. The demo account is pre-populated with sample subscriptions so you can explore the full app experience without connecting an email account.

Core features available without a subscription:
- View and manually add recurring subscriptions
- See spending insights (limited)
- Set bill reminders

Pro features (available via in-app purchase):
- Unlimited inbox scanning
- Price-change alerts
- Full spending analytics
- CSV/PDF export
```

## Checklist before each submission

- [ ] Demo account exists in Supabase with `onboarding_done: true`
- [ ] Demo account has sample subscriptions populated
- [ ] Demo credentials entered in App Store Connect review info
- [ ] Review notes pasted in App Store Connect
- [ ] Verified email+password sign-in works with demo credentials
- [ ] RevenueCat sandbox products are configured and purchasable
