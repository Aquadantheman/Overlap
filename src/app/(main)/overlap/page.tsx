"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { findOverlaps, findNearMisses, OverlapResult, OverlapCluster, NearMissResult } from "@/lib/matching/findOverlaps"
import { signalMeToo, removeMeToo, getMySignals, findMutuals, MutualMatch } from "@/lib/matching/meToo"
import { sendPing, getSentPings, Timeframe, TIMEFRAME_LABELS } from "@/lib/pings/softPing"
import { cn } from "@/lib/utils"
import Link from "next/link"

type ViewState = "loading" | "no-profile" | "empty" | "has-overlaps"

type PingTarget = {
  userId: string
  handle: string
  activities: { id: string; label: string; verb: string }[]
}

const STORAGE_KEYS = {
  seenHowItWorks: "overlap_seen_how_it_works",
  seenMeTooExplainer: "overlap_seen_metoo_explainer",
  pingDraft: "overlap_ping_draft",
}

type PingDraft = {
  targetUserId: string
  message: string
  timeframe: Timeframe
  savedAt: number
}

// Draft expires after 1 hour
const DRAFT_EXPIRY_MS = 60 * 60 * 1000

export default function OverlapPage() {
  const [state, setState] = useState<ViewState>("loading")
  const [overlaps, setOverlaps] = useState<OverlapResult | null>(null)
  const [nearMisses, setNearMisses] = useState<NearMissResult | null>(null)
  const [mutuals, setMutuals] = useState<MutualMatch[]>([])
  const [mySignals, setMySignals] = useState<Set<string>>(new Set())
  const [handle, setHandle] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [expandingRadius, setExpandingRadius] = useState(false)
  const [pendingSentPings, setPendingSentPings] = useState(0)

  // First-time user experience state
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [showMeTooExplainer, setShowMeTooExplainer] = useState(false)

  // Toast state
  const [toast, setToast] = useState<{ message: string; type: "default" | "match" } | null>(null)

  // Me Too loading state
  const [signalingActivity, setSignalingActivity] = useState<string | null>(null)

  // Ping composer state
  const [pingTarget, setPingTarget] = useState<PingTarget | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<string>("")
  const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>("this_week")
  const [pingMessage, setPingMessage] = useState<string>("")
  const [pingSending, setPingSending] = useState(false)
  const [pingError, setPingError] = useState<string | null>(null)
  const [pingSuccess, setPingSuccess] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

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

    const [overlapResult, nearMissResult, signals, mutualMatches, sentPings] = await Promise.all([
      findOverlaps(user.id),
      findNearMisses(user.id),
      getMySignals(user.id),
      findMutuals(user.id),
      getSentPings(user.id),
    ])

    // Count pending sent pings
    const pendingCount = sentPings.filter(p => p.status === "pending").length
    setPendingSentPings(pendingCount)

    if (!overlapResult) {
      setState("no-profile")
      return
    }

    setOverlaps(overlapResult)
    setNearMisses(nearMissResult)
    setMySignals(new Set(signals))
    setMutuals(mutualMatches)
    setState(overlapResult.clusters.length > 0 || mutualMatches.length > 0 ? "has-overlaps" : "empty")
  }

  useEffect(() => {
    loadData()

    // Check if user has seen the "How it works" banner
    const seenHowItWorks = localStorage.getItem(STORAGE_KEYS.seenHowItWorks)
    const seenMeTooExplainer = localStorage.getItem(STORAGE_KEYS.seenMeTooExplainer)

    if (!seenHowItWorks) {
      setShowHowItWorks(true)
    } else if (!seenMeTooExplainer) {
      // If they've seen How It Works but not the Me Too explainer, show it
      setShowMeTooExplainer(true)
    }
  }, [])

  const dismissHowItWorks = () => {
    localStorage.setItem(STORAGE_KEYS.seenHowItWorks, "true")
    setShowHowItWorks(false)

    // Show Me Too explainer after How It Works (two-step education)
    const seenMeTooExplainer = localStorage.getItem(STORAGE_KEYS.seenMeTooExplainer)
    if (!seenMeTooExplainer) {
      setShowMeTooExplainer(true)
    }
  }

  const reopenHowItWorks = () => {
    setShowHowItWorks(true)
  }

  const dismissMeTooExplainer = () => {
    localStorage.setItem(STORAGE_KEYS.seenMeTooExplainer, "true")
    setShowMeTooExplainer(false)
  }

  const showToast = (message: string, type: "default" | "match" = "default") => {
    setToast({ message, type })
    setTimeout(() => setToast(null), type === "match" ? 4000 : 2000) // Match toasts stay longer
  }

  const handleMeToo = async (activityId: string) => {
    if (!userId || signalingActivity) return

    setSignalingActivity(activityId)
    const isSignaled = mySignals.has(activityId)
    const previousMutualIds = new Set(mutuals.map(m => `${m.otherUserId}-${m.activityId}`))

    // Optimistic update
    const newSignals = new Set(mySignals)
    if (isSignaled) {
      newSignals.delete(activityId)
    } else {
      newSignals.add(activityId)
    }
    setMySignals(newSignals)

    try {
      if (isSignaled) {
        await removeMeToo(userId, activityId)
        showToast("Signal removed")
      } else {
        await signalMeToo(userId, activityId)
      }

      const newMutuals = await findMutuals(userId)

      // Check for new matches (only when adding a signal, not removing)
      if (!isSignaled) {
        const newMatches = newMutuals.filter(
          m => !previousMutualIds.has(`${m.otherUserId}-${m.activityId}`)
        )

        if (newMatches.length > 0) {
          // Show exciting match notification
          const handles = newMatches.map(m => `@${m.otherHandle}`).join(", ")
          showToast(`You matched with ${handles}!`, "match")
        } else {
          showToast("Interest signaled")
        }
      }

      setMutuals(newMutuals)
    } catch {
      // Revert on error
      setMySignals(mySignals)
      showToast("Something went wrong")
    } finally {
      setSignalingActivity(null)
    }
  }

  const handleExpandRadius = async (newRadius: number) => {
    if (!userId || expandingRadius) return

    setExpandingRadius(true)

    // Remember current overlap count to compare
    const previousCount = overlaps?.totalNearby || 0

    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ radius_miles: newRadius })
      .eq("id", userId)

    if (error) {
      showToast("Couldn't update radius")
      setExpandingRadius(false)
      return
    }

    // Fetch new overlap data directly to get accurate count
    const newOverlapResult = await findOverlaps(userId)
    const newCount = newOverlapResult?.totalNearby || 0
    const diff = newCount - previousCount

    // Reload all data
    await loadData()

    // Show feedback with difference
    if (diff > 0) {
      showToast(`Now searching ${newRadius} miles • ${diff} more ${diff === 1 ? "person" : "people"} found`)
    } else {
      showToast(`Radius expanded to ${newRadius} miles`)
    }

    setExpandingRadius(false)
  }

  const openPingComposer = (target: PingTarget) => {
    setPingTarget(target)
    setSelectedActivity(target.activities[0]?.id || "")
    setPingError(null)
    setPingSuccess(false)
    setShowDiscardConfirm(false)

    // Try to load a saved draft for this user
    try {
      const savedDraft = localStorage.getItem(STORAGE_KEYS.pingDraft)
      if (savedDraft) {
        const draft: PingDraft = JSON.parse(savedDraft)
        if (draft.targetUserId === target.userId && Date.now() - draft.savedAt < DRAFT_EXPIRY_MS) {
          // Restore the draft
          setPingMessage(draft.message)
          setSelectedTimeframe(draft.timeframe)
          return
        }
      }
    } catch {
      // Ignore localStorage errors
    }

    // No valid draft, use defaults
    setSelectedTimeframe("this_week")
    setPingMessage("")
  }

  // Save draft to localStorage
  const savePingDraft = (message: string, timeframe: Timeframe) => {
    if (!pingTarget) return
    try {
      const draft: PingDraft = {
        targetUserId: pingTarget.userId,
        message,
        timeframe,
        savedAt: Date.now(),
      }
      localStorage.setItem(STORAGE_KEYS.pingDraft, JSON.stringify(draft))
    } catch {
      // Ignore localStorage errors
    }
  }

  // Clear draft from localStorage
  const clearPingDraft = () => {
    try {
      localStorage.removeItem(STORAGE_KEYS.pingDraft)
    } catch {
      // Ignore localStorage errors
    }
  }

  // Check if there are unsaved changes in the ping composer
  const hasUnsavedPingChanges = () => {
    if (!pingTarget || pingSuccess) return false
    // Has changes if message is not empty or timeframe changed from default
    return pingMessage.trim().length > 0 || selectedTimeframe !== "this_week"
  }

  const attemptClosePingComposer = () => {
    if (hasUnsavedPingChanges()) {
      setShowDiscardConfirm(true)
    } else {
      closePingComposer()
    }
  }

  const closePingComposer = () => {
    setPingTarget(null)
    setPingError(null)
    setPingSuccess(false)
    setShowDiscardConfirm(false)
    clearPingDraft()
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
      clearPingDraft()
    } else {
      setPingError(result.error || "Something went wrong. Please try again.")
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
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-stone-400 text-sm">@{handle}</p>
              <h1 className="text-2xl font-medium text-stone-900 tracking-tight mt-1">
                Your overlap
              </h1>
            </div>
            {!showHowItWorks && (
              <button
                onClick={reopenHowItWorks}
                className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-all"
                title="How it works"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* How It Works Banner - first time only */}
        {showHowItWorks && (
          <HowItWorksBanner onDismiss={dismissHowItWorks} />
        )}

        {state === "empty" ? (
          <>
            <EmptyState pendingSentPings={pendingSentPings} />
            {nearMisses && nearMisses.nearMisses.length > 0 && (
              <NearMissSection
                nearMisses={nearMisses}
                onExpandRadius={handleExpandRadius}
                expanding={expandingRadius}
              />
            )}
          </>
        ) : (
          <>
            {mutuals.length > 0 && (
              <MutualsSection mutuals={mutuals} onPing={openPingComposer} />
            )}

            {overlaps && overlaps.clusters.length > 0 && (
              <OverlapList
                overlaps={overlaps}
                mySignals={mySignals}
                signalingActivity={signalingActivity}
                onMeToo={handleMeToo}
                onShowHelp={() => setShowMeTooExplainer(true)}
              />
            )}

            {nearMisses && nearMisses.nearMisses.length > 0 && (
              <NearMissSection
                nearMisses={nearMisses}
                onExpandRadius={handleExpandRadius}
                expanding={expandingRadius}
              />
            )}
          </>
        )}
      </div>

      {/* Ping Composer Modal */}
      {pingTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pingSending) attemptClosePingComposer()
          }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl relative">
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
                  <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-red-600 text-sm font-medium">Couldn't send ping</p>
                    <p className="text-red-500 text-sm mt-1">{pingError}</p>
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
                          onClick={() => {
                            setSelectedTimeframe(tf)
                            savePingDraft(pingMessage, tf)
                          }}
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
                      onChange={(e) => {
                        const newMessage = e.target.value.slice(0, 140)
                        setPingMessage(newMessage)
                        savePingDraft(newMessage, selectedTimeframe)
                      }}
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
                <div className="mt-4 bg-stone-50 rounded-xl overflow-hidden">
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wide px-3 pt-3">
                    What they'll see
                  </p>
                  <div className="p-3 pt-2">
                    <p className="text-stone-600 text-sm">
                      "I'm going{" "}
                      <span className="font-medium">
                        {pingTarget.activities.find((a) => a.id === selectedActivity)?.verb.toLowerCase().replace("i ", "") || "..."}
                      </span>{" "}
                      <span className="font-medium">{TIMEFRAME_LABELS[selectedTimeframe]}</span>
                      , open to joining up if you're interested."
                    </p>
                    {pingMessage.trim() && (
                      <p className="text-stone-500 text-sm mt-2 italic border-t border-stone-200 pt-2">
                        + Your note: "{pingMessage.trim()}"
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={attemptClosePingComposer}
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

                {/* Discard confirmation */}
                {showDiscardConfirm && (
                  <div className="absolute inset-0 bg-white rounded-2xl p-6 flex flex-col justify-center">
                    <h3 className="text-lg font-medium text-stone-900 text-center">
                      Discard this ping?
                    </h3>
                    <p className="mt-2 text-stone-500 text-sm text-center">
                      You have unsaved changes that will be lost.
                    </p>
                    <div className="mt-6 flex gap-3">
                      <button
                        onClick={() => setShowDiscardConfirm(false)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all"
                      >
                        Keep editing
                      </button>
                      <button
                        onClick={closePingComposer}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-all"
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Me Too Explainer Modal - first time only */}
      {showMeTooExplainer && (
        <MeTooExplainer onDismiss={dismissMeTooExplainer} />
      )}

      {/* Toast - z-60 to appear above modals */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-200">
          {toast.type === "match" ? (
            <div className="bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">{toast.message}</p>
                <p className="text-xs text-emerald-200">Send them a ping to connect</p>
              </div>
            </div>
          ) : (
            <div className="bg-stone-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {toast.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function HowItWorksBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="bg-stone-900 text-white rounded-2xl p-5 mb-6">
      <div className="flex items-start justify-between">
        <h3 className="font-medium">How Overlap works</h3>
        <button
          onClick={onDismiss}
          className="text-stone-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-sm text-stone-300">
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-xs font-medium">1</span>
          <span>See who shares your interests nearby</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-xs font-medium">2</span>
          <span>Tap "Me too" to signal interest (anonymous until mutual)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-xs font-medium">3</span>
          <span>When you match, send a ping to connect</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full bg-stone-700 flex items-center justify-center text-xs font-medium">4</span>
          <span>Propose a meetup and meet in person</span>
        </div>
      </div>
    </div>
  )
}

function MeTooExplainer({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss()
      }}
    >
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-medium text-stone-900">How "Me too" works</h3>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-stone-600">1</span>
            </div>
            <p className="text-stone-600 text-sm">
              <span className="font-medium">You signal interest</span> — they won't know unless they also tap
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-stone-600">2</span>
            </div>
            <p className="text-stone-600 text-sm">
              <span className="font-medium">If you both signal</span>, you'll match and see each other's handles
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-stone-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-stone-600">3</span>
            </div>
            <p className="text-stone-600 text-sm">
              <span className="font-medium">Send a ping</span> to invite them to do something together
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-stone-600 text-sm">
              <span className="font-medium">Once they accept</span>, you're connected and can plan a meetup
            </p>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="mt-6 w-full py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-all"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

function EmptyState({ pendingSentPings }: { pendingSentPings: number }) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl p-8">
      {/* Pending pings banner */}
      {pendingSentPings > 0 && (
        <Link
          href="/activity"
          className="flex items-center gap-3 p-4 mb-6 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all"
        >
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-amber-700 font-medium">{pendingSentPings}</span>
          </div>
          <div className="flex-1">
            <p className="text-amber-800 font-medium text-sm">
              {pendingSentPings === 1 ? "1 ping awaiting response" : `${pendingSentPings} pings awaiting response`}
            </p>
            <p className="text-amber-600 text-xs mt-0.5">
              Check Activity to see their status
            </p>
          </div>
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      <div className="text-center">
        <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="9" cy="12" r="5" strokeWidth={1.5} />
            <circle cx="15" cy="12" r="5" strokeWidth={1.5} />
          </svg>
        </div>
        <h2 className="text-lg font-medium text-stone-900">No new overlaps</h2>
        <p className="mt-2 text-stone-500 text-sm leading-relaxed max-w-xs mx-auto">
          We haven't found anyone nearby who shares your specific interests yet. This could be because:
        </p>
      </div>

      <div className="mt-4 px-4 py-3 bg-stone-50 rounded-xl">
        <ul className="text-sm text-stone-600 space-y-2">
          <li className="flex items-start gap-2">
            <span className="text-stone-400 mt-0.5">•</span>
            <span>Your interests are niche (that's good — you'll find the right people)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-stone-400 mt-0.5">•</span>
            <span>Your search radius might be small</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-stone-400 mt-0.5">•</span>
            <span>We're still growing in your area</span>
          </li>
        </ul>
      </div>

      <div className="mt-6 pt-6 border-t border-stone-100">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-3">
          Try these to find more people
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/profile"
            className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-all group"
          >
            <div className="w-8 h-8 bg-stone-200 group-hover:bg-stone-300 rounded-lg flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-sm text-stone-700 font-medium">Add more interests</span>
              <p className="text-xs text-stone-400">More interests = more potential matches</p>
            </div>
            <svg className="w-4 h-4 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 hover:bg-stone-100 transition-all group"
          >
            <div className="w-8 h-8 bg-stone-200 group-hover:bg-stone-300 rounded-lg flex items-center justify-center transition-colors">
              <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <span className="text-sm text-stone-700 font-medium">Expand your radius</span>
              <p className="text-xs text-stone-400">Search a wider area around you</p>
            </div>
            <svg className="w-4 h-4 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Timeline expectation */}
      <div className="mt-6 pt-6 border-t border-stone-100">
        <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl">
          <div className="w-8 h-8 bg-stone-200 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-stone-600 font-medium">What to expect</p>
            <p className="text-xs text-stone-400 mt-0.5">
              Most people find their first overlap within a few days. We'll notify you when someone matches your interests.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function NearMissSection({
  nearMisses,
  onExpandRadius,
  expanding,
}: {
  nearMisses: NearMissResult
  onExpandRadius: (radius: number) => void
  expanding: boolean
}) {
  // Find the maximum suggested radius across all near misses
  const maxSuggestedRadius = Math.max(...nearMisses.nearMisses.map(nm => nm.suggestedRadius))

  // Format distance range nicely
  const formatDistanceRange = (min: number, max: number) => {
    if (min === max) return `${min} miles away`
    return `${min}–${max} miles away`
  }

  return (
    <div className="mt-8 bg-white border border-amber-200 rounded-2xl p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-stone-900 font-medium">Just outside your radius</h3>
          <p className="text-stone-500 text-sm mt-0.5">
            {nearMisses.totalJustOutside} {nearMisses.totalJustOutside === 1 ? "person shares" : "people share"} your interests
          </p>
        </div>
      </div>

      {/* Activity breakdown */}
      <div className="space-y-2 mb-5">
        {nearMisses.nearMisses.slice(0, 3).map((nm) => (
          <div key={nm.activityId} className="flex items-center justify-between py-2 px-3 bg-amber-50 rounded-lg">
            <span className="text-sm text-stone-700">{nm.activityLabel}</span>
            <span className="text-xs text-stone-500">
              {nm.count} {nm.count === 1 ? "person" : "people"} • {formatDistanceRange(nm.minDistance, nm.maxDistance)}
            </span>
          </div>
        ))}
        {nearMisses.nearMisses.length > 3 && (
          <p className="text-xs text-stone-400 text-center">
            +{nearMisses.nearMisses.length - 3} more interests
          </p>
        )}
      </div>

      {/* Visual explanation */}
      <div className="mb-5 px-4 py-3 bg-stone-50 rounded-xl">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-stone-400 rounded-full" />
            <span className="text-xs text-stone-500">You</span>
          </div>
          <div className="flex-1 flex items-center">
            <div className="flex-1 h-0.5 bg-emerald-300" />
            <span className="text-xs text-stone-400 mx-2">{nearMisses.currentRadius}mi</span>
            <div className="flex-1 h-0.5 bg-amber-300 border-dashed" style={{ borderTopWidth: 2, borderStyle: 'dashed' }} />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-amber-500 rounded-full" />
            <span className="text-xs text-stone-500">Them</span>
          </div>
        </div>
        <p className="text-xs text-stone-500 text-center">
          Your current radius is {nearMisses.currentRadius} miles. These people are {nearMisses.nearMisses[0]?.minDistance}–{maxSuggestedRadius} miles away.
        </p>
      </div>

      {/* What expanding means */}
      <div className="mb-4 px-3 py-2 border border-stone-200 rounded-lg bg-white">
        <p className="text-xs text-stone-600">
          <span className="font-medium">What this means:</span> Expanding your radius lets you see people further away — and they'll be able to see you too.
        </p>
      </div>

      {/* Expand button */}
      <button
        onClick={() => onExpandRadius(maxSuggestedRadius)}
        disabled={expanding}
        className="w-full py-3 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-400 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
      >
        {expanding ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Expanding...
          </>
        ) : (
          <>Expand to {maxSuggestedRadius} miles</>
        )}
      </button>
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
  // Group mutuals by activity (activity-first design)
  const byActivity = new Map<string, MutualMatch[]>()
  for (const m of mutuals) {
    const existing = byActivity.get(m.activityId) || []
    existing.push(m)
    byActivity.set(m.activityId, existing)
  }

  return (
    <div className="mb-8">
      <h2 className="text-sm font-medium text-stone-500 uppercase tracking-wide mb-3">
        Mutual Interest
      </h2>
      <p className="text-stone-400 text-xs mb-4">
        You both signaled interest. Send a ping to connect.
      </p>
      <div className="flex flex-col gap-3">
        {Array.from(byActivity.entries()).map(([activityId, matches]) => (
          <div
            key={activityId}
            className="bg-white border border-emerald-200 rounded-2xl p-5"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-stone-900 font-medium">
                  {matches[0].activityLabel}
                </p>
                <p className="text-emerald-600 text-sm mt-0.5">
                  Mutual with {matches.map((m) => `@${m.otherHandle}`).join(", ")}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-emerald-100 flex flex-col gap-2">
              {matches.map((match) => (
                <div key={match.otherUserId} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-stone-700 text-sm font-medium">@{match.otherHandle}</span>
                    {match.otherComfortLevel === "group_only" && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full whitespace-nowrap">
                        Groups only
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      onPing({
                        userId: match.otherUserId,
                        handle: match.otherHandle,
                        activities: [{
                          id: match.activityId,
                          label: match.activityLabel,
                          verb: match.activityVerb,
                        }],
                      })
                    }
                    className="px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-medium hover:bg-stone-700 transition-all flex-shrink-0"
                  >
                    Ping
                  </button>
                </div>
              ))}
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
  signalingActivity,
  onMeToo,
  onShowHelp,
}: {
  overlaps: OverlapResult
  mySignals: Set<string>
  signalingActivity: string | null
  onMeToo: (activityId: string) => void
  onShowHelp: () => void
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
          isLoading={signalingActivity === cluster.activityId}
          onMeToo={() => onMeToo(cluster.activityId)}
          onShowHelp={onShowHelp}
        />
      ))}
    </div>
  )
}

function ClusterCard({
  cluster,
  isSignaled,
  isLoading,
  onMeToo,
  onShowHelp,
}: {
  cluster: OverlapCluster
  isSignaled: boolean
  isLoading: boolean
  onMeToo: () => void
  onShowHelp: () => void
}) {
  return (
    <div
      className={cn(
        "bg-white border rounded-2xl p-5 transition-all",
        isSignaled ? "border-emerald-200 bg-emerald-50/30" : "border-stone-200 hover:border-stone-300"
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
          <p className={cn(
            "text-xs mt-2 flex items-center gap-1",
            cluster.activeThisWeek > 0 ? "text-emerald-600" : "text-stone-400"
          )}>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full",
              cluster.activeThisWeek > 0 ? "bg-emerald-500" : "bg-stone-300"
            )} />
            {cluster.activeThisWeek > 0
              ? `${cluster.activeThisWeek} active this week`
              : "No recent activity"}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-stone-100">
        <div className="flex gap-2">
          <button
            onClick={onMeToo}
            disabled={isLoading}
            className={cn(
              "flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-70",
              isSignaled
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                : "bg-stone-900 text-white hover:bg-stone-700"
            )}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                {isSignaled ? "Removing..." : "Signaling..."}
              </>
            ) : isSignaled ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Signaled
              </>
            ) : (
              "Me too"
            )}
          </button>
          <button
            onClick={onShowHelp}
            className="px-3 py-2.5 rounded-xl border border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 transition-all"
            title="How does this work?"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        <p className="text-stone-400 text-xs mt-2 text-center">
          {isSignaled
            ? "Tap to undo. If they also signal, you'll both find out."
            : "Signal interest. They won't know unless they also tap."}
        </p>
      </div>
    </div>
  )
}
