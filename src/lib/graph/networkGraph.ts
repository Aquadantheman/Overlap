import { createClient } from "@/lib/supabase/client"

export type GraphNode = {
  id: string
  handle: string
  activityCount: number
  connectionCount: number
  isCurrentUser: boolean
}

export type GraphEdge = {
  source: string
  target: string
  sharedActivities: string[]
  weight: number // number of shared activities
}

export type NetworkGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
  currentUserId: string
}

// Build a network graph showing how users connect through shared activities
// Only includes users within mutual radius
export async function buildNetworkGraph(userId: string): Promise<NetworkGraph | null> {
  const supabase = createClient()

  // Get current user's profile and interests
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id, handle, lat, lng, radius_miles")
    .eq("id", userId)
    .single()

  if (!myProfile?.lat || !myProfile?.lng) {
    return null
  }

  const { data: myInterests } = await supabase
    .from("user_interests")
    .select("activity_id")
    .eq("user_id", userId)

  if (!myInterests || myInterests.length === 0) {
    return null
  }

  const myActivityIds = new Set<string>(myInterests.map((i: { activity_id: string }) => i.activity_id))

  // Get all other users with their profiles and interests
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, handle, lat, lng, radius_miles")
    .neq("id", userId)

  if (!allProfiles || allProfiles.length === 0) {
    return {
      nodes: [{
        id: userId,
        handle: myProfile.handle,
        activityCount: myActivityIds.size,
        connectionCount: 0,
        isCurrentUser: true,
      }],
      edges: [],
      currentUserId: userId,
    }
  }

  // Filter to nearby users (within mutual radius)
  type ProfileRow = { id: string; handle: string; lat: number | null; lng: number | null; radius_miles: number }
  const nearbyProfiles = allProfiles.filter((p: ProfileRow) => {
    if (!p.lat || !p.lng) return false
    const distance = haversineDistance(myProfile.lat, myProfile.lng, p.lat, p.lng)
    return distance <= myProfile.radius_miles && distance <= p.radius_miles
  })

  if (nearbyProfiles.length === 0) {
    return {
      nodes: [{
        id: userId,
        handle: myProfile.handle,
        activityCount: myActivityIds.size,
        connectionCount: 0,
        isCurrentUser: true,
      }],
      edges: [],
      currentUserId: userId,
    }
  }

  // Get interests for all nearby users
  const nearbyUserIds = nearbyProfiles.map((p: ProfileRow) => p.id)
  const { data: allInterests } = await supabase
    .from("user_interests")
    .select("user_id, activity_id")
    .in("user_id", nearbyUserIds)

  // Build user -> activities map
  const userActivities = new Map<string, Set<string>>()
  userActivities.set(userId, myActivityIds)

  for (const interest of allInterests || []) {
    const existing = userActivities.get(interest.user_id) || new Set()
    existing.add(interest.activity_id)
    userActivities.set(interest.user_id, existing)
  }

  // Get activity labels for display
  const allActivityIds = new Set<string>()
  for (const activities of userActivities.values()) {
    for (const id of activities) {
      allActivityIds.add(id)
    }
  }

  const { data: activities } = await supabase
    .from("activities")
    .select("id, label")
    .in("id", Array.from(allActivityIds))

  const activityLabels = new Map<string, string>(activities?.map((a: { id: string; label: string }) => [a.id, a.label]) || [])

  // Build edges: users connected by shared activities
  const edges: GraphEdge[] = []
  const connectionCounts = new Map<string, number>()

  // Initialize connection counts
  connectionCounts.set(userId, 0)
  for (const profile of nearbyProfiles) {
    connectionCounts.set(profile.id, 0)
  }

  // Current user to each nearby user
  for (const profile of nearbyProfiles) {
    const theirActivities = userActivities.get(profile.id) || new Set()
    const shared: string[] = []

    for (const activityId of myActivityIds) {
      if (theirActivities.has(activityId)) {
        shared.push(activityLabels.get(activityId) || activityId)
      }
    }

    if (shared.length > 0) {
      edges.push({
        source: userId,
        target: profile.id,
        sharedActivities: shared,
        weight: shared.length,
      })
      connectionCounts.set(userId, (connectionCounts.get(userId) || 0) + 1)
      connectionCounts.set(profile.id, (connectionCounts.get(profile.id) || 0) + 1)
    }
  }

  // Nearby users to each other (for full network view)
  for (let i = 0; i < nearbyProfiles.length; i++) {
    for (let j = i + 1; j < nearbyProfiles.length; j++) {
      const userA = nearbyProfiles[i]
      const userB = nearbyProfiles[j]

      // Check if they're within each other's radius
      if (!userA.lat || !userA.lng || !userB.lat || !userB.lng) continue
      const distance = haversineDistance(userA.lat, userA.lng, userB.lat, userB.lng)
      if (distance > userA.radius_miles || distance > userB.radius_miles) continue

      const activitiesA = userActivities.get(userA.id) || new Set()
      const activitiesB = userActivities.get(userB.id) || new Set()
      const shared: string[] = []

      for (const activityId of activitiesA) {
        if (activitiesB.has(activityId)) {
          shared.push(activityLabels.get(activityId) || activityId)
        }
      }

      if (shared.length > 0) {
        edges.push({
          source: userA.id,
          target: userB.id,
          sharedActivities: shared,
          weight: shared.length,
        })
        connectionCounts.set(userA.id, (connectionCounts.get(userA.id) || 0) + 1)
        connectionCounts.set(userB.id, (connectionCounts.get(userB.id) || 0) + 1)
      }
    }
  }

  // Build nodes
  const nodes: GraphNode[] = []

  // Current user node
  nodes.push({
    id: userId,
    handle: myProfile.handle,
    activityCount: myActivityIds.size,
    connectionCount: connectionCounts.get(userId) || 0,
    isCurrentUser: true,
  })

  // Nearby user nodes (only those with at least one connection)
  for (const profile of nearbyProfiles) {
    const connCount = connectionCounts.get(profile.id) || 0
    if (connCount > 0) {
      nodes.push({
        id: profile.id,
        handle: profile.handle,
        activityCount: userActivities.get(profile.id)?.size || 0,
        connectionCount: connCount,
        isCurrentUser: false,
      })
    }
  }

  return {
    nodes,
    edges,
    currentUserId: userId,
  }
}

// Haversine formula for distance in miles
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959
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
