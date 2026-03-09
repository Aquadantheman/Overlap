# The Overlap - Project Context
*Last updated: 2026-03-09*

## What It Is

A tool that lets people find nearby neighbors who share specific interests - foraging, fermentation, urban sketching, trail running, homebrewing, and so on.

**Not a loneliness app. Not a friendship app. Not a dating app.**

For anyone whose existing circle doesn't share a specific interest they care about. The connection is almost incidental - users are here because they forage and want to know who else does within a few miles. That reframe is everything. See OVERLAP_FEATURE_DESIGN.md for the full philosophy.

## Stack
- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS
- **Backend/DB:** Supabase (PostgreSQL + Auth)
- **Deployment:** Vercel
- **Local path:** `C:\Users\Linde\Dev\overlap`

## Supabase Project
- **Project ID:** `fclycscjzdfddzncvasn`
- **URL:** `https://fclycscjzdfddzncvasn.supabase.co`
- **Auth:** Email/password only, no email confirmation

## Implementation Status

### Complete

**Auth & Routing**
- Email/password signin/signup
- Cookie-based session management via `@supabase/ssr`
- Route protection via proxy.ts middleware

**Onboarding (3 steps)**
1. **Handle + Phone** - Handle (2-24 chars), phone number (hashed, never displayed)
2. **Location** - Zip code (geocoded to lat/lng), neighborhood, radius (1-15mi slider), comfort level
3. **Interests** - Select activities with frequency/level per activity, max 7 enforced

**Overlap View**
- Shows activity clusters ("3 people also forage")
- Shows recency signals ("2 active this week")
- "Me too" button on each cluster
- Mutual matches section when both parties signal
- Ping sending from mutual matches

**Me Too Mechanic**
- Tap to signal interest in an activity overlap
- Signal is private until reciprocated
- Simultaneous reveal when mutual
- Unlocks ability to send ping

**Soft Ping System**
- Activity-framed pings with timeframe selection (this week, weekend, next week, flexible)
- Optional message (140 char max, no links - validated in code)
- 5 pending ping cap per user
- Accept/decline flow for recipients
- Connection created on acceptance

**Connections**
- Created when ping is accepted
- Tracks shared activity IDs
- Visible in network graph

**Settings Page**
- Edit neighborhood, radius (1-15mi slider), comfort level
- Interest management:
  - Active/Quiet toggle (only active interests participate in matching)
  - Edit frequency/level inline
  - Replace (swap) interests
  - Add new interests (if under 7)
- Sign out

**Network Graph**
- Force-directed visualization of connections
- Shows shared activities between connected users
- Physics tuned for small graphs (2-10 nodes)

**Interest Decay System**
- `is_active` boolean flag (Active vs Quiet)
- `last_engaged_at` timestamp updated on:
  - Signaling "me too" on an activity
  - Sending a ping for an activity
- Only active interests participate in overlap matching

### Not Yet Built

- **Meetups** - Group-first proposals, scheduling, completion tracking
- **Trust signals** - Post-meetup feedback (requires meetups first)
- **Group-first unlock** - 1-on-1 only after `group_meetup_completed = true` on connection
- **Notifications** - Real-time updates for pings, matches, etc.
- **Scene growth data** - "This number went from 8 to 14 this month"

## Database Schema

### Current Tables

```sql
profiles
  id uuid PK (= auth.users.id)
  handle text UNIQUE
  phone_hash text
  zip_code text
  neighborhood text
  radius_miles int (1-15, continuous)
  lat double precision
  lng double precision
  comfort_level text ('open' | 'group_only')
  created_at timestamptz

activities
  id uuid PK
  label text ("Foraging wild food")
  verb text ("I forage")
  category text (nature, making, movement, food, music, learning, games, community, arts, technology)
  parent_id uuid (for tier 2 under tier 1)
  tier int (1 or 2)
  status text ('active')

user_interests
  user_id uuid FK
  activity_id uuid FK
  frequency text ('yearly', 'monthly', 'weekly')
  level text ('beginner', 'casual', 'experienced')
  is_active boolean (default true) -- Active vs Quiet
  last_engaged_at timestamptz -- for interest decay
  created_at timestamptz

me_too_signals
  id uuid PK
  user_id uuid FK
  activity_id uuid FK
  created_at timestamptz
  UNIQUE(user_id, activity_id)

soft_pings
  id uuid PK
  sender_id uuid FK
  receiver_id uuid FK
  activity_id uuid FK
  timeframe text ('this_week', 'this_weekend', 'next_week', 'flexible')
  message text (140 char max, no links)
  status text ('pending', 'accepted', 'declined', 'expired')
  created_at timestamptz
  responded_at timestamptz

connections
  id uuid PK
  initiator_id uuid FK
  receiver_id uuid FK
  shared_activity_ids uuid[]
  status text ('connected')
  connected_at timestamptz
  created_at timestamptz
```

