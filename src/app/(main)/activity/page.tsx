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
            onRespond={handleRespondPing}
          />
        )}

        {activeTab === "connections" && (
          <ConnectionsTab
            connections={connections}
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
            onRespond={handleRespondMeetup}
            onComplete={handleCompleteMeetup}
            onCancel={handleCancelMeetup}
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
    </div>
  )
}

// ============ PINGS TAB ============

function PingsTab({
  received,
  sent,
  responding,
  onRespond,
}: {
  received: SoftPing[]
  sent: SoftPing[]
  responding: string | null
  onRespond: (pingId: string, accept: boolean) => void
}) {
  const pendingReceived = received.filter((p) => p.status === "pending")
  const historyReceived = received.filter((p) => p.status !== "pending")
  const pendingSent = sent.filter((p) => p.status === "pending")
  const historySent = sent.filter((p) => p.status !== "pending")

  if (received.length === 0 && sent.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <p className="text-stone-500 text-sm">No pings yet.</p>
        <p className="text-stone-400 text-xs mt-2">
          When you find a mutual match, you can send them a ping.
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
              onRespond={onRespond}
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
  onProposeMeetup,
}: {
  connections: Connection[]
  onProposeMeetup: (conn: Connection) => void
}) {
  if (connections.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <p className="text-stone-500 text-sm">No connections yet.</p>
        <p className="text-stone-400 text-xs mt-2">
          When someone accepts your ping (or you accept theirs), you'll be connected.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className="bg-white border border-stone-200 rounded-2xl p-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-stone-900 font-medium">@{conn.otherHandle}</p>
              <p className="text-stone-400 text-sm mt-0.5">
                {conn.sharedActivities.map((a) => a.label).join(", ")}
              </p>
              <p className="text-stone-300 text-xs mt-2">
                Connected {formatRelativeTime(conn.connectedAt)}
              </p>
            </div>
            <button
              onClick={() => onProposeMeetup(conn)}
              className="px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-xl hover:bg-stone-700 transition-all whitespace-nowrap"
            >
              Propose meetup
            </button>
          </div>
        </div>
      ))}
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
  onRespond,
  onComplete,
  onCancel,
}: {
  proposed: Meetup[]
  invited: Meetup[]
  userId: string
  respondingMeetup: string | null
  actioningMeetup: string | null
  onRespond: (meetupId: string, accept: boolean) => void
  onComplete: (meetupId: string) => void
  onCancel: (meetupId: string) => void
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
      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <p className="text-stone-500 text-sm">No meetups yet.</p>
        <p className="text-stone-400 text-xs mt-2">
          Go to Connections to propose a meetup with someone.
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
              onRespond={onRespond}
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
  onRespond,
}: {
  ping: SoftPing
  type: "sent" | "received"
  responding?: boolean
  onRespond?: (pingId: string, accept: boolean) => void
}) {
  const isPending = ping.status === "pending"
  const otherHandle = type === "sent" ? ping.receiverHandle : ping.senderHandle

  return (
    <div
      className={cn(
        "bg-white border rounded-2xl p-5",
        isPending && type === "received" ? "border-emerald-200" : "border-stone-200"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-stone-900 font-medium">@{otherHandle}</p>
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

      {isPending && type === "received" && onRespond && (
        <div className="mt-4 pt-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={() => onRespond(ping.id, false)}
            disabled={responding}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={() => onRespond(ping.id, true)}
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
  onRespond,
  onComplete,
  onCancel,
}: {
  meetup: Meetup
  type: "invited" | "proposed" | "history"
  userId: string
  responding?: boolean
  actioning?: boolean
  onRespond?: (meetupId: string, accept: boolean) => void
  onComplete?: (meetupId: string) => void
  onCancel?: (meetupId: string) => void
}) {
  const myParticipation = meetup.participants.find((p) => p.userId === userId)
  const isPendingResponse = type === "invited" && meetup.status === "proposed" && myParticipation?.status === "invited"
  const acceptedCount = meetup.participants.filter((p) => p.status === "accepted").length

  return (
    <div
      className={cn(
        "bg-white border rounded-2xl p-5",
        isPendingResponse ? "border-emerald-200" : "border-stone-200"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-stone-900 font-medium">{meetup.activityLabel}</p>
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

      {isPendingResponse && onRespond && (
        <div className="mt-4 pt-4 border-t border-stone-100 flex gap-3">
          <button
            onClick={() => onRespond(meetup.id, false)}
            disabled={responding}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={() => onRespond(meetup.id, true)}
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
            onClick={() => onCancel(meetup.id)}
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
            onClick={() => onCancel(meetup.id)}
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
