import { createClient } from "@/lib/supabase/client"

export type MutualMatch = {
  otherUserId: string
  otherHandle: string
  activityId: string
  activityLabel: string
  activityVerb: string
  matchedAt: string
}

// Record a "me too" signal for an activity
export async function signalMeToo(
  userId: string,
  activityId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { error } = await supabase
    .from("me_too_signals")
    .upsert(
      { user_id: userId, activity_id: activityId },
      { onConflict: "user_id,activity_id" }
    )

  if (error) {
    return { success: false, error: error.message }
  }

  // Update last_engaged_at for this interest (tracks activity for decay)
  await supabase
    .from("user_interests")
    .update({ last_engaged_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("activity_id", activityId)

  return { success: true }
}

// Remove a "me too" signal
export async function removeMeToo(
  userId: string,
  activityId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  const { error } = await supabase
    .from("me_too_signals")
    .delete()
    .eq("user_id", userId)
    .eq("activity_id", activityId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Get all activity IDs where the user has signaled "me too"
export async function getMySignals(userId: string): Promise<string[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from("me_too_signals")
    .select("activity_id")
    .eq("user_id", userId)

  return data?.map((s: { activity_id: string }) => s.activity_id) || []
}

// Check for mutual matches
// A mutual exists when:
// 1. User A has signaled "me too" on activity X
// 2. User B has also signaled "me too" on activity X
// 3. User A and B are within each other's radius
// 4. Both have activity X as an interest
export async function findMutuals(userId: string): Promise<MutualMatch[]> {
  const supabase = createClient()

  // Get current user's profile
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("lat, lng, radius_miles")
    .eq("id", userId)
    .single()

  if (!myProfile?.lat || !myProfile?.lng) {
    return []
  }

  // Get my "me too" signals
  const { data: mySignals } = await supabase
    .from("me_too_signals")
    .select("activity_id")
    .eq("user_id", userId)

  if (!mySignals || mySignals.length === 0) {
    return []
  }

  const myActivityIds = mySignals.map((s: { activity_id: string }) => s.activity_id)

  // Get other users who have signaled on the same activities
  const { data: otherSignals } = await supabase
    .from("me_too_signals")
    .select("user_id, activity_id, created_at")
    .in("activity_id", myActivityIds)
    .neq("user_id", userId)

  if (!otherSignals || otherSignals.length === 0) {
    return []
  }

  // Get profiles of those users to check distance
  const otherUserIds = [...new Set(otherSignals.map((s: { user_id: string }) => s.user_id))]

  const { data: otherProfiles } = await supabase
    .from("profiles")
    .select("id, handle, lat, lng, radius_miles")
    .in("id", otherUserIds)

  if (!otherProfiles) {
    return []
  }

  // Filter by distance (must be within BOTH users' radii)
  type OtherProfile = { id: string; handle: string; lat: number | null; lng: number | null; radius_miles: number }
  const nearbyProfiles = otherProfiles.filter((p: OtherProfile) => {
    if (!p.lat || !p.lng) return false
    const distance = haversineDistance(myProfile.lat, myProfile.lng, p.lat, p.lng)
    return distance <= myProfile.radius_miles && distance <= p.radius_miles
  })

  if (nearbyProfiles.length === 0) {
    return []
  }

  const nearbyUserIds = new Set(nearbyProfiles.map((p: OtherProfile) => p.id))

  // Get activity details
  const { data: activities } = await supabase
    .from("activities")
    .select("id, label, verb")
    .in("id", myActivityIds)

  type ActivityRow = { id: string; label: string; verb: string }
  const activityMap = new Map<string, ActivityRow>(activities?.map((a: ActivityRow) => [a.id, a]) || [])
  const profileMap = new Map<string, OtherProfile>(nearbyProfiles.map((p: OtherProfile) => [p.id, p]))

  // Build mutual matches
  const mutuals: MutualMatch[] = []

  for (const signal of otherSignals) {
    if (!nearbyUserIds.has(signal.user_id)) continue

    const activity = activityMap.get(signal.activity_id)
    const profile = profileMap.get(signal.user_id)

    if (!activity || !profile) continue

    mutuals.push({
      otherUserId: signal.user_id,
      otherHandle: profile.handle,
      activityId: signal.activity_id,
      activityLabel: activity.label,
      activityVerb: activity.verb,
      matchedAt: signal.created_at,
    })
  }

  return mutuals
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
