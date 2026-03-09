import { createClient } from "@/lib/supabase/client"

export type PingStatus = "pending" | "accepted" | "declined" | "expired"

export type Timeframe = "this_week" | "this_weekend" | "next_week" | "flexible"

export const TIMEFRAME_LABELS: Record<Timeframe, string> = {
  this_week: "this week",
  this_weekend: "this weekend",
  next_week: "next week",
  flexible: "sometime soon",
}

export type SoftPing = {
  id: string
  senderId: string
  senderHandle: string
  receiverId: string
  receiverHandle: string
  activityId: string
  activityLabel: string
  activityVerb: string
  timeframe: Timeframe
  message: string | null
  status: PingStatus
  createdAt: string
  respondedAt: string | null
}

const MAX_ACTIVE_PINGS = 5
const MAX_MESSAGE_LENGTH = 140

// Validate message: no links, max length
function validateMessage(message: string): { valid: boolean; error?: string } {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` }
  }

  // Check for URLs
  const urlPattern = /https?:\/\/|www\.|\.com|\.org|\.net|\.io/i
  if (urlPattern.test(message)) {
    return { valid: false, error: "Links are not allowed in pings" }
  }

  return { valid: true }
}

// Send a soft ping
export async function sendPing(
  senderId: string,
  receiverId: string,
  activityId: string,
  timeframe: Timeframe,
  message: string | null
): Promise<{ success: boolean; error?: string; pingId?: string }> {
  const supabase = createClient()

  // Validate message if provided
  if (message) {
    const validation = validateMessage(message)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }
  }

  // Check ping cap
  const { count } = await supabase
    .from("soft_pings")
    .select("*", { count: "exact", head: true })
    .eq("sender_id", senderId)
    .eq("status", "pending")

  if (count && count >= MAX_ACTIVE_PINGS) {
    return {
      success: false,
      error: `You can only have ${MAX_ACTIVE_PINGS} pending pings at a time`,
    }
  }

  // Check if ping already exists between these users for this activity
  const { data: existing } = await supabase
    .from("soft_pings")
    .select("id")
    .eq("sender_id", senderId)
    .eq("receiver_id", receiverId)
    .eq("activity_id", activityId)
    .eq("status", "pending")
    .single()

  if (existing) {
    return { success: false, error: "You already have a pending ping to this person for this activity" }
  }

  // Create the ping
  const { data, error } = await supabase
    .from("soft_pings")
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      activity_id: activityId,
      timeframe,
      message: message || null,
      status: "pending",
    })
    .select("id")
    .single()

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, pingId: data.id }
}

// Get pings sent by user
export async function getSentPings(userId: string): Promise<SoftPing[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from("soft_pings")
    .select(`
      id,
      sender_id,
      receiver_id,
      activity_id,
      timeframe,
      message,
      status,
      created_at,
      responded_at,
      receiver:profiles!soft_pings_receiver_id_fkey(handle),
      activity:activities(label, verb)
    `)
    .eq("sender_id", userId)
    .order("created_at", { ascending: false })

  if (!data) return []

  // Get sender handle
  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", userId)
    .single()

  return data.map((p) => ({
    id: p.id,
    senderId: p.sender_id,
    senderHandle: profile?.handle || "",
    receiverId: p.receiver_id,
    receiverHandle: (p.receiver as { handle: string })?.handle || "",
    activityId: p.activity_id,
    activityLabel: (p.activity as { label: string; verb: string })?.label || "",
    activityVerb: (p.activity as { label: string; verb: string })?.verb || "",
    timeframe: p.timeframe as Timeframe,
    message: p.message,
    status: p.status as PingStatus,
    createdAt: p.created_at,
    respondedAt: p.responded_at,
  }))
}

// Get pings received by user
export async function getReceivedPings(userId: string): Promise<SoftPing[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from("soft_pings")
    .select(`
      id,
      sender_id,
      receiver_id,
      activity_id,
      timeframe,
      message,
      status,
      created_at,
      responded_at,
      sender:profiles!soft_pings_sender_id_fkey(handle),
      activity:activities(label, verb)
    `)
    .eq("receiver_id", userId)
    .order("created_at", { ascending: false })

  if (!data) return []

  // Get receiver handle
  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", userId)
    .single()

  return data.map((p) => ({
    id: p.id,
    senderId: p.sender_id,
    senderHandle: (p.sender as { handle: string })?.handle || "",
    receiverId: p.receiver_id,
    receiverHandle: profile?.handle || "",
    activityId: p.activity_id,
    activityLabel: (p.activity as { label: string; verb: string })?.label || "",
    activityVerb: (p.activity as { label: string; verb: string })?.verb || "",
    timeframe: p.timeframe as Timeframe,
    message: p.message,
    status: p.status as PingStatus,
    createdAt: p.created_at,
    respondedAt: p.responded_at,
  }))
}

// Get count of pending received pings
export async function getPendingPingCount(userId: string): Promise<number> {
  const supabase = createClient()

  const { count } = await supabase
    .from("soft_pings")
    .select("*", { count: "exact", head: true })
    .eq("receiver_id", userId)
    .eq("status", "pending")

  return count || 0
}

// Respond to a ping
export async function respondToPing(
  pingId: string,
  userId: string,
  accept: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()

  // Verify the ping belongs to this user
  const { data: ping } = await supabase
    .from("soft_pings")
    .select("id, receiver_id, sender_id, activity_id, status")
    .eq("id", pingId)
    .single()

  if (!ping) {
    return { success: false, error: "Ping not found" }
  }

  if (ping.receiver_id !== userId) {
    return { success: false, error: "This ping is not addressed to you" }
  }

  if (ping.status !== "pending") {
    return { success: false, error: "This ping has already been responded to" }
  }

  // Update ping status
  const newStatus = accept ? "accepted" : "declined"

  const { error: updateError } = await supabase
    .from("soft_pings")
    .update({
      status: newStatus,
      responded_at: new Date().toISOString(),
    })
    .eq("id", pingId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  // If accepted, create a connection
  if (accept) {
    const { error: connectionError } = await supabase
      .from("connections")
      .insert({
        initiator_id: ping.sender_id,
        receiver_id: ping.receiver_id,
        shared_activity_ids: [ping.activity_id],
        status: "connected",
        connected_at: new Date().toISOString(),
      })

    if (connectionError && connectionError.code !== "23505") {
      // Ignore duplicate key errors (connection might already exist)
      return { success: false, error: connectionError.message }
    }
  }

  return { success: true }
}
