# The Overlap — Feature Design & Product Philosophy
*Last updated: 2026-03-09*

---

## Who This Is For

This is the most important thing to get right. It determines every word of copy, every onboarding choice, every feature priority.

**The Overlap is not an app for lonely people.**

That framing — "make friends as an adult," "combat loneliness" — requires users to cross a psychological threshold most people resist. Nobody wants to admit they need help with connection. Apps built on that premise carry a stigma that kills adoption before it starts.

**The Overlap is for anyone who has an interest their existing circle doesn't share.**

That's almost everyone. Someone with 15 close friends can genuinely want to find other people nearby who forage. A couple who homebrews wants to find other couples who do. Someone new to urban sketching wants to find more experienced people nearby to learn from. Someone who's been in the same place for years has a whole side of their life — mycology, fermentation, trail running — that exists in complete isolation from the people around them.

The framing is **addition, not deficit.** Not "I need connection" but "I want more of something I already love."

This distinction shapes everything:
- Never use words like "lonely," "isolated," or even "friends" in primary messaging
- Talk about the **activities**, not the social need
- The connection is almost incidental to the thing the user actually cares about
- Users don't have to be self-aware about wanting community — they just have to be into something

**The full range of users:**
- Someone new to an area (obvious fit, high urgency)
- Someone embedded in a place for years but whose circle doesn't share their specific interests
- Someone who does a solitary hobby and has never considered it could be social
- Someone at the beginning of a new interest who wants to learn from locals
- Couples or small existing groups looking for other couples or groups — almost completely unserved by existing products
- People who are genuinely isolated but would never describe themselves that way

---

## Core Design Problem

The central tension: people should feel compatibility and confidence reaching out — but it should never feel like a dating app.

**Dating apps work by making you shop for a person.**
The Overlap works by making you notice a situation you both already exist in.

When two people both forage within 3 miles of each other, compatibility isn't a score — it's obvious and already real. They don't need to evaluate each other. They need a low-stakes way to say "yeah, me too."

**The activity is foregrounded. The human is background.**

Compatibility is earned by shared context, not assessed by inspection.

---

## Anti-Dating-App Principles
*Enforce in every feature decision, every line of copy, every UI choice.*

1. **The overlap is the unit, not the person.** You never browse people. You see "4 people within 2 miles also forage mushrooms." You're not shopping — you're noticing.
2. **The first move is about the activity, not the person.** A soft ping isn't "hey I think we'd get along" — it's "I saw we both do X, I'm going out this weekend if you ever want to join."
3. **Reveal happens through doing, not disclosure.** Before connecting, you know almost nothing about each other — just shared activity and rough location. More comes out if you actually meet.
4. **No assessment mechanics anywhere.** No compatibility scores. No "people like you also connected with." No sorting by any personal attribute.
5. **Social proof is communal, not individual.** "12 foragers within 5 miles" feels like discovering a scene. "Sarah, 32, loves foraging 🍄" feels like a dating profile. Same information, completely different feeling.

---

## What Killed Similar Platforms

Understanding these failures is required context before touching any feature.

**Meetup.com** — became event-promotion infrastructure. Organizer/attendee split created burned-out hosts and a passive majority. Groups became newsletters. The social graph never formed because people attended events, not each other.

**Bumble BFF** — bolted friendship onto a dating mechanic. Same swipe, same profile energy. The frame was wrong — you don't shop for friends. Retention collapsed because there was no activity to organize around.

**Nextdoor** — nailed hyperlocal geography but became a complaints board. No interest filtering. Loudest voices dominate. Everyone's a neighbor; nobody chose to be there.

**Clubhouse** — real-time audio created parasocial dynamics. Stars emerged, audiences formed, community feeling evaporated. Optimized for content consumption, not genuine connection.

**IRL app** — explicitly tried to be the "anti-social-media social app." Raised $170M, shut down 2023 after the vast majority of users turned out to be bots. They faked density to solve cold-start. Trust collapse was instant and total.

