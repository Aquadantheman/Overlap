"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  getReceivedPings,
  getSentPings,
  respondToPing,
  SoftPing,
  TIMEFRAME_LABELS,
} from "@/lib/pings/softPing"
import {
  getMyMeetups,
  respondToMeetup,
  completeMeetup,
  cancelMeetup,
  Meetup,
  MeetupStatus,
} from "@/lib/meetups/meetups"
import { cn } from "@/lib/utils"
import ProposeMeetupModal from "@/components/ProposeMeetupModal"

type Tab = "pings" | "connections" | "meetups"

type SharedActivity = {
  id: string
  label: string
}

type Connection = {
  id: string
  otherUserId: string
  otherHandle: string
  sharedActivities: SharedActivity[]
  connectedAt: string
}

const STATUS_COLORS: Record<MeetupStatus, string> = {
  proposed: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  completed: "bg-stone-100 text-stone-600",
  cancelled: "bg-red-100 text-red-600",
}

const TIME_LABELS: Record<string, string> = {
  this_week: "This week",
  this_weekend: "This weekend",
  next_week: "Next week",
  flexible: "Flexible",
}

type ConfirmAction = {
  type: "decline_ping" | "decline_meetup" | "cancel_meetup"
  id: string
  label: string
}

export default function ActivityPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>("")
  const [activeTab, setActiveTab] = useState<Tab>("pings")

  // Pings state
  const [receivedPings, setReceivedPings] = useState<SoftPing[]>([])
  const [sentPings, setSentPings] = useState<SoftPing[]>([])
  const [respondingPing, setRespondingPing] = useState<string | null>(null)

  // Connections state
  const [connections, setConnections] = useState<Connection[]>([])
  const [meetupModalOpen, setMeetupModalOpen] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)

  // Meetups state
  const [proposedMeetups, setProposedMeetups] = useState<Meetup[]>([])
  const [invitedMeetups, setInvitedMeetups] = useState<Meetup[]>([])
  const [respondingMeetup, setRespondingMeetup] = useState<string | null>(null)
  const [actioningMeetup, setActioningMeetup] = useState<string | null>(null)

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = "/signin"
      return
    }

    setUserId(user.id)

    // Load pings
    const [received, sent] = await Promise.all([
      getReceivedPings(user.id),
      getSentPings(user.id),
    ])
    setReceivedPings(received)
    setSentPings(sent)

    // Load connections
    const { data: connectionData } = await supabase
      .from("connections")
      .select(`
        id,
        initiator_id,
        receiver_id,
        shared_activity_ids,
        connected_at,
        initiator:profiles!connections_initiator_id_fkey(id, handle),
        receiver:profiles!connections_receiver_id_fkey(id, handle)
      `)
      .eq("status", "connected")
      .or(`initiator_id.eq.${user.id},receiver_id.eq.${user.id}`)

    if (connectionData) {
      type ConnectionRow = {
        id: string
        initiator_id: string
        receiver_id: string
        shared_activity_ids: string[] | null
        connected_at: string
        initiator: { id: string; handle: string }
        receiver: { id: string; handle: string }
      }
      const allActivityIds = connectionData.flatMap((c: ConnectionRow) => c.shared_activity_ids || [])
      const uniqueActivityIds = [...new Set(allActivityIds)]

      let activityMap = new Map<string, { id: string; label: string }>()
      if (uniqueActivityIds.length > 0) {
        const { data: activities } = await supabase
          .from("activities")
          .select("id, label")
          .in("id", uniqueActivityIds)
        activityMap = new Map(activities?.map((a: { id: string; label: string }) => [a.id, { id: a.id, label: a.label }]) || [])
      }

      const mapped: Connection[] = connectionData.map((c: ConnectionRow) => {
        const isInitiator = c.initiator_id === user.id
        const other = isInitiator ? c.receiver : c.initiator

        return {
          id: c.id,
          otherUserId: other?.id || "",
          otherHandle: other?.handle || "",
          sharedActivities: (c.shared_activity_ids || [])
            .map((id: string) => activityMap.get(id))
            .filter((a): a is { id: string; label: string } => a !== undefined),
          connectedAt: c.connected_at,
        }
      })
      setConnections(mapped)
    }

    // Load meetups
    const meetupsData = await getMyMeetups(user.id)
    setProposedMeetups(meetupsData.proposed)
    setInvitedMeetups(meetupsData.invited)

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRespondPing = async (pingId: string, accept: boolean) => {
    setRespondingPing(pingId)
    const result = await respondToPing(pingId, userId, accept)
    if (result.success) {
      await loadData()
    }
    setRespondingPing(null)
  }

  const handleRespondMeetup = async (meetupId: string, accept: boolean) => {
    setRespondingMeetup(meetupId)
    const result = await respondToMeetup(meetupId, userId, accept)
    if (result.success) {
      await loadData()
    }
    setRespondingMeetup(null)
  }

  const handleCompleteMeetup = async (meetupId: string) => {
    setActioningMeetup(meetupId)
    const result = await completeMeetup(meetupId, userId)
    if (result.success) {
      await loadData()
    }
    setActioningMeetup(null)
  }

  const handleCancelMeetup = async (meetupId: string) => {
    setActioningMeetup(meetupId)
    const result = await cancelMeetup(meetupId, userId)
    if (result.success) {
      await loadData()
    }
    setActioningMeetup(null)
  }

  const handleConfirmAction = async () => {
    if (!confirmAction) return

    if (confirmAction.type === "decline_ping") {
      await handleRespondPing(confirmAction.id, false)
    } else if (confirmAction.type === "decline_meetup") {
      await handleRespondMeetup(confirmAction.id, false)
    } else if (confirmAction.type === "cancel_meetup") {
      await handleCancelMeetup(confirmAction.id)
    }

    setConfirmAction(null)
  }

  // Badge counts
  const pendingPings = receivedPings.filter((p) => p.status === "pending").length
  const pendingMeetups = invitedMeetups.filter(
    (m) => m.status === "proposed" && m.participants.find((p) => p.userId === userId)?.status === "invited"
  ).length

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-2xl font-medium text-stone-900 tracking-tight mb-6">
          Activity
        </h1>

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab("pings")}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              activeTab === "pings"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            )}
          >
            Pings{pendingPings > 0 ? ` (${pendingPings})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("connections")}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              activeTab === "connections"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            )}
          >
            Connections{connections.length > 0 ? ` (${connections.length})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("meetups")}
            className={cn(
              "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
              activeTab === "meetups"
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            )}
          >
            Meetups{pendingMeetups > 0 ? ` (${pendingMeetups})` : ""}
          </button>
        </div>

        {/* Content */}
        {activeTab === "pings" && (
          <PingsTab
            received={receivedPings}
            sent={sentPings}
            responding={respondingPing}
            onAccept={(pingId) => handleRespondPing(pingId, true)}
            onDecline={(pingId, label) => setConfirmAction({ type: "decline_ping", id: pingId, label })}
          />
        )}

        {activeTab === "connections" && (
          <ConnectionsTab
            connections={connections}
            sentPings={sentPings}
            onProposeMeetup={(conn) => {
              setSelectedConnection(conn)
              setMeetupModalOpen(true)
            }}
          />
        )}

        {activeTab === "meetups" && (
          <MeetupsTab
            proposed={proposedMeetups}
            invited={invitedMeetups}
            userId={userId}
            respondingMeetup={respondingMeetup}
            actioningMeetup={actioningMeetup}
            onAccept={(meetupId) => handleRespondMeetup(meetupId, true)}
            onDecline={(meetupId, label) => setConfirmAction({ type: "decline_meetup", id: meetupId, label })}
            onComplete={handleCompleteMeetup}
            onCancel={(meetupId, label) => setConfirmAction({ type: "cancel_meetup", id: meetupId, label })}
          />
        )}
      </div>

      {/* Propose Meetup Modal */}
      {selectedConnection && (
        <ProposeMeetupModal
          isOpen={meetupModalOpen}
          onClose={() => {
            setMeetupModalOpen(false)
            setSelectedConnection(null)
          }}
          userId={userId}
          connection={{
            id: selectedConnection.id,
            otherUserId: selectedConnection.otherUserId,
            otherHandle: selectedConnection.otherHandle,
            sharedActivities: selectedConnection.sharedActivities,
          }}
          onSuccess={loadData}
        />
      )}

      {/* Confirm Dialog */}
      {confirmAction && (
        <ConfirmDialog
          title={
            confirmAction.type === "decline_ping"
              ? "Decline this ping?"
              : confirmAction.type === "decline_meetup"
              ? "Decline this invitation?"
              : "Cancel this meetup?"
          }
          message={
            confirmAction.type === "decline_ping"
              ? `@${confirmAction.label} won't be able to connect with you for this activity.`
              : confirmAction.type === "decline_meetup"
              ? `You'll decline the invitation to ${confirmAction.label}.`
              : `All participants will be notified that ${confirmAction.label} has been cancelled.`
          }
          confirmLabel={
            confirmAction.type === "cancel_meetup" ? "Cancel meetup" : "Decline"
          }
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  )
}

