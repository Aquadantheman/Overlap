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
import { cn } from "@/lib/utils"

type Tab = "received" | "sent" | "connections"

type Connection = {
  id: string
  otherUserId: string
  otherHandle: string
  sharedActivities: string[]
  connectedAt: string
}

export default function ConnectionsPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string>("")
  const [activeTab, setActiveTab] = useState<Tab>("received")
  const [receivedPings, setReceivedPings] = useState<SoftPing[]>([])
  const [sentPings, setSentPings] = useState<SoftPing[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [responding, setResponding] = useState<string | null>(null)

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = "/signin"
      return
    }

    setUserId(user.id)

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
      // Get activity labels
      const allActivityIds = connectionData.flatMap((c) => c.shared_activity_ids || [])
      const uniqueActivityIds = [...new Set(allActivityIds)]

      let activityMap = new Map<string, string>()
      if (uniqueActivityIds.length > 0) {
        const { data: activities } = await supabase
          .from("activities")
          .select("id, label")
          .in("id", uniqueActivityIds)

        activityMap = new Map(activities?.map((a) => [a.id, a.label]) || [])
      }

      const mapped: Connection[] = connectionData.map((c) => {
        const isInitiator = c.initiator_id === user.id
        const other = isInitiator
          ? (c.receiver as { id: string; handle: string })
          : (c.initiator as { id: string; handle: string })

        return {
          id: c.id,
          otherUserId: other?.id || "",
          otherHandle: other?.handle || "",
          sharedActivities: (c.shared_activity_ids || []).map(
            (id: string) => activityMap.get(id) || ""
          ).filter(Boolean),
          connectedAt: c.connected_at,
        }
      })

      setConnections(mapped)
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRespond = async (pingId: string, accept: boolean) => {
    setResponding(pingId)

    const result = await respondToPing(pingId, userId, accept)

    if (result.success) {
      // Reload data to reflect changes
      await loadData()
    }

    setResponding(null)
  }

  const pendingReceived = receivedPings.filter((p) => p.status === "pending")
  const historyReceived = receivedPings.filter((p) => p.status !== "pending")

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-6">
          <a
            href="/overlap"
            className="text-stone-400 text-sm hover:text-stone-600 transition-colors"
          >
            Back to overlap
          </a>
          <h1 className="text-2xl font-medium text-stone-900 tracking-tight mt-2">
            Connections
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6">
          {(["received", "sent", "connections"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                activeTab === tab
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-500 hover:text-stone-700"
              )}
            >
              {tab === "received" && `Received${pendingReceived.length > 0 ? ` (${pendingReceived.length})` : ""}`}
              {tab === "sent" && "Sent"}
              {tab === "connections" && `Connected${connections.length > 0 ? ` (${connections.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === "received" && (
          <ReceivedTab
            pending={pendingReceived}
            history={historyReceived}
            responding={responding}
            onRespond={handleRespond}
          />
        )}

        {activeTab === "sent" && <SentTab pings={sentPings} />}

        {activeTab === "connections" && <ConnectionsTab connections={connections} />}
      </div>
    </div>
  )
}

function ReceivedTab({
  pending,
  history,
  responding,
  onRespond,
}: {
  pending: SoftPing[]
  history: SoftPing[]
  responding: string | null
  onRespond: (pingId: string, accept: boolean) => void
}) {
  if (pending.length === 0 && history.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <p className="text-stone-500 text-sm">No pings yet.</p>
        <p className="text-stone-400 text-xs mt-2">
          When someone wants to connect over a shared interest, their ping will appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
            Pending
          </h2>
          <div className="flex flex-col gap-3">
            {pending.map((ping) => (
              <PingCard
                key={ping.id}
                ping={ping}
                type="received"
                responding={responding === ping.id}
                onRespond={onRespond}
              />
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
            History
          </h2>
          <div className="flex flex-col gap-3">
            {history.map((ping) => (
              <PingCard key={ping.id} ping={ping} type="received" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SentTab({ pings }: { pings: SoftPing[] }) {
  const pending = pings.filter((p) => p.status === "pending")
  const history = pings.filter((p) => p.status !== "pending")

  if (pings.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <p className="text-stone-500 text-sm">No pings sent yet.</p>
        <p className="text-stone-400 text-xs mt-2">
          When you signal mutual interest with someone, you can send them a ping.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {pending.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
            Awaiting response
          </h2>
          <div className="flex flex-col gap-3">
            {pending.map((ping) => (
              <PingCard key={ping.id} ping={ping} type="sent" />
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
            Past pings
          </h2>
          <div className="flex flex-col gap-3">
            {history.map((ping) => (
              <PingCard key={ping.id} ping={ping} type="sent" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectionsTab({ connections }: { connections: Connection[] }) {
  if (connections.length === 0) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
        <p className="text-stone-500 text-sm">No connections yet.</p>
        <p className="text-stone-400 text-xs mt-2">
          When you and someone else both accept a ping, you'll be connected here.
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-stone-900 font-medium">@{conn.otherHandle}</p>
              <p className="text-stone-400 text-sm mt-0.5">
                {conn.sharedActivities.join(", ")}
              </p>
              <p className="text-stone-300 text-xs mt-2">
                Connected {formatRelativeTime(conn.connectedAt)}
              </p>
            </div>
          </div>
        </div>
      ))}
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
        isPending && type === "received"
          ? "border-emerald-200"
          : "border-stone-200"
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
            Not now
          </button>
          <button
            onClick={() => onRespond(ping.id, true)}
            disabled={responding}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-stone-900 text-white hover:bg-stone-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {responding ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              </>
            ) : (
              "Accept"
            )}
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