### Future Tables (not yet created)

```sql
meetups
  id, proposer_id, connection_id, neighborhood (never address),
  venue_type (public only), min_attendees (3+), status, cancelled_at

trust_signals
  id, from_user_id, to_user_id, signal_type (positive/silent),
  surfaced_after_meetup_id (required), created_at
```

## Folder Structure

```
src/
  app/
    (auth)/
      onboarding/
        page.tsx              Suspense wrapper
        OnboardingFlow.tsx    3-step orchestrator
        StepHandle.tsx        Handle + phone input
        StepLocation.tsx      Zip, neighborhood, radius slider, comfort level
        StepInterests.tsx     Activity selection with frequency/level modal
      signin/
        page.tsx              Email/password auth
    (main)/
      overlap/
        page.tsx              Overlap view with me-too signals and pings
      network/
        page.tsx              Force-directed connection graph
      settings/
        page.tsx              Profile settings + interest management
    layout.tsx                Root layout
    page.tsx                  Redirects to /signin
    globals.css               Tailwind styles
  components/
    InterestManager.tsx       Active/Quiet toggle, edit, replace interests
    NetworkGraph.tsx          Force-directed graph visualization
  lib/
    supabase/
      client.ts               Singleton browser client (@supabase/ssr)
      server.ts               SSR client
    geo/
      geocode.ts              Zip to lat/lng via zippopotam.us
    matching/
      findOverlaps.ts         Distance + activity matching (respects is_active)
      meToo.ts                Signal management + mutual finding
    pings/
      softPing.ts             Send, receive, respond to pings
    graph/
      networkGraph.ts         Build graph data from connections
    utils.ts                  cn() helper, phone hashing
  types/
    index.ts                  Shared type definitions
  proxy.ts                    Next.js 16 middleware (route protection)
```

## Key Implementation Details

**Geocoding**
- Uses free zippopotam.us API (no key required)
- Converts US zip codes to lat/lng on profile creation
- Stored as separate lat/lng columns (not PostGIS for simplicity)

**Distance Matching**
- Haversine formula for distance calculation
- Must be within BOTH users' radii to match
- Done client-side for now (would move to PostGIS for scale)

**Me Too Logic**
- User signals interest in activity → creates me_too_signals row
- Mutual = both users have signaled on same activity AND within each other's radius
- Reveal happens immediately when checking for mutuals
- Updates `last_engaged_at` on the user's interest

**Soft Ping Flow**
1. User sees mutual match in overlap view
2. User sends ping with activity, timeframe, optional message
3. Receiver sees pending ping, can accept or decline
4. Acceptance creates connection with shared activity
5. Both users appear in each other's network graph

**Interest Decay (Active/Quiet)**
- `is_active` boolean: Active interests participate in matching, Quiet ones don't
- `last_engaged_at` timestamp: Updated when signaling "me too" or sending a ping
- Users toggle interests Active/Quiet in Settings
- Philosophy: interests don't disappear, they just go quiet

**Phone Hashing**
- SHA-256 hash of normalized (digits only) phone number
- Done client-side (would move server-side with bcrypt for production)
- Never stored or displayed in plaintext

**Network Graph**
- Force-directed physics with tuned constants for small graphs
- Repulsion (400), Attraction (0.08), Damping (0.7), Target distance (120px)
- Spring-based attraction toward ideal distance
- Shows connections and shared activities

## Core Architecture Principles

1. **Location never precise** - zip + radius only, never raw GPS
2. **Overlap before identity** - see cluster count before seeing person
3. **No DMs until mutual opt-in** - soft ping system only
4. **Activity-based not identity-based** - "I forage" not "I am a forager"
5. **Groups before individuals** - clusters not profiles; group meetup before one-on-one
6. **Quiet cumulative trust** - binary positive/silent, never public ratings, only valid post-meetup
7. **No engagement optimization** - ever
8. **Never fake density** - ever

## Quirks / Gotchas

- Next.js 16: middleware file must be `proxy.ts`, export must be named `proxy`
- Supabase client MUST be singleton - multiple instances break session
- Grammarly extension causes harmless hydration warnings
- Activity verb format: "I forage" (first person, present tense)
