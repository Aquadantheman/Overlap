"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { findOverlaps, OverlapResult, OverlapCluster } from "@/lib/matching/findOverlaps"
import { signalMeToo, removeMeToo, getMySignals, findMutuals, MutualMatch } from "@/lib/matching/meToo"
import { sendPing, Timeframe, TIMEFRAME_LABELS, getPendingPingCount } from "@/lib/pings/softPing"
import { cn } from "@/lib/utils"

type ViewState = "loading" | "no-profile" | "empty" | "has-overlaps"

type PingTarget = {
  userId: string
  handle: string
  activities: { id: string; label: string; verb: string }[]
}

export default function OverlapPage() {
  const [state, setState] = useState<ViewState>("loading")
  const [overlaps, setOverlaps] = useState<OverlapResult | null>(null)
  const [mutuals, setMutuals] = useState<MutualMatch[]>([])
  const [mySignals, setMySignals] = useState<Set<string>>(new Set())
  const [handle, setHandle] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [pendingPingCount, setPendingPingCount] = useState<number>(0)

  // Ping composer state
  const [pingTarget, setPingTarget] = useState<PingTarget | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<string>("")
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("this_week")
  const [pingMessage, setPingMessage] = useState<string>("")
  const [pingSending, setPingSending] = useState(false)
  const [pingError, setPingError] = useState<string | null>(null)
  const [pingSuccess, setPingSuccess] = useState(false)

  const loadData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      window.location.href = "/signin"
      return
    }

    setUserId(user.id)

    const { data: profile } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", user.id)
      .single()

    if (!profile) {
      setState("no-profile")
      return
    }

    setHandle(profile.handle)

    const [overlapResult, signals, mutualMatches, pingCount] = await Promise.all([
      findOverlaps(user.id),
      getMySignals(user.id),
      findMutuals(user.id),
      getPendingPingCount(user.id),
    ])

    if (!overlapResult) {
      setState("no-profile")
      return
    }

    setOverlaps(overlapResult)
    setMySignals(new Set(signals))
    setMutuals(mutualMatches)
    setPendingPingCount(pingCount)
    setState(overlapResult.clusters.length > 0 || mutualMatches.length > 0 ? "has-overlaps" : "empty")
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleMeToo = async (activityId: string) => {
    if (!userId) return

    const isSignaled = mySignals.has(activityId)

    const newSignals = new Set(mySignals)
    if (isSignaled) {
      newSignals.delete(activityId)
    } else {
      newSignals.add(activityId)
    }
    setMySignals(newSignals)

    if (isSignaled) {
      await removeMeToo(userId, activityId)
    } else {
      await signalMeToo(userId, activityId)
    }

    const newMutuals = await findMutuals(userId)
    setMutuals(newMutuals)
  }

  const openPingComposer = (target: PingTarget) => {
    setPingTarget(target)
    setSelectedActivity(target.activities[0]?.id || "")
    setSelectedTimeframe("this_week")
    setPingMessage("")
    setPingError(null)
    setPingSuccess(false)
  }

  const closePingComposer = () => {
    setPingTarget(null)
    setPingError(null)
    setPingSuccess(false)
  }

  const handleSendPing = async () => {
    if (!pingTarget || !selectedActivity || !userId) return

    setPingSending(true)
    setPingError(null)

    const result = await sendPing(
      userId,
      pingTarget.userId,
      selectedActivity,
      selectedTimeframe,
      pingMessage.trim() || null
    )

    setPingSending(false)

    if (result.success) {
      setPingSuccess(true)
      // Refresh ping count
      const newCount = await getPendingPingCount(userId)
      setPendingPingCount(newCount)
    } else {
      setPingError(result.error || "Failed to send ping")
    }
  }

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
      </div>
    )
  }

  if (state === "no-profile") {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-medium text-stone-900">Almost there</h1>
          <p className="mt-2 text-stone-500 text-sm">
            Complete your profile to see who shares your interests nearby.
          </p>
          <a
            href="/onboarding"
            className="mt-6 inline-block px-6 py-3 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-all"
          >
            Finish setup
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <p className="text-stone-400 text-sm">@{handle}</p>
            <h1 className="text-2xl font-medium text-stone-900 tracking-tight mt-1">
              Your overlap
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/network"
              className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-full text-xs font-medium hover:bg-stone-200 transition-all"
            >
              Network
            </a>
            {pendingPingCount > 0 && (
              <a
                href="/connections"
                className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium"
              >
                {pendingPingCount} new {pendingPingCount === 1 ? "ping" : "pings"}
              </a>
            )}
          </div>
        </div>

        {state === "empty" ? (
          <EmptyState />
        ) : (
          <>
            {mutuals.length > 0 && (
              <MutualsSection mutuals={mutuals} onPing={openPingComposer} />
            )}

            {overlaps && overlaps.clusters.length > 0 && (
              <OverlapList
                overlaps={overlaps}
                mySignals={mySignals}
                onMeToo={handleMeToo}
              />
            )}
          </>
        )}
      </div>

      {/* Ping Composer Modal */}
      {pingTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            {pingSuccess ? (
              <>
                <h2 className="text-lg font-medium text-stone-900">Ping sent</h2>
                <p className="mt-2 text-stone-500 text-sm">
                  @{pingTarget.handle} will see your ping. If they accept, you'll be connected.
                </p>
                <button
                  onClick={closePingComposer}
                  className="mt-6 w-full py-2.5 rounded-xl text-sm font-medium bg-stone-900 text-white hover:bg-stone-700 transition-all"
                >
                  Done
                </button>
              </>
            ) : (
              <>
                <h2 className="text-lg font-medium text-stone-900">
                  Ping @{pingTarget.handle}
                </h2>
                <p className="mt-1 text-stone-500 text-sm">
                  Invite them to do something together.
                </p>

                {pingError && (
                  <div className="mt-4 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-sm">{pingError}</p>
                  </div>
                )}

                <div className="mt-6 flex flex-col gap-4">
                  {/* Activity selector */}
                  {pingTarget.activities.length > 1 && (
                    <div>
                      <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                        Activity
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pingTarget.activities.map((a) => (
                          <button
                            key={a.id}
                            onClick={() => setSelectedActivity(a.id)}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                              selectedActivity === a.id
                                ? "bg-stone-900 text-white border-stone-900"
                                : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                            )}
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeframe selector */}
                  <div>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                      When
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(TIMEFRAME_LABELS) as Timeframe[]).map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setSelectedTimeframe(tf)}
                          className={cn(
                            "px-3 py-2 rounded-lg text-sm font-medium transition-all border",
                            selectedTimeframe === tf
                              ? "bg-stone-900 text-white border-stone-900"
                              : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                          )}
                        >
                          {TIMEFRAME_LABELS[tf].charAt(0).toUpperCase() + TIMEFRAME_LABELS[tf].slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Optional message */}
                  <div>
                    <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                      Add a note (optional)
                    </p>
                    <textarea
                      value={pingMessage}
                      onChange={(e) => setPingMessage(e.target.value.slice(0, 140))}
                      placeholder="I usually go to the farmers market on Saturdays..."
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all resize-none"
                    />
                    <p className="text-xs text-stone-400 mt-1">
                      {pingMessage.length}/140
                    </p>
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-4 p-3 bg-stone-50 rounded-xl">
                  <p className="text-stone-600 text-sm">
                    "I'm going{" "}
                    <span className="font-medium">
                      {pingTarget.activities.find((a) => a.id === selectedActivity)?.verb.toLowerCase().replace("i ", "") || "..."}
                    </span>{" "}
                    <span className="font-medium">{TIMEFRAME_LABELS[selectedTimeframe]}</span>
                    , open to joining up if you're interested."
                  </p>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={closePingComposer}
                    disabled={pingSending}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendPing}
                    disabled={pingSending || !selectedActivity}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-stone-900 text-white hover:bg-stone-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {pingSending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send ping"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center">
      <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-stone-400 text-lg">...</span>
      </div>
      <h2 className="text-lg font-medium text-stone-900">No overlaps yet</h2>
      <p className="mt-2 text-stone-500 text-sm leading-relaxed max-w-xs mx-auto">
        You're on the map. When someone nearby shares your interests, they'll appear here.
      </p>
      <p className="mt-4 text-stone-400 text-xs">
        Check back soon - your scene is growing.
      </p>
    </div>
  )
}

function MutualsSection({
  mutuals,
  onPing,
}: {
  mutuals: MutualMatch[]
  onPing: (target: PingTarget) => void
}) {
  // Group mutuals by user
  const byUser = new Map<string, MutualMatch[]>()
  for (const m of mutuals) {
    const existing = byUser.get(m.otherUserId) || []
    existing.push(m)
    byUser.set(m.otherUserId, existing)
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
        Mutual Interest
      </h2>
      <p className="text-stone-400 text-xs mb-4">
        You both signaled interest. You can now send a ping.
      </p>
      <div className="flex flex-col gap-3">
        {Array.from(byUser.entries()).map(([otherUserId, matches]) => (
          <div
            key={otherUserId}
            className="bg-white border border-emerald-200 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-stone-900 font-medium">
                  @{matches[0].otherHandle}
                </p>
                <p className="text-stone-400 text-sm mt-0.5">
                  {matches.map((m) => m.activityLabel).join(", ")}
                </p>
              </div>
              <button
                onClick={() =>
                  onPing({
                    userId: matches[0].otherUserId,
                    handle: matches[0].otherHandle,
                    activities: matches.map((m) => ({
                      id: m.activityId,
                      label: m.activityLabel,
                      verb: m.activityVerb,
                    })),
                  })
                }
                className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-all"
              >
                Send ping
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function OverlapList({
  overlaps,
  mySignals,
  onMeToo,
}: {
  overlaps: OverlapResult
  mySignals: Set<string>
  onMeToo: (activityId: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="mb-4">
        <p className="text-stone-500 text-sm">
          <span className="text-stone-900 font-medium">
            {overlaps.totalNearby} {overlaps.totalNearby === 1 ? "person" : "people"}
          </span>
          {" "}nearby share your interests
        </p>
      </div>

      {overlaps.clusters.map((cluster) => (
        <ClusterCard
          key={cluster.activityId}
          cluster={cluster}
          isSignaled={mySignals.has(cluster.activityId)}
          onMeToo={() => onMeToo(cluster.activityId)}
        />
      ))}
    </div>
  )
}

function ClusterCard({
  cluster,
  isSignaled,
  onMeToo,
}: {
  cluster: OverlapCluster
  isSignaled: boolean
  onMeToo: () => void
}) {
  return (
    <div
      className={cn(
        "bg-white border rounded-2xl p-5 transition-all",
        isSignaled ? "border-stone-400" : "border-stone-200 hover:border-stone-300"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <span className="text-stone-500 text-sm font-medium">{cluster.count}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-stone-900 font-medium">
            {cluster.count} {cluster.count === 1 ? "person" : "people"} also{" "}
            {cluster.activityVerb.toLowerCase().replace("i ", "")}
          </p>
          <p className="text-stone-400 text-sm mt-0.5">{cluster.activityLabel}</p>
          {cluster.activeThisWeek > 0 && (
            <p className="text-emerald-600 text-xs mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              {cluster.activeThisWeek} active this week
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-stone-100">
        <button
          onClick={onMeToo}
          className={cn(
            "w-full py-2.5 rounded-xl text-sm font-medium transition-all",
            isSignaled
              ? "bg-stone-100 text-stone-600 hover:bg-stone-200"
              : "bg-stone-900 text-white hover:bg-stone-700"
          )}
        >
          {isSignaled ? "Signaled - tap to undo" : "Me too"}
        </button>
        <p className="text-stone-400 text-xs mt-2 text-center">
          {isSignaled
            ? "If someone else also taps, you'll both find out at the same time."
            : "Signal interest. They won't know unless they also tap."}
        </p>
      </div>
    </div>
  )
}