**The common failure patterns:**
- Fake density → trust collapse the moment it's discovered
- Organizer burden → key people burn out and take the community with them
- Passive consumption replacing participation → everyone watches, nobody does
- Identity before context → performance anxiety, people feel evaluated before they've done anything
- Scale destroying intimacy → grows and loses the thing that made it feel good
- Monetization misalignment → ads require attention optimization which kills authentic interaction

**The Overlap's structural answers:**
- Never fake density — honest empty states, real recency signals
- No organizers — peer-to-peer meetup proposals, no host class
- Recency signals + gentle nudges make passivity uncomfortable without being pushy
- Activity first, identity emerges through doing
- Hyperlocal by design — growth elsewhere doesn't affect your local experience
- Premium features expand utility, never optimize engagement

---

## Feature Design

### Interest Selection

**Cap at 7 activities maximum.**
Every selection becomes a real choice. Can't checkbox-farm to maximize overlaps. Forces authenticity through constraint.

**Flavor text — private, never shown to strangers.**
After selecting an activity, user adds brief personal context: experience level, what draws them to it. "I've been learning to ID chanterelles vs. jack-o-lanterns for two years, mostly in oak forests" is not fakeable. Used internally as a quality signal. Revealed to connections only after a group meetup has occurred.

**Activity-level follow-ups at selection.**
Two lightweight questions per activity: frequency (a few times a year / monthly / weekly) and level (beginner / casual / experienced). Low friction, real signal, useful for matching people at compatible levels.

**Interest decay.**
Interests without engagement gradually lose matching weight. Active users float up. Users get a periodic gentle nudge — "still into these?" — not a dark pattern, just honest maintenance.

---

### The Overlap View

**Never show individual profiles.**
Clusters only: "4 people within 2 miles also forage" — never names, never faces. The human is revealed only after mutual action.

**Show recency, not just count.**
"2 of these people were active this week" filters stale accounts and creates appropriate urgency. A static count invites passive watching indefinitely.

**Show the scene growing over time.**
"That number went from 8 to 14 over the past month." Watching a local scene develop around something you care about has real passive value. The app becomes a living thing, not a directory.

**Minimum 3 people to unlock meetup proposals.**
Group-first enforced architecturally. Can't propose one-on-one from the overlap view.

**Graceful empty states.**
No overlap ≠ failure. "No one nearby yet — you're on the map" with a passive invite mechanism. Possibly: "notify me when someone joins within X miles who also does Y." Never fake density.

---

### The "Me Too" Signal

A mechanic specifically designed for introverts and the connection-curious who find even a ping too high-stakes.

Not a ping, not a message — a quiet tap that says "I see this overlap and I'm interested." Both parties must do it before either one knows the other did. Simultaneous reveal: you find out you both tapped at the same moment, which immediately reframes the interaction. Nobody reached out. You both just showed up.

This is meaningfully different from a dating app match because it's not "do I find this person attractive" — it's "do I want to acknowledge this shared thing we have." Completely different emotional register.

The "me too" unlocks the ability to send a ping. It does not send one automatically. It's a step toward something, not an endpoint.

---

### The Soft Ping

**Activity-framed, not person-framed.**
Structured around the shared activity. Light template: "I'm going [activity] [timeframe], open to joining up if you're interested." Free text within that frame — not a blank message box.

**No free-form DM until mutual opt-in.**
The ping is the only channel before connection. Short, activity-scoped, one direction at a time.

**Ping cap on active outgoing pings.**
Can't have 15 open pings simultaneously. Forces intentionality, prevents hub-and-spoke power dynamics where one person holds all the social energy.

---

### Safety Architecture

**The architecture itself is the primary safety feature.**
Reaching someone with bad intent on The Overlap requires: picking specific real activities, being in a real location, waiting for overlaps to appear, sending a ping that passes activity-framing, getting accepted, and proposing a meetup that defaults to a public group setting. Enormous friction compared to sliding into DMs anywhere else.

**Group-first meetups, enforced by UI.**
First meeting is never one-on-one. Meetup proposals default to group format. One-on-one only becomes available after a group meetup has occurred (`group_meetup_completed` flag on connection).

**Public venues only.**
Meetup proposal form asks for a public location — trail head, farmers market, coffee shop. No address field. No homes. This is the only option the form allows.

