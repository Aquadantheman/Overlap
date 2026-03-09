import { createClient } from "@/lib/supabase/client"

export type NearMiss = {
  activityId: string
  activityLabel: string
  activityVerb: string
  count: number
  minDistance: number
  maxDistance: number
  suggestedRadius: number
}

export type NearMissResult = {
  nearMisses: NearMiss[]
  totalJustOutside: number
  currentRadius: number
}

export type Commitment = "casual" | "regular" | "dedicated"

export type OverlapCluster = {
  activityId: string
  activityLabel: string
  activityVerb: string
  category: string
  count: number
  activeThisWeek: number
  commitmentMatch: number  // 0-1 score for commitment alignment (invisible to user, used for sorting)
}

export type OverlapResult = {
  clusters: OverlapCluster[]
  totalNearby: number
}

// Haversine formula to calculate distance in miles
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959 // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Calculate commitment alignment score (0 to 1)
// Same = 1.0, one step apart = 0.5, two steps apart = 0.25
function commitmentAlignmentScore(myCommitment: Commitment, theirCommitment: Commitment): number {
  const levels: Commitment[] = ["casual", "regular", "dedicated"]
  const myIndex = levels.indexOf(myCommitment)
  const theirIndex = levels.indexOf(theirCommitment)
  const diff = Math.abs(myIndex - theirIndex)

  if (diff === 0) return 1.0
  if (diff === 1) return 0.5
  return 0.25
}

