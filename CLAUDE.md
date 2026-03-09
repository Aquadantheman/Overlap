# CLAUDE.md - The Overlap
*Last updated: 2026-03-09*

## What This Is

A tool that lets people find nearby neighbors who share specific interests - foraging, fermentation, trail running, homebrewing, urban sketching, etc.

**Not a loneliness app. Not a friendship app. Not a dating app.**

The framing is addition, not deficit. Users aren't here because they're lonely - they're here because they forage and want to know who else does within a few miles. The connection is almost incidental to the activity. This distinction drives every product and copy decision.

Read `OVERLAP_FEATURE_DESIGN.md` before building any user-facing feature.

---

## Stack & Location

- **Next.js 16** + TypeScript + Tailwind CSS
- **Supabase** - PostgreSQL + Auth
- **Vercel** deployment
- **Local path:** `C:\Users\Linde\Dev\overlap`

---

## Critical Next.js 16 Rule

Middleware file is `src/proxy.ts`, NOT `middleware.ts`.
Export must be named `proxy`, NOT `middleware`.

---

## Supabase

- URL: `https://fclycscjzdfddzncvasn.supabase.co`
- Anon key: in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Auth

- Email/password, no email confirmation (disabled in Supabase - do not re-enable)
- Supabase client MUST be singleton (`src/lib/supabase/client.ts`) - multiple instances break session persistence
- Auth uses Supabase's built-in cookie-based sessions (no manual token passing)

---

## Current State

### Done
- Next.js 16 scaffolded with TypeScript + Tailwind
- Supabase schema: `profiles`, `activities`, `user_interests`, `me_too_signals`
- RLS policies on all tables
- 37 activities seeded (tier 1 + tier 2)
- Signin/signup page with email/password
- Route protection via `src/proxy.ts`
- **Full onboarding flow:**
  - Step 1: Handle + phone number (hashed)
  - Step 2: Location (zip, neighborhood, radius) + comfort level (open/group_only)
  - Step 3: Interests with frequency/level per activity (max 7)
  - Geocoding via zippopotam.us API
  - Saves to DB on completion
- **Overlap view:**
  - Shows clusters ("3 people also forage")
  - Shows recency ("2 active this week")
  - "Me too" signal button on each cluster
  - Mutual matches section when both parties have signaled
- **Me too mechanic:**
  - Tap to signal interest in an activity cluster
  - Neither party knows until both have tapped
  - Simultaneous reveal when mutual
  - Unlocks ability to send ping (not yet implemented)

### Next Tasks
1. Soft ping system - templated activity-framed messages
2. Connections flow - mutual opt-in to connect
3. Meetups - group-first meeting proposals
4. Trust signals - post-meetup feedback
5. Settings page - edit profile, change interests

---

## DB Schema

```sql
-- Core tables
profiles          id, handle, phone_hash, zip_code, neighborhood,
                  radius_miles, lat, lng, comfort_level

activities        id, label, verb, category, parent_id, tier, status

user_interests    user_id, activity_id, frequency, level, created_at

me_too_signals    user_id, activity_id, created_at
                  UNIQUE(user_id, activity_id)

-- Future tables (designed, not yet needed)
connections       initiator_id, receiver_id, shared_activity_ids[],
                  status, group_meetup_completed

soft_pings        sender_id, receiver_id, message (140 char max),
                  activity_context_id, template_used

meetups           proposer_id, connection_id, neighborhood,
                  venue_type (public only), min_attendees, status

trust_signals     from_user_id, to_user_id, signal_type (positive/silent),
                  surfaced_after_meetup_id (required)
```

### Required Schema Additions
Run these in Supabase SQL editor:

```sql
-- Add columns to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lng double precision,
ADD COLUMN IF NOT EXISTS phone_hash text,
ADD COLUMN IF NOT EXISTS comfort_level text DEFAULT 'open';

-- Add columns to user_interests
ALTER TABLE user_interests
ADD COLUMN IF NOT EXISTS frequency text,
ADD COLUMN IF NOT EXISTS level text;

-- Create me_too_signals table
CREATE TABLE IF NOT EXISTS me_too_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  activity_id uuid REFERENCES activities NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, activity_id)
);

-- RLS for me_too_signals
ALTER TABLE me_too_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own signals" ON me_too_signals
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can read signals for matching" ON me_too_signals
  FOR SELECT USING (true);
```

---

## Feature Rules (enforce in all code)

- Interest cap: **7 max per user** (enforced in UI)
- Meetup proposals require **minimum 3 people** in overlap
- **Group-first:** one-on-one only unlocks after `group_meetup_completed = true`
- Soft pings are **activity-framed** - tied to activity, not a blank message
- Active pending pings are **capped** (target: 5-7 max)
- Trust signals require `surfaced_after_meetup_id` - invalid without a real meetup
- Meetup venues: **public only** - no address field exists anywhere
- Overlap view: **never show individual profiles** - clusters only
- Show recency ("active this week"), not just raw counts
- **Never fake density**

---

## Anti-Creep Rules

- Never expose precise GPS - zip + radius only
- No free-form DMs until mutual opt-in
- Trust signals: positive or silent only, never public
- No engagement metrics, no compatibility scores, no sorting by personal attributes
- Soft pings: 140 char max, no links
- The "me too" signal is simultaneous reveal - neither party sees the other tapped until both have

---

## File Map

```
src/
  app/
    (auth)/
      onboarding/          OnboardingFlow.tsx, StepHandle, StepLocation, StepInterests
      signin/              Email/password auth
    (main)/
      overlap/             Overlap view with me-too signals
      connections/         (empty - not yet built)
      settings/            (empty - not yet built)
  lib/
    supabase/
      client.ts            Singleton browser client
      server.ts            SSR client via @supabase/ssr
    geo/
      geocode.ts           Zip code to lat/lng via zippopotam.us
    matching/
      findOverlaps.ts      Haversine distance + shared activity matching
      meToo.ts             Signal/remove/find mutual matches
    utils.ts               cn() helper + phone hashing
  types/index.ts           Shared type definitions
  proxy.ts                 Route protection middleware
```

---

## Ignore These Warnings

- Grammarly hydration warnings - harmless
- Font preload warnings - harmless