// ============ PINGS TAB ============

function PingsTab({
  received,
  sent,
  responding,
  onAccept,
  onDecline,
}: {
  received: SoftPing[]
  sent: SoftPing[]
  responding: string | null
  onAccept: (pingId: string) => void
  onDecline: (pingId: string, senderHandle: string) => void
}) {
  const pendingReceived = received.filter((p) => p.status === "pending")
  const historyReceived = received.filter((p) => p.status !== "pending")
  const pendingSent = sent.filter((p) => p.status === "pending")
  const historySent = sent.filter((p) => p.status !== "pending")

  if (received.length === 0 && sent.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center">
        <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-stone-900 font-medium text-sm">No pings yet</p>
        <p className="text-stone-400 text-xs mt-2 max-w-xs mx-auto">
          When you match with someone on Overlap, you can send each other pings to connect.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {pendingReceived.length > 0 && (
        <Section title="Received - Pending">
          {pendingReceived.map((ping) => (
            <PingCard
              key={ping.id}
              ping={ping}
              type="received"
              responding={responding === ping.id}
              onAccept={onAccept}
              onDecline={onDecline}
            />
          ))}
        </Section>
      )}

      {pendingSent.length > 0 && (
        <Section title="Sent - Awaiting response">
          {pendingSent.map((ping) => (
            <PingCard key={ping.id} ping={ping} type="sent" />
          ))}
        </Section>
      )}

      {(historyReceived.length > 0 || historySent.length > 0) && (
        <Section title="History">
          {historyReceived.map((ping) => (
            <PingCard key={ping.id} ping={ping} type="received" />
          ))}
          {historySent.map((ping) => (
            <PingCard key={ping.id} ping={ping} type="sent" />
          ))}
        </Section>
      )}
    </div>
  )
}

