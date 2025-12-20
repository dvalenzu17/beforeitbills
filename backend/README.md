# Sublytics Backend (Email scan MVP)

This is a tiny Express backend that:
- Exchanges Google OAuth code for tokens (stores refresh token)
- Scans Gmail (read-only) for subscription-ish charges
- Optionally uses an LLM fallback for borderline emails

## Run

```bash
cd backend
cp .env.example .env
npm i
npm run dev
```

## Required Supabase tables

Run the SQL in `../supabase/migrations/20251219_mail.sql` in your Supabase SQL editor.
