// ============================================
// OVERLAP — Core Type Definitions
// Privacy, gradual revelation, activity-first.
// ============================================

// --- Location ---
// Never precise. Always approximate.
export type LocationZone = {
  neighborhood: string
  zipCode: string
  radiusMiles: 1 | 2 | 5 | 10
}

// --- Interests: Three-Layer Model ---
// Category (broad) -> Activity (match unit) -> Flavor (personal, post-connection only)

export type InterestCategory =
  | "nature"
  | "making"
  | "movement"
  | "food"
  | "music"
  | "learning"
  | "games"
  | "community"
  | "arts"
  | "technology"

export type Activity = {
  id: string
  label: string            // "Foraging wild food"
  verb: string             // "I forage"
  category: InterestCategory
  relatedIds: string[]     // for soft semantic matching in v2
}

export type UserInterest = {
  activityId: string
  flavor?: string          // "Mostly mushrooms, Long Island" — shown only after connection
  addedAt: string
}

// --- User ---
// No photo required. No bio. You are what you do.
export type UserProfile = {
  id: string
  handle: string
  locationZone: LocationZone
  interests: UserInterest[]
  isOpenToConnect: boolean
  joinedAt: string
  trustScore: number       // private, never surfaced directly
}

// --- Overlap Cluster ---
// What gets shown first. People count, never identities.
export type OverlapCluster = {
  id: string
  activity: Activity
  memberCount: number
  nearbyZones: string[]
}

// --- Connection ---
// Gradual, mutual, never forced.
export type ConnectionStatus =
  | "none"
  | "interested"
  | "connected"
  | "closed"

export type Connection = {
  id: string
  initiatorId: string
  receiverId: string
  sharedActivityIds: string[]
  status: ConnectionStatus
  initiatedAt: string
  connectedAt?: string
}

// --- Soft Ping ---
// No cold DMs. Ever. Optional message: 140 chars max, no links.
export type SoftPing = {
  id: string
  connectionId: string
  sharedActivities: Activity[]
  message?: string
  sentAt: string
}

// --- Trust Signal ---
// Post-meetup. Binary. Private. No public ratings.
export type TrustSignal = {
  id: string
  fromUserId: string
  connectionId: string
  signal: "positive" | "silent"
  createdAt: string
}

// --- Meetup ---
// Optional IRL log. Neighborhood only, never address.
export type Meetup = {
  id: string
  connectionId: string
  neighborhood?: string
  happenedAt: string
}