export async function findOverlaps(userId: string): Promise<OverlapResult | null> {
  const supabase = createClient()

  // Get current user's profile and interests
  const { data: profile } = await supabase
    .from("profiles")
    .select("lat, lng, radius_miles")
    .eq("id", userId)
    .single()

  if (!profile || !profile.lat || !profile.lng) {
    return null
  }

  // Get active interests for the current user WITH commitment level
  const { data: myInterests } = await supabase
    .from("user_interests")
    .select("activity_id, commitment")
    .eq("user_id", userId)
    .eq("is_active", true)

  if (!myInterests || myInterests.length === 0) {
    return { clusters: [], totalNearby: 0 }
  }

  type MyInterest = { activity_id: string; commitment: Commitment | null }
  const myActivityIds = myInterests.map((i: MyInterest) => i.activity_id)
  const myCommitmentMap = new Map<string, Commitment>(
    myInterests.map((i: MyInterest): [string, Commitment] => [i.activity_id, (i.commitment || "regular") as Commitment])
  )

  // Get all other profiles with their interests
  // In production, you'd use PostGIS for efficient spatial queries
  // For now, we fetch nearby-ish profiles and filter client-side
  const { data: otherProfiles } = await supabase
    .from("profiles")
    .select("id, lat, lng")
    .neq("id", userId)
    .not("lat", "is", null)
    .not("lng", "is", null)

  if (!otherProfiles || otherProfiles.length === 0) {
    return { clusters: [], totalNearby: 0 }
  }

  // Filter profiles within radius
  type OtherProfile = { id: string; lat: number | null; lng: number | null }
  const nearbyProfileIds = otherProfiles
    .filter((p: OtherProfile) => {
      const distance = haversineDistance(
        profile.lat,
        profile.lng,
        p.lat as number,
        p.lng as number
      )
      return distance <= profile.radius_miles
    })
    .map((p: OtherProfile) => p.id)

  if (nearbyProfileIds.length === 0) {
    return { clusters: [], totalNearby: 0 }
  }

  // Get active interests of nearby users that match our activities (including commitment)
  const { data: nearbyInterests } = await supabase
    .from("user_interests")
    .select("user_id, activity_id, commitment, last_engaged_at")
    .in("user_id", nearbyProfileIds)
    .in("activity_id", myActivityIds)
    .eq("is_active", true)

  if (!nearbyInterests || nearbyInterests.length === 0) {
    return { clusters: [], totalNearby: nearbyProfileIds.length }
  }

  // Get activity details
  const { data: activities } = await supabase
    .from("activities")
    .select("id, label, verb, category")
    .in("id", myActivityIds)

  if (!activities) {
    return { clusters: [], totalNearby: nearbyProfileIds.length }
  }

  // Build clusters by activity with commitment alignment tracking
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  type ClusterData = {
    userIds: Set<string>
    activeUserIds: Set<string>
    commitmentScores: number[]  // Track alignment scores for averaging
  }
  const clusterMap = new Map<string, ClusterData>()

  type NearbyInterest = { user_id: string; activity_id: string; commitment: Commitment | null; last_engaged_at: string | null }
  for (const interest of nearbyInterests as NearbyInterest[]) {
    if (!clusterMap.has(interest.activity_id)) {
      clusterMap.set(interest.activity_id, { userIds: new Set(), activeUserIds: new Set(), commitmentScores: [] })
    }
    const cluster = clusterMap.get(interest.activity_id)!

    // Only add each user once per activity
    if (!cluster.userIds.has(interest.user_id)) {
      cluster.userIds.add(interest.user_id)

      // Calculate commitment alignment with my commitment level for this activity
      const myCommitment: Commitment = myCommitmentMap.get(interest.activity_id) || "regular"
      const theirCommitment: Commitment = (interest.commitment || "regular") as Commitment
      cluster.commitmentScores.push(commitmentAlignmentScore(myCommitment, theirCommitment))
    }

    // Check if active this week based on last_engaged_at
    if (interest.last_engaged_at && new Date(interest.last_engaged_at) > oneWeekAgo) {
      cluster.activeUserIds.add(interest.user_id)
    }
  }

  type ActivityRow = { id: string; label: string; verb: string; category: string }
  const clusters: OverlapCluster[] = activities
    .map((activity: ActivityRow) => {
      const cluster = clusterMap.get(activity.id)
      if (!cluster || cluster.userIds.size === 0) return null

      // Calculate average commitment alignment for this cluster
      const avgCommitmentMatch = cluster.commitmentScores.length > 0
        ? cluster.commitmentScores.reduce((a, b) => a + b, 0) / cluster.commitmentScores.length
        : 0.5

      return {
        activityId: activity.id,
        activityLabel: activity.label,
        activityVerb: activity.verb,
        category: activity.category,
        count: cluster.userIds.size,
        activeThisWeek: cluster.activeUserIds.size,
        commitmentMatch: avgCommitmentMatch,
      }
    })
    .filter((c: OverlapCluster | null): c is OverlapCluster => c !== null)
    // Sort by: count (primary), commitment alignment (secondary), active this week (tertiary)
    .sort((a: OverlapCluster, b: OverlapCluster) => {
      // Primary: more people = higher
      if (b.count !== a.count) return b.count - a.count
      // Secondary: better commitment alignment = higher
      if (b.commitmentMatch !== a.commitmentMatch) return b.commitmentMatch - a.commitmentMatch
      // Tertiary: more active = higher
      return b.activeThisWeek - a.activeThisWeek
    })

  // Count unique nearby users with at least one shared interest
  const uniqueNearbyWithOverlap = new Set(nearbyInterests.map((i: { user_id: string }) => i.user_id)).size

  return {
    clusters,
    totalNearby: uniqueNearbyWithOverlap,
  }
}

/**
 * Find people who share interests but are just outside the user's radius.
 * This helps users understand they could find more matches by expanding their radius.
 */
