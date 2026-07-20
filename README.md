# Off-Market Tracker

Next.js property tracker backed by Supabase Auth, Postgres, and Storage.

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Auth + Postgres + Storage)
- **MapLibre** + **MapTiler** basemap

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in your Supabase project URL and anon key from **Project Settings → API**,
a server-only `INVITE_CODE` for sign-up, plus a MapTiler key for the map.

### 3. Apply the database schema

With the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

This creates the `properties` / `property_files` tables, storage buckets, and
RLS policies that require an **authenticated** user (`auth.uid() is not null`).

### 4. Enable email/password auth

In the Supabase dashboard:

1. **Authentication → Providers → Email** — enable Email provider.
2. Optionally disable **Confirm email** if you want sign-up to log users in
   immediately (otherwise they must confirm via email first).

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated visitors
are redirected to `/login`. New accounts can be created at `/signup` with the
shared `INVITE_CODE` (validated server-side before Supabase Auth sign-up).

## Project structure

```
src/
  app/                  # App Router (/, /login, /signup)
  components/           # Map, forms, detail panel, auth forms
  lib/supabase/         # Browser + server clients, middleware helper
  middleware.ts         # Session refresh + auth redirects
  types/database.ts     # Typed Database schema
supabase/
  migrations/           # SQL schema, RLS, and storage buckets
```

## Schema overview

**`properties`** — address, postcode, lat/lng, size & pricing, availability, status (`available` / `under_offer` / `let` / `withdrawn`), agent contacts, specs (plain text), notes, timestamps.

**`property_files`** — `property_id` FK, `file_url`, `file_type` (`brochure` / `image`).

**RLS** — select/insert/update/delete on tables and `images` / `brochures` storage objects require `authenticated` with `auth.uid() is not null`.
