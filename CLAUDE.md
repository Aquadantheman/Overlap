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
- **GitHub:** https://github.com/Aquadantheman/Overlap

---

## Critical Next.js 16 Rule

Middleware file is `src/proxy.ts`, NOT `middleware.ts`.
Export must be named `proxy`, NOT `middleware`.

---

## Supabase

- URL: `https://fclycscjzdfddzncvasn.supabase.co`
- Anon key: in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Client uses `@supabase/ssr` with `createBrowserClient` for proper cookie sessions

---

## Auth

- Email/password, no email confirmation (disabled in Supabase - do not re-enable)
- Supabase client MUST be singleton (`src/lib/supabase/client.ts`) - multiple instances break session persistence
- Auth uses Supabase's built-in cookie-based sessions (no manual token passing)

---

## Current State

### Complete
- **Auth:** Email/password signin/signup, route protection via `src/proxy.ts`
- **Onboarding (3 steps):**
  - Handle + phone number (hashed)
  - Location (zip, neighborhood, radius 1-15mi slider) + comfort level
  - Interests with frequency/level per activity (max 7)
  - Geocoding via zippopotam.us API
- **Overlap view:**
  - Activity clusters ("3 people also forage")
  - Recency signals ("2 active this week")
  - "Me too" button per cluster
  - Mutual matches section (simultaneous reveal)
- **Soft ping system:**
  - Activity-framed pings with timeframe
  - 140 char message limit, no links
  - 5 pending ping cap
  - Accept/decline flow
- **Connections:**
  - Created when ping is accepted
  - Tracks shared activities
- **Settings page:**
  - Neighborhood, radius slider, comfort level
  - Interest management (Active/Quiet toggle, edit, replace)
- **Network graph:**
  - Force-directed visualization of connections
  - Physics-tuned for small graphs
- **Interest decay system:**
  - `is_active` flag (Active vs Quiet interests)
  - `last_engaged_at` updated on me-too signals and pings
  - Only active interests participate in matching

### Not Yet Built
1. **Meetups** - Group proposals, scheduling, completion tracking
2. **Trust signals** - Post-meetup feedback (requires meetups)
3. **Group-first unlock** - 1-on-1 only after `group_meetup_completed = true`
4. **Notifications** - Real-time updates for pings, matches
5. **Scene growth data** - "This number went from 8 to 14"

---

## DB Schema

```sql
-- Core tables (all exist)
profiles          id, handle, phone_hash, zip_code, neighborhood,
                  radius_miles (1-15), lat, lng, comfort_level

activities        id, label, verb, category, parent_id, tier, status

user_interests    user_id, activity_id, frequency, level,
                  is_active (bool), last_engaged_at, created_at

me_too_signals    user_id, activity_id, created_at
                  UNIQUE(user_id, activity_id)

soft_pings        sender_id, receiver_id, activity_id, timeframe,
                  message (140 char max, no links), status,
                  created_at, responded_at

connections       initiator_id, receiver_id, shared_activity_ids[],
                  status, connected_at

-- Future tables (not yet created)
meetups           proposer_id, connection_id, neighborhood,
                  venue_type (public only), min_attendees, status

trust_signals     from_user_id, to_user_id, signal_type (positive/silent),
                  surfaced_after_meetup_id (required)
```

---

## Feature Rules (enforce in all code)

- Interest cap: **7 max per user** (enforced in UI)
- Active interests only participate in matching (Quiet interests are paused)
- Meetup proposals require **minimum 3 people** in overlap
- **Group-first:** one-on-one only unlocks after `group_meetup_completed = true`
- Soft pings are **activity-framed** - tied to activity, not a blank message
- Active pending pings are **capped at 5**
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
- Soft pings: 140 char max, no links (validated in code)
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
      overlap/             Overlap view with me-too signals and pings
      network/             Force-directed connection graph
      settings/            Profile settings + InterestManager
  components/
    InterestManager.tsx    Active/Quiet toggle, edit, replace interests
    NetworkGraph.tsx       Force-directed graph visualization
  lib/
    supabase/
      client.ts            Singleton browser client (@supabase/ssr)
      server.ts            SSR client
    geo/
      geocode.ts           Zip code to lat/lng via zippopotam.us
    matching/
      findOverlaps.ts      Haversine distance + shared activity matching
      meToo.ts             Signal/remove/find mutual matches
    pings/
      softPing.ts          Send, receive, respond to pings
    graph/
      networkGraph.ts      Build graph data from connections
    utils.ts               cn() helper + phone hashing
  types/index.ts           Shared type definitions
  proxy.ts                 Route protection middleware
```

---

## Ignore These Warnings

- Grammarly hydration warnings - harmless
- Font preload warnings - harmless
