import { createClient } from "@/lib/supabase/client"

export type OverlapCluster = {
  activityId: string
  activityLabel: string
  activityVerb: string
  category: string
  count: number
  activeThisWeek: number
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

  const { data: myInterests } = await supabase
    .from("user_interests")
    .select("activity_id")
    .eq("user_id", userId)

  if (!myInterests || myInterests.length === 0) {
    return { clusters: [], totalNearby: 0 }
  }

  const myActivityIds = myInterests.map((i) => i.activity_id)

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
  const nearbyProfileIds = otherProfiles
    .filter((p) => {
      const distance = haversineDistance(
        profile.lat,
        profile.lng,
        p.lat as number,
        p.lng as number
      )
      return distance <= profile.radius_miles
    })
    .map((p) => p.id)

  if (nearbyProfileIds.length === 0) {
    return { clusters: [], totalNearby: 0 }
  }

  // Get interests of nearby users that match our activities
  const { data: nearbyInterests } = await supabase
    .from("user_interests")
    .select("user_id, activity_id, created_at")
    .in("user_id", nearbyProfileIds)
    .in("activity_id", myActivityIds)

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

  // Build clusters by activity
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const clusterMap = new Map<string, { userIds: Set<string>; activeUserIds: Set<string> }>()

  for (const interest of nearbyInterests) {
    if (!clusterMap.has(interest.activity_id)) {
      clusterMap.set(interest.activity_id, { userIds: new Set(), activeUserIds: new Set() })
    }
    const cluster = clusterMap.get(interest.activity_id)!
    cluster.userIds.add(interest.user_id)

    // Check if active this week (using created_at as proxy for last_active_at for now)
    if (interest.created_at && new Date(interest.created_at) > oneWeekAgo) {
      cluster.activeUserIds.add(interest.user_id)
    }
  }

  const clusters: OverlapCluster[] = activities
    .map((activity) => {
      const cluster = clusterMap.get(activity.id)
      if (!cluster || cluster.userIds.size === 0) return null

      return {
        activityId: activity.id,
        activityLabel: activity.label,
        activityVerb: activity.verb,
        category: activity.category,
        count: cluster.userIds.size,
        activeThisWeek: cluster.activeUserIds.size,
      }
    })
    .filter((c): c is OverlapCluster => c !== null)
    .sort((a, b) => b.count - a.count) // Most overlaps first

  // Count unique nearby users with at least one shared interest
  const uniqueNearbyWithOverlap = new Set(nearbyInterests.map((i) => i.user_id)).size

  return {
    clusters,
    totalNearby: uniqueNearbyWithOverlap,
  }
}
