import { createClient } from "@/lib/supabase/client"

export type MeetupType = "group" | "one_on_one"
export type MeetupStatus = "proposed" | "confirmed" | "completed" | "cancelled"
export type ParticipantStatus = "invited" | "accepted" | "declined"

export type Meetup = {
  id: string
  proposerId: string
  proposerHandle: string
  activityId: string
  activityLabel: string
  activityVerb: string
  meetupType: MeetupType
  neighborhood: string
  proposedTime: string | null
  note: string | null
  status: MeetupStatus
  minAttendees: number
  createdAt: string
  confirmedAt: string | null
  completedAt: string | null
  participants: MeetupParticipant[]
}

export type MeetupParticipant = {
  userId: string
  handle: string
  status: ParticipantStatus
  respondedAt: string | null
}

export type DensityCheck = {
  canGroup: boolean
  canOneOnOne: boolean
  nearbyCount: number
  nearbyUsers: { userId: string; handle: string }[]
  reason?: string
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

// Check density for a specific activity between two users
// Determines whether group or 1-on-1 meetup is possible
export async function checkMeetupDensity(
  userId: string,
  otherUserId: string,
  activityId: string
): Promise<DensityCheck> {
  const supabase = createClient()

  // Get both users' profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle, lat, lng, radius_miles, comfort_level")
    .in("id", [userId, otherUserId])

  if (!profiles || profiles.length !== 2) {
    return {
      canGroup: false,
      canOneOnOne: false,
      nearbyCount: 0,
      nearbyUsers: [],
      reason: "Could not find both user profiles",
    }
  }

  type ProfileRow = { id: string; handle: string; lat: number | null; lng: number | null; radius_miles: number; comfort_level: string | null }
  const myProfile = profiles.find((p: ProfileRow) => p.id === userId)!
  const otherProfile = profiles.find((p: ProfileRow) => p.id === otherUserId)!

  if (!myProfile.lat || !myProfile.lng || !otherProfile.lat || !otherProfile.lng) {
    return {
      canGroup: false,
      canOneOnOne: false,
      nearbyCount: 0,
      nearbyUsers: [],
      reason: "Location data missing",
    }
  }

  // Find all users with this activity (active interests only)
  const { data: usersWithActivity } = await supabase
    .from("user_interests")
    .select("user_id")
    .eq("activity_id", activityId)
    .eq("is_active", true)

  if (!usersWithActivity || usersWithActivity.length === 0) {
    return {
      canGroup: false,
      canOneOnOne: false,
      nearbyCount: 0,
      nearbyUsers: [],
      reason: "No users with this activity",
    }
  }

  const userIds = usersWithActivity.map((u: { user_id: string }) => u.user_id)

  // Get profiles of all those users
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, handle, lat, lng, radius_miles, comfort_level")
    .in("id", userIds)

  if (!allProfiles) {
    return {
      canGroup: false,
      canOneOnOne: false,
      nearbyCount: 0,
      nearbyUsers: [],
      reason: "Could not fetch profiles",
    }
  }

  // Filter to users within BOTH users' radii
  // Use the smaller of the two radii as the "meeting ground"
  const meetingLat = (myProfile.lat + otherProfile.lat) / 2
  const meetingLng = (myProfile.lng + otherProfile.lng) / 2

  const nearbyUsers = allProfiles.filter((p: ProfileRow) => {
    if (!p.lat || !p.lng) return false

    // Must be within my radius
    const distToMe = haversineDistance(myProfile.lat, myProfile.lng, p.lat, p.lng)
    if (distToMe > myProfile.radius_miles) return false

    // Must be within other user's radius
    const distToOther = haversineDistance(otherProfile.lat, otherProfile.lng, p.lat, p.lng)
    if (distToOther > otherProfile.radius_miles) return false

    return true
  })

  const nearbyCount = nearbyUsers.length
  const canGroup = nearbyCount >= 3

  // Check if 1-on-1 is possible (both users must be "open")
  const bothOpen =
    myProfile.comfort_level === "open" && otherProfile.comfort_level === "open"
  const canOneOnOne = !canGroup && bothOpen

  // Build reason message
  let reason: string | undefined
  if (!canGroup && !canOneOnOne) {
    if (!bothOpen) {
      const whoIsGroupOnly =
        myProfile.comfort_level === "group_only"
          ? "You prefer"
          : `@${otherProfile.handle} prefers`
      reason = `${whoIsGroupOnly} group meetups only, but there aren't enough people nearby yet`
    } else {
      reason = "Not enough people nearby for this activity"
    }
  }

  return {
    canGroup,
    canOneOnOne,
    nearbyCount,
    nearbyUsers: nearbyUsers
      .filter((p: ProfileRow) => p.id !== userId) // Exclude self from list
      .map((p: ProfileRow) => ({ userId: p.id, handle: p.handle })),
    reason,
  }
}

// Propose a new meetup
export async function proposeMeetup(
  proposerId: string,
  activityId: string,
  meetupType: MeetupType,
  neighborhood: string,
  inviteeIds: string[],
  proposedTime?: string,
  note?: string
): Promise<{ success: boolean; error?: string; meetupId?: string }> {
  const supabase = createClient()

  const minAttendees = meetupType === "group" ? 3 : 2

  // Create the meetup
  const { data: meetup, error: meetupError } = await supabase
    .from("meetups")
    .insert({
      proposer_id: proposerId,
      activity_id: activityId,
      meetup_type: meetupType,
      neighborhood,
      proposed_time: proposedTime || null,
      note: note || null,
      status: "proposed",
      min_attendees: minAttendees,
    })
    .select("id")
    .single()

  if (meetupError) {
    return { success: false, error: meetupError.message }
  }

  // Invite participants
  const participantInserts = inviteeIds.map((userId) => ({
    meetup_id: meetup.id,
    user_id: userId,
    status: "invited",
  }))

  const { error: participantError } = await supabase
    .from("meetup_participants")
    .insert(participantInserts)

  if (participantError) {
    return { success: false, error: participantError.message }
  }

  return { success: true, meetupId: meetup.id }
}

// Respond to a meetup invitation
export async function respondToMeetup(
  meetupId: string,
  userId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Update participant status
  const { error: updateError } = await supabase
    .from("meetup_participants")
    .update({
      status: accept ? "accepted" : "declined",
      responded_at: new Date().toISOString(),
    })
    .eq("meetup_id", meetupId)
    .eq("user_id", userId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // Check if meetup should be confirmed (enough acceptances)
  if (accept) {
    const { data: meetup } = await supabase
      .from("meetups")
      .select("id, min_attendees, status")
      .eq("id", meetupId)
      .single()

    if (meetup && meetup.status === "proposed") {
      const { count } = await supabase
        .from("meetup_participants")
        .select("*", { count: "exact", head: true })
        .eq("meetup_id", meetupId)
        .eq("status", "accepted")

      // +1 for the proposer who is implicitly attending
      const totalAttending = (count || 0) + 1

      if (totalAttending >= meetup.min_attendees) {
        await supabase
          .from("meetups")
          .update({
            status: "confirmed",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", meetupId)
      }
    }
  }

  return { success: true }
}

// Get meetups for a user (proposed by them or invited to)
export async function getMyMeetups(userId: string): Promise<{
  proposed: Meetup[]
  invited: Meetup[]
}> {
  const supabase = createClient()

  // Get meetups I proposed
  const { data: proposedData } = await supabase
    .from("meetups")
    .select(`
      id,
      proposer_id,
      activity_id,
      meetup_type,
      neighborhood,
      proposed_time,
      note,
      status,
      min_attendees,
      created_at,
      confirmed_at,
      completed_at,
      activity:activities(label, verb),
      participants:meetup_participants(
        user_id,
        status,
        responded_at,
        user:profiles!meetup_participants_user_id_fkey(handle)
      )
    `)
    .eq("proposer_id", userId)
    .order("created_at", { ascending: false })

  // Get meetups I'm invited to
  const { data: invitedParticipations } = await supabase
    .from("meetup_participants")
    .select("meetup_id")
    .eq("user_id", userId)

  const invitedMeetupIds = invitedParticipations?.map((p: { meetup_id: string }) => p.meetup_id) || []

  let invitedData: typeof proposedData = []
  if (invitedMeetupIds.length > 0) {
    const { data } = await supabase
      .from("meetups")
      .select(`
        id,
        proposer_id,
        activity_id,
        meetup_type,
        neighborhood,
        proposed_time,
        note,
        status,
        min_attendees,
        created_at,
        confirmed_at,
        completed_at,
        activity:activities(label, verb),
        proposer:profiles!meetups_proposer_id_fkey(handle),
        participants:meetup_participants(
          user_id,
          status,
          responded_at,
          user:profiles!meetup_participants_user_id_fkey(handle)
        )
      `)
      .in("id", invitedMeetupIds)
      .order("created_at", { ascending: false })

    invitedData = data
  }

  // Get my handle for proposed meetups
  const { data: myProfile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", userId)
    .single()

  const mapMeetup = (m: any, proposerHandle: string): Meetup => ({
    id: m.id,
    proposerId: m.proposer_id,
    proposerHandle,
    activityId: m.activity_id,
    activityLabel: (m.activity as any)?.label || "",
    activityVerb: (m.activity as any)?.verb || "",
    meetupType: m.meetup_type as MeetupType,
    neighborhood: m.neighborhood,
    proposedTime: m.proposed_time,
    note: m.note,
    status: m.status as MeetupStatus,
    minAttendees: m.min_attendees,
    createdAt: m.created_at,
    confirmedAt: m.confirmed_at,
    completedAt: m.completed_at,
    participants: (m.participants || []).map((p: any) => ({
      userId: p.user_id,
      handle: (p.user as any)?.handle || "",
      status: p.status as ParticipantStatus,
      respondedAt: p.responded_at,
    })),
  })

  type MeetupRow = NonNullable<typeof proposedData>[number]
  const proposed = (proposedData || []).map((m: MeetupRow) =>
    mapMeetup(m, myProfile?.handle || "")
  )

  const invited = (invitedData || []).map((m: MeetupRow) =>
    mapMeetup(m, (m as any).proposer?.handle || "")
  )

  return { proposed, invited }
}

// Mark a meetup as completed
export async function completeMeetup(
  meetupId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Verify user is the proposer
  const { data: meetup } = await supabase
    .from("meetups")
    .select("proposer_id, status")
    .eq("id", meetupId)
    .single()

  if (!meetup) {
    return { success: false, error: "Meetup not found" }
  }

  if (meetup.proposer_id !== userId) {
    return { success: false, error: "Only the proposer can mark a meetup as completed" }
  }

  if (meetup.status !== "confirmed") {
    return { success: false, error: "Only confirmed meetups can be marked as completed" }
  }

  const { error } = await supabase
    .from("meetups")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", meetupId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Cancel a meetup
export async function cancelMeetup(
  meetupId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Verify user is the proposer
  const { data: meetup } = await supabase
    .from("meetups")
    .select("proposer_id, status")
    .eq("id", meetupId)
    .single()

  if (!meetup) {
    return { success: false, error: "Meetup not found" }
  }

  if (meetup.proposer_id !== userId) {
    return { success: false, error: "Only the proposer can cancel a meetup" }
  }

  if (meetup.status === "completed") {
    return { success: false, error: "Cannot cancel a completed meetup" }
  }

  const { error } = await supabase
    .from("meetups")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", meetupId)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

// Get count of pending meetup invitations for a user
export async function getPendingMeetupCount(userId: string): Promise<number> {
  const supabase = createClient()

  const { count } = await supabase
    .from("meetup_participants")
    .select("*, meetup:meetups!inner(status)", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "invited")
    .eq("meetup.status", "proposed")

  return count || 0
}