// ============ CONNECTIONS TAB ============

function ConnectionsTab({
  connections,
  sentPings,
  onProposeMeetup,
}: {
  connections: Connection[]
  sentPings: SoftPing[]
  onProposeMeetup: (conn: Connection) => void
}) {
  // Get pending sent pings count
  const pendingSentPings = sentPings.filter(p => p.status === "pending").length

  // Build a map of pending pings by receiver
  const pendingPingsByReceiver = new Map<string, SoftPing>()
  sentPings
    .filter(p => p.status === "pending")
    .forEach(p => pendingPingsByReceiver.set(p.receiverId, p))

  if (connections.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {pendingSentPings > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-amber-700 text-sm font-medium">{pendingSentPings}</span>
            </div>
            <p className="text-amber-700 text-sm">
              {pendingSentPings === 1 ? "1 ping" : `${pendingSentPings} pings`} awaiting response
            </p>
          </div>
        )}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center">
          <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <p className="text-stone-900 font-medium text-sm">No connections yet</p>
          <p className="text-stone-400 text-xs mt-2 max-w-xs mx-auto">
            Accept a ping to connect with someone who shares your interests.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {connections.map((conn) => {
        const pendingPing = pendingPingsByReceiver.get(conn.otherUserId)
        return (
          <div
            key={conn.id}
            className={cn(
              "border rounded-2xl p-5",
              pendingPing ? "bg-amber-50/50 border-amber-200" : "bg-white border-stone-200"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-stone-900 font-medium">@{conn.otherHandle}</p>
                  {pendingPing && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      Ping sent
                    </span>
                  )}
                </div>
                <p className="text-stone-400 text-sm mt-0.5">
                  {conn.sharedActivities.map((a) => a.label).join(", ")}
                </p>
                {pendingPing ? (
                  <p className="text-amber-600 text-xs mt-2">
                    Waiting for response • {formatRelativeTime(pendingPing.createdAt)}
                  </p>
                ) : (
                  <p className="text-stone-300 text-xs mt-2">
                    Connected {formatRelativeTime(conn.connectedAt)}
                  </p>
                )}
              </div>
              <button
                onClick={() => onProposeMeetup(conn)}
                className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-all whitespace-nowrap"
              >
                Propose meetup
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============ MEETUPS TAB ============

function MeetupsTab({
  proposed,
  invited,
  userId,
  respondingMeetup,
  actioningMeetup,
  onAccept,
  onDecline,
  onComplete,
  onCancel,
}: {
  proposed: Meetup[]
  invited: Meetup[]
  userId: string
  respondingMeetup: string | null
  actioningMeetup: string | null
  onAccept: (meetupId: string) => void
  onDecline: (meetupId: string, activityLabel: string) => void
  onComplete: (meetupId: string) => void
  onCancel: (meetupId: string, activityLabel: string) => void
}) {
  const pendingInvites = invited.filter(
    (m) => m.status === "proposed" && m.participants.find((p) => p.userId === userId)?.status === "invited"
  )
  const activeProposed = proposed.filter((m) => m.status === "proposed" || m.status === "confirmed")
  const history = [
    ...invited.filter((m) => m.status !== "proposed" || m.participants.find((p) => p.userId === userId)?.status !== "invited"),
    ...proposed.filter((m) => m.status === "completed" || m.status === "cancelled"),
  ]

  if (proposed.length === 0 && invited.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-6 text-center">
        <div className="w-10 h-10 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-stone-900 font-medium text-sm">No meetups yet</p>
        <p className="text-stone-400 text-xs mt-2 max-w-xs mx-auto">
          Once you're connected, propose a meetup to do something together.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {pendingInvites.length > 0 && (
        <Section title="Invitations">
          {pendingInvites.map((meetup) => (
            <MeetupCard
              key={meetup.id}
              meetup={meetup}
              type="invited"
              userId={userId}
              responding={respondingMeetup === meetup.id}
              onAccept={onAccept}
              onDecline={onDecline}
            />
          ))}
        </Section>
      )}

      {activeProposed.length > 0 && (
        <Section title="Your proposals">
          {activeProposed.map((meetup) => (
            <MeetupCard
              key={meetup.id}
              meetup={meetup}
              type="proposed"
              userId={userId}
              actioning={actioningMeetup === meetup.id}
              onComplete={onComplete}
              onCancel={onCancel}
            />
          ))}
        </Section>
      )}

      {history.length > 0 && (
        <Section title="History">
          {history.map((meetup) => (
            <MeetupCard key={meetup.id} meetup={meetup} type="history" userId={userId} />
          ))}
        </Section>
      )}
    </div>
  )
}

// ============ SHARED COMPONENTS ============

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
        {title}
      </h2>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

function PingCard({
  ping,
  type,
  responding,
  onAccept,
  onDecline,
}: {
  ping: SoftPing
  type: "sent" | "received"
  responding?: boolean
  onAccept?: (pingId: string) => void
  onDecline?: (pingId: string, senderHandle: string) => void
}) {
  const isPending = ping.status === "pending"
  const otherHandle = type === "sent" ? ping.receiverHandle : ping.senderHandle

  return (
    <div
      className={cn(
        "border rounded-2xl p-5",
        isPending && type === "received"
          ? "border-2 border-emerald-400 bg-emerald-50/50"
          : "bg-white border-stone-200"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-stone-900 font-medium">@{otherHandle}</p>
            {isPending && type === "received" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-600 text-white uppercase tracking-wide">
                New
              </span>
            )}
            {!isPending && (
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-medium",
                  ping.status === "accepted"
                    ? "bg-emerald-100 text-emerald-700"
                    : ping.status === "declined"
                    ? "bg-stone-100 text-stone-500"
                    : "bg-amber-100 text-amber-700"
                )}
              >
                {ping.status}
              </span>
            )}
          </div>

          <p className="text-stone-600 text-sm mt-2">
            {type === "received" ? "wants to" : "you want to"}{" "}
            <span className="font-medium">
              {ping.activityVerb.toLowerCase().replace("i ", "")}
            </span>{" "}
            <span className="text-stone-400">{TIMEFRAME_LABELS[ping.timeframe]}</span>
          </p>

          {ping.message && (
            <p className="text-stone-500 text-sm mt-2 italic">"{ping.message}"</p>
          )}

          <p className="text-stone-300 text-xs mt-3">
            {formatRelativeTime(ping.createdAt)}
          </p>
        </div>
      </div>

      {isPending && type === "received" && onAccept && onDecline && (
        <div className="mt-4 pt-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={() => onDecline(ping.id, ping.senderHandle)}
            disabled={responding}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={() => onAccept(ping.id)}
            disabled={responding}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-stone-900 text-white hover:bg-stone-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {responding ? (
              <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
            ) : (
              "Accept"
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function MeetupCard({
  meetup,
  type,
  userId,
  responding,
  actioning,
  onAccept,
  onDecline,
  onComplete,
  onCancel,
}: {
  meetup: Meetup
  type: "invited" | "proposed" | "history"
  userId: string
  responding?: boolean
  actioning?: boolean
  onAccept?: (meetupId: string) => void
  onDecline?: (meetupId: string, activityLabel: string) => void
  onComplete?: (meetupId: string) => void
  onCancel?: (meetupId: string, activityLabel: string) => void
}) {
  const myParticipation = meetup.participants.find((p) => p.userId === userId)
  const isPendingResponse = type === "invited" && meetup.status === "proposed" && myParticipation?.status === "invited"
  const acceptedCount = meetup.participants.filter((p) => p.status === "accepted").length

  return (
    <div
      className={cn(
        "border rounded-2xl p-5",
        isPendingResponse
          ? "border-2 border-emerald-400 bg-emerald-50/50"
          : "bg-white border-stone-200"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-stone-900 font-medium">{meetup.activityLabel}</p>
            {isPendingResponse && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-600 text-white uppercase tracking-wide">
                New
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-600">
              {meetup.meetupType === "group" ? "Group" : "1-on-1"}
            </span>
          </div>

          {type === "invited" && (
            <p className="text-stone-500 text-sm mt-1">
              Proposed by @{meetup.proposerHandle}
            </p>
          )}

          <div className="mt-3 space-y-1">
            <p className="text-stone-600 text-sm">
              <span className="text-stone-400">Where:</span> {meetup.neighborhood}
            </p>
            {meetup.proposedTime && (
              <p className="text-stone-600 text-sm">
                <span className="text-stone-400">When:</span> {TIME_LABELS[meetup.proposedTime] || meetup.proposedTime}
              </p>
            )}
          </div>

          {type === "proposed" && (
            <div className="mt-3">
              <p className="text-stone-400 text-xs">
                {acceptedCount} of {meetup.participants.length} accepted
              </p>
            </div>
          )}

          <div className="mt-3">
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", STATUS_COLORS[meetup.status])}>
              {meetup.status === "proposed" ? "Awaiting responses" : meetup.status}
            </span>
          </div>

          <p className="text-stone-300 text-xs mt-2">
            {formatRelativeTime(meetup.createdAt)}
          </p>
        </div>
      </div>

      {isPendingResponse && onAccept && onDecline && (
        <div className="mt-4 pt-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={() => onDecline(meetup.id, meetup.activityLabel)}
            disabled={responding}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={() => onAccept(meetup.id)}
            disabled={responding}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-stone-900 text-white hover:bg-stone-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {responding ? (
              <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
            ) : (
              "Accept"
            )}
          </button>
        </div>
      )}

      {type === "proposed" && meetup.status === "confirmed" && onComplete && onCancel && (
        <div className="mt-4 pt-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={() => onCancel(meetup.id, meetup.activityLabel)}
            disabled={actioning}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onComplete(meetup.id)}
            disabled={actioning}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-500 transition-all disabled:opacity-50"
          >
            {actioning ? "..." : "Mark completed"}
          </button>
        </div>
      )}

      {type === "proposed" && meetup.status === "proposed" && onCancel && (
        <div className="mt-4 pt-4 border-t border-stone-100">
          <button
            onClick={() => onCancel(meetup.id, meetup.activityLabel)}
            disabled={actioning}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all disabled:opacity-50"
          >
            Cancel meetup
          </button>
        </div>
      )}
    </div>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

// ============ CONFIRM DIALOG ============

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-medium text-stone-900">{title}</h3>
        <p className="mt-2 text-stone-500 text-sm">{message}</p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-all"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