**"Group-only" comfort setting.**
Users can flag themselves as preferring group meetups only. Visible to others before they ping. Not a dating-app filter — a safety signal that reduces friction for people who need more scaffolding. Especially important given the gender/safety asymmetry.

**Phone number at signup.**
Required, hashed, never displayed. Screens out throwaway accounts without creating a full verified identity system.

**Soft shadow-credentialing via trust signals.**
After a meetup, both parties get a quiet prompt: did they show up, did you feel comfortable. Positive or silence — no negative ratings, no public callouts. Consistent silence gradually deprioritizes that account in overlaps. They're never told. Trust signals are only valid when tied to a real meetup (`surfaced_after_meetup_id` required).

**Quiet reporting.**
Low-friction private mechanism. Three reports from different users triggers human review. Reporter never learns the outcome. No public callout system.

**Meetup commitment mechanic.**
Can't propose a new meetup until the last one is resolved (attended or cancelled with enough notice). Reduces flaking, creates soft social accountability.

---

### Re-engagement Without Dark Patterns

The product only works when people are actively open to meeting someone — but most people, most of the time, are not in that mode. Life gets busy. The window of openness is narrow.

The question is: **can the product have ambient value during the long stretches when people aren't actively seeking?**

**Seasonal and activity-driven awareness.**
"Chanterelle season is starting in your area" if you've marked foraging. Genuinely useful information, independent of connection-seeking. Keeps the app present without manufacturing fake urgency. Every notification must pass this test: would the user be glad they got this, or annoyed?

**The scene growing over time.**
Watching overlap numbers grow is passively interesting without requiring action. Gives people a reason to check in even when they're not in "seeking" mode.

**Loose connection maintenance.**
After meeting someone, a quiet periodic nudge: "It's been 3 months since you and Alex went out — want to suggest something?" Not a social feed. A gentle memory. Keeps existing connections warm without requiring active management.

**The hard line:** every re-engagement feature must get people closer to a real-world interaction, not substitute for one. The product is a catalyst, not a destination.

---

### Post-Connection

"Connected" must feel meaningfully different from pre-connection — not just a DM channel.

- Full flavor text of the other person becomes visible
- One-on-one meetup proposals unlock (after group meetup occurred)
- **"I think you two should meet"** — connected users can introduce each other, creating trust chains rather than hub-and-spoke dynamics. This is how real communities actually grow.
- Shared history: activities done together, meetups attended
- Lower friction for future proposals

This is the reward for completing the full flow. If it doesn't feel like a real reward, the system collapses into a worse version of texting.

---

### Pairs and Small Groups (v2)

Almost completely unserved by existing products: couples or small friend groups looking for other couples or groups with shared interests. "We homebrew — are there other pairs or small groups nearby who do?"

