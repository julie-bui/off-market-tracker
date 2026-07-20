# Off-Market Tracker

Next.js property tracker backed by Supabase. Open access — no authentication.

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind CSS**
- **Supabase** (Postgres + Storage)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.local.example .env.local
```

Fill in your Supabase project URL and anon key from **Project Settings → API**.

### 3. Apply the database schema

With the [Supabase CLI](https://supabase.com/docs/guides/cli) linked to your project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Or paste `supabase/migrations/20260720100000_create_property_tracker_schema.sql` into the Supabase SQL Editor and run it.

This creates:

| Table / resource | Purpose |
| --- | --- |
| `properties` | Core property records (`total_price` = `size_sqft * cost_per_sqft`) |
| `property_files` | Brochure / image file references (`file_type`: `brochure` \| `image`) |
| Storage bucket `brochures` | Public PDF uploads (max 50 MB) |
| Storage bucket `property-images` | Public image uploads (max 10 MB) |

Row Level Security is enabled with **open policies** for `anon` and `authenticated` (select/insert/update/delete). No login required.

### 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
src/
  app/                  # Next.js App Router
  lib/supabase/         # Browser + server clients, storage bucket IDs
  types/database.ts     # Typed Database schema for Supabase clients
supabase/
  migrations/           # SQL schema, RLS, and storage buckets
```

## Schema overview

**`properties`** — address, postcode, lat/lng, sector (`office` / `retail` / `industrial` / `residential` / `mixed-use`), size & pricing, availability, status (`available` / `under_offer` / `let` / `withdrawn`), tenure, lease length, agent contacts, specs (JSONB), notes, timestamps.

**`property_files`** — `property_id` FK, `file_url`, `file_type` (`brochure` / `image`).
