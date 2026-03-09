"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import InterestManager from "@/components/InterestManager"
import NetworkGraph from "@/components/NetworkGraph"
import { buildNetworkGraph, NetworkGraph as NetworkGraphData } from "@/lib/graph/networkGraph"

type ComfortLevel = "group_only" | "open"

type Profile = {
  handle: string
  neighborhood: string
  radiusMiles: number
  comfortLevel: ComfortLevel
}

const MIN_RADIUS = 1
const MAX_RADIUS = 15

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [original, setOriginal] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string>("")
  const [showGraph, setShowGraph] = useState(true)
  const [graphData, setGraphData] = useState<NetworkGraphData | null>(null)
  const [graphLoading, setGraphLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = "/signin"
        return
      }

      setUserId(user.id)

      const { data } = await supabase
        .from("profiles")
        .select("handle, neighborhood, radius_miles, comfort_level")
        .eq("id", user.id)
        .single()

      if (!data) {
        window.location.href = "/onboarding"
        return
      }

      const profileData: Profile = {
        handle: data.handle,
        neighborhood: data.neighborhood,
        radiusMiles: data.radius_miles,
        comfortLevel: data.comfort_level as ComfortLevel,
      }

      setProfile(profileData)
      setOriginal(profileData)
      setLoading(false)
    }

    loadProfile()
  }, [])

  // Fetch network graph data when userId is available
  useEffect(() => {
    async function loadGraph() {
      if (!userId) return
      setGraphLoading(true)
      const data = await buildNetworkGraph(userId)
      setGraphData(data)
      setGraphLoading(false)
    }
    loadGraph()
  }, [userId])

  const hasChanges = profile && original && (
    profile.neighborhood !== original.neighborhood ||
    profile.radiusMiles !== original.radiusMiles ||
    profile.comfortLevel !== original.comfortLevel
  )

  const handleSave = async () => {
    if (!profile) return

    setSaving(true)
    setError(null)
    setSaved(false)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError("Session expired. Please sign in again.")
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        neighborhood: profile.neighborhood,
        radius_miles: profile.radiusMiles,
        comfort_level: profile.comfortLevel,
      })
      .eq("id", user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setOriginal(profile)
    setSaved(true)
    setSaving(false)

    setTimeout(() => setSaved(false), 2000)
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/signin"
  }

  const getDistanceLabel = (miles: number) => {
    if (miles <= 2) return "walking distance"
    if (miles <= 5) return "biking distance"
    if (miles <= 10) return "short drive"
    return "across town"
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <p className="text-stone-400 text-sm">@{profile.handle}</p>
          <h1 className="text-2xl font-medium text-stone-900 tracking-tight mt-1">
            Your profile
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            Manage your interests and matching preferences
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {saved && (
          <div className="mb-6 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-emerald-600 text-sm">Settings saved</p>
          </div>
        )}

        <div className="flex flex-col gap-8">
          {/* Interests Section */}
          <section>
            <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-4">
              Your Interests
            </h2>
            {userId && <InterestManager userId={userId} />}
          </section>

          {/* Location & Matching Section */}
          <section>
            <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-4">
              Location & Matching
            </h2>

            <div className="flex flex-col gap-4">
              {/* Neighborhood */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Neighborhood
                </label>
                <input
                  type="text"
                  value={profile.neighborhood}
                  onChange={(e) => setProfile({ ...profile, neighborhood: e.target.value })}
                  className="mt-2 w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all"
                />
              </div>

              {/* Distance */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Search Radius
                </label>
                <div className="mt-4 px-1">
                  <input
                    type="range"
                    min={MIN_RADIUS}
                    max={MAX_RADIUS}
                    value={profile.radiusMiles}
                    onChange={(e) => setProfile({ ...profile, radiusMiles: parseInt(e.target.value) })}
                    className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
                  />
                  <div className="flex justify-between mt-2">
                    <span className="text-xs text-stone-400">{MIN_RADIUS} mi</span>
                    <span className="text-sm font-medium text-stone-900">
                      {profile.radiusMiles} {profile.radiusMiles === 1 ? "mile" : "miles"}
                    </span>
                    <span className="text-xs text-stone-400">{MAX_RADIUS} mi</span>
                  </div>
                </div>
                <p className="text-xs text-stone-400 text-center mt-2">
                  {getDistanceLabel(profile.radiusMiles)}
                </p>
              </div>

              {/* Meeting preference */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  Meeting Preference
                </label>
                <p className="text-xs text-stone-400 mt-1 mb-3">
                  This is shown to others before they ping you
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setProfile({ ...profile, comfortLevel: "open" })}
                    className={cn(
                      "py-3 px-4 rounded-xl text-sm font-medium transition-all border text-left",
                      profile.comfortLevel === "open"
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                    )}
                  >
                    <span className="block">Open</span>
                    <span className={cn(
                      "block text-xs mt-0.5",
                      profile.comfortLevel === "open" ? "text-stone-300" : "text-stone-400"
                    )}>
                      1-on-1 or groups
                    </span>
                  </button>
                  <button
                    onClick={() => setProfile({ ...profile, comfortLevel: "group_only" })}
                    className={cn(
                      "py-3 px-4 rounded-xl text-sm font-medium transition-all border text-left",
                      profile.comfortLevel === "group_only"
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                    )}
                  >
                    <span className="block">Groups only</span>
                    <span className={cn(
                      "block text-xs mt-0.5",
                      profile.comfortLevel === "group_only" ? "text-stone-300" : "text-stone-400"
                    )}>
                      3+ people
                    </span>
                  </button>
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                className={cn(
                  "w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
                  hasChanges && !saving
                    ? "bg-stone-900 text-white hover:bg-stone-700"
                    : "bg-stone-100 text-stone-300 cursor-not-allowed"
                )}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </button>
            </div>
          </section>

          {/* Network Section - only show if there's data */}
          {graphData && graphData.nodes.length > 0 && (
            <section>
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowGraph(!showGraph)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left"
                >
                  <div>
                    <span className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                      Your Network
                    </span>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {graphData.nodes.length} connection{graphData.nodes.length !== 1 ? "s" : ""} across your interests
                    </p>
                  </div>
                  <svg
                    className={cn(
                      "w-4 h-4 text-stone-400 transition-transform",
                      showGraph ? "rotate-180" : ""
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showGraph && (
                  <div className="border-t border-stone-100">
                    <NetworkGraph data={graphData} width={400} height={300} />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Account Section */}
          <section>
            <h2 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-4">
              Account
            </h2>
            <button
              onClick={handleSignOut}
              className="w-full py-3 rounded-xl font-medium text-sm border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-all bg-white"
            >
              Sign out
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