export async function findNearMisses(userId: string): Promise<NearMissResult | null> {
  const supabase = createClient()

  // Get current user's profile and interests
  const { data: profile } = await supabase
    .from("profiles")
    .select("lat, lng, radius_miles")
    .eq("id", userId)
    .single()

  if (!profile || !profile.lat || !profile.lng) {
    return null
  }

  const currentRadius = profile.radius_miles

  // Only get active interests for the current user
  const { data: myInterests } = await supabase
    .from("user_interests")
    .select("activity_id")
    .eq("user_id", userId)
    .eq("is_active", true)

  if (!myInterests || myInterests.length === 0) {
    return { nearMisses: [], totalJustOutside: 0, currentRadius }
  }

  const myActivityIds = myInterests.map((i: { activity_id: string }) => i.activity_id)

  // Get all other profiles
  const { data: otherProfiles } = await supabase
    .from("profiles")
    .select("id, lat, lng, radius_miles")
    .neq("id", userId)
    .not("lat", "is", null)
    .not("lng", "is", null)

  if (!otherProfiles || otherProfiles.length === 0) {
    return { nearMisses: [], totalJustOutside: 0, currentRadius }
  }

  // Define "near miss" zone: just outside radius up to 1.5x radius (capped at +5 miles)
  const nearMissMax = Math.min(currentRadius * 1.5, currentRadius + 5)

  // Filter profiles that are OUTSIDE radius but within near-miss zone
  type OtherProfile = { id: string; lat: number | null; lng: number | null; radius_miles: number }
  const nearMissProfiles: { id: string; distance: number }[] = []

  for (const p of otherProfiles as OtherProfile[]) {
    const distance = haversineDistance(
      profile.lat,
      profile.lng,
      p.lat as number,
      p.lng as number
    )
    // Outside user's radius but within near-miss zone
    if (distance > currentRadius && distance <= nearMissMax) {
      nearMissProfiles.push({ id: p.id, distance })
    }
  }

  if (nearMissProfiles.length === 0) {
    return { nearMisses: [], totalJustOutside: 0, currentRadius }
  }

  const nearMissProfileIds = nearMissProfiles.map(p => p.id)
  const distanceMap = new Map(nearMissProfiles.map(p => [p.id, p.distance]))

  // Get active interests of near-miss users that match our activities
  const { data: nearMissInterests } = await supabase
    .from("user_interests")
    .select("user_id, activity_id")
    .in("user_id", nearMissProfileIds)
    .in("activity_id", myActivityIds)
    .eq("is_active", true)

  if (!nearMissInterests || nearMissInterests.length === 0) {
    return { nearMisses: [], totalJustOutside: 0, currentRadius }
  }

  // Get activity details
  const matchedActivityIds = [...new Set(nearMissInterests.map((i: { activity_id: string }) => i.activity_id))]
  const { data: activities } = await supabase
    .from("activities")
    .select("id, label, verb")
    .in("id", matchedActivityIds)

  if (!activities) {
    return { nearMisses: [], totalJustOutside: 0, currentRadius }
  }

  // Build near-miss data by activity
  const activityData = new Map<string, { userIds: Set<string>; distances: number[] }>()

  for (const interest of nearMissInterests) {
    const distance = distanceMap.get(interest.user_id)
    if (distance === undefined) continue

    if (!activityData.has(interest.activity_id)) {
      activityData.set(interest.activity_id, { userIds: new Set(), distances: [] })
    }
    const data = activityData.get(interest.activity_id)!
    if (!data.userIds.has(interest.user_id)) {
      data.userIds.add(interest.user_id)
      data.distances.push(distance)
    }
  }

  type ActivityRow = { id: string; label: string; verb: string }
  const nearMisses: NearMiss[] = activities
    .map((activity: ActivityRow) => {
      const data = activityData.get(activity.id)
      if (!data || data.userIds.size === 0) return null

      const minDistance = Math.min(...data.distances)
      const maxDistance = Math.max(...data.distances)
      // Suggest a radius that would capture all these people (round up to nearest mile)
      const suggestedRadius = Math.ceil(maxDistance)

      return {
        activityId: activity.id,
        activityLabel: activity.label,
        activityVerb: activity.verb,
        count: data.userIds.size,
        minDistance: Math.round(minDistance * 10) / 10, // Round to 1 decimal
        maxDistance: Math.round(maxDistance * 10) / 10,
        suggestedRadius,
      }
    })
    .filter((nm: NearMiss | null): nm is NearMiss => nm !== null)
    .sort((a: NearMiss, b: NearMiss) => b.count - a.count) // Most people first

  // Count unique people just outside radius with shared interests
  const uniqueNearMissUsers = new Set(nearMissInterests.map((i: { user_id: string }) => i.user_id)).size

  return {
    nearMisses,
    totalJustOutside: uniqueNearMissUsers,
    currentRadius,
  }
}