Supporting this changes the social unit from individuals to groups and:
- Reduces safety concerns immediately (you're not meeting a stranger alone)
- Reduces awkwardness of first meetup
- Opens a completely different demographic

This is a v2 feature, but the data model should not preclude it. Connection participants may need to support group-to-group eventually.

---

## Known Problem Areas & Mitigations

### The Lurker Problem
**Risk:** People see "5 foragers nearby," feel satisfied, never act.
**Mitigation:** Recency signals. Gentle nudge after 3 weeks of inaction on an overlap. "Me too" as a lower-stakes entry point. Scene growth data gives passive value without requiring action.

### The Gender/Safety Asymmetry
**Risk:** Women experience receiving pings fundamentally differently than men, even with good architecture in place.
**Mitigation:** Group-only comfort setting visible to pingers. Group-first meetup default. Robust quiet reporting. Monitor early cohort data closely. This needs ongoing attention, not a one-time fix.

### The Density Problem
**Risk:** Rural/suburban users have too few overlaps for a meaningful experience.
**Mitigation:** Graceful empty states that feel like anticipation not failure. "Notify me" feature. Expanded radius as a natural premium feature. **Never fake density — ever.**

### The Introvert Problem
**Risk:** People who most need this are least likely to send a ping.
**Mitigation:** "Me too" simultaneous reveal mechanic as the low-stakes entry. Group-first meetups (joining feels lower-stakes than initiating). "Open to joining if someone else organizes" signal.

### Interest Drift
**Risk:** Stale interests create bad matches, erode platform trust.
**Mitigation:** Interest decay in matching weight. Periodic gentle "still into these?" prompts. Users control their own data.

### The Over-Matcher
**Risk:** Someone with 7 interests in a dense area accumulates many pending pings, creating power imbalance.
**Mitigation:** Cap on active pending connections. Forces prioritization, keeps energy balanced across the network.

### Meetup Flaking
**Risk:** Group proposals get bail-outs, someone shows up alone.
**Mitigation:** Meetup commitment mechanic. 24-hour cancellation window visible to group. Post-meetup check-in feeds trust signals.

### The Re-engagement Cliff
**Risk:** Someone joins, does one meetup, has a great time, then drifts. Doesn't dislike the product — just forgets it exists.
**Mitigation:** Seasonal/activity-driven nudges. Scene growth data. Loose connection maintenance prompts. Every nudge must pass the "would they be glad they got this?" test.

### Moderation at Scale
**Risk:** Light moderation works at small scale. At medium scale: coordinated bad behavior, targeted harassment between people who know each other IRL, edge cases the system wasn't designed for.
**Mitigation:** Establish a moderation philosophy before you need a moderation team. Define the lines, who decides, what the appeals process is. Must exist before launch even if it's one person.

### The "Bad Meetup" Problem
**Risk:** Someone has an uncomfortable experience — not reportable, just socially off. They sour on the platform.
**Mitigation:** No product solution to human awkwardness. Set expectations in onboarding: not every meetup will click, and that's completely normal. Community is a skill, not a feature.

### Long-term Retention After You've Found Your People
**Risk:** Product works, users form a friend group, stop needing the app, just text each other.
**This is success, not failure.** But it means the viral loop must work: happy users invite others because they want more people in their local scene — not because of a referral bonus. Design the invite mechanic to feel like sharing something good, not recruiting.

### Monetization Without Betrayal
**Off the table:** Ads, gating safety features, gating core matching.
**Viable premium:**
- Expanded radius beyond default
- More than 7 interests
- Multiple active overlap zones (second homes, frequent travelers)
- Proposing meetups to larger groups
- Seeing flavor text of connections sooner
- Early access to Tier 3 activities

None gate core value. None require optimizing for engagement.

---

## MVP Scope

**The one experience to optimize for:**
The moment a person sends their first ping and gets a positive response. Everything before that is setup. Everything after is retention. That specific moment — stranger to potential friend, mediated by a shared thing you both actually do — is what no other product has gotten right. If that moment feels good and not scary, there's a real product here.

**Cold-start strategy:**
Not 50 users across the country — 50 people within 5 miles of each other. Until that exists somewhere, the core mechanic can't be tested. Solve this manually, in one specific place, with real humans. Recruit from hobby communities, not loneliness forums. r/foraging, r/fermentation, local mycological societies, farmers markets, trail groups. The pitch: "a tool to find other [foragers] nearby" — not "a social app." Long Island is a viable starting geography.

**Never fake density. Ever.**

---

## Interest Taxonomy

- **Tier 1:** Curated core (25 seeded across 10 categories). Stable, team-reviewed.
- **Tier 2:** Semi-controlled niches, expandable under Tier 1 parents. Community-proposed, team-approved.
- **Tier 3:** User-proposed, moderated before becoming visible.

Fields: `parent_id`, `tier`, `status` (active/pending/merged), `proposed_by`

---

## Data Model Implications

```
user_interests:   + frequency, level, last_active_at
connections:      + group_meetup_completed (bool) — gates one-on-one
meetups:          + venue_type (public only), min_attendees, status
                    (proposed/confirmed/completed/cancelled), cancelled_at
trust_signals:    + surfaced_after_meetup_id (FK meetups) — signals only valid post-meetup
soft_pings:       + activity_context_id (FK activities), template_used
profiles:         + comfort_level (group_only | open), active_ping_count,
                    phone_number (hashed, never displayed)
```

v2+: connection model may need to support group-to-group, not just person-to-person.
