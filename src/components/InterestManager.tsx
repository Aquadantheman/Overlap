"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Frequency = "yearly" | "monthly" | "weekly"
type Level = "beginner" | "casual" | "experienced"

type UserInterest = {
  activityId: string
  label: string
  verb: string
  frequency: Frequency
  level: Level
  isActive: boolean
  lastEngagedAt: string
}

type Activity = {
  id: string
  label: string
  verb: string
  category: string
}

const MAX_INTERESTS = 7

const FREQUENCY_LABELS: Record<Frequency, string> = {
  yearly: "A few times a year",
  monthly: "Monthly",
  weekly: "Weekly",
}

const LEVEL_LABELS: Record<Level, string> = {
  beginner: "Beginner",
  casual: "Casual",
  experienced: "Experienced",
}

type Props = {
  userId: string
  onSaved?: () => void
}

export default function InterestManager({ userId, onSaved }: Props) {
  const [interests, setInterests] = useState<UserInterest[]>([])
  const [allActivities, setAllActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For editing an interest
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFrequency, setEditFrequency] = useState<Frequency>("monthly")
  const [editLevel, setEditLevel] = useState<Level>("casual")

  // For adding/swapping
  const [showAddModal, setShowAddModal] = useState(false)
  const [swappingId, setSwappingId] = useState<string | null>(null)
  const [selectedNewActivity, setSelectedNewActivity] = useState<Activity | null>(null)
  const [newFrequency, setNewFrequency] = useState<Frequency>("monthly")
  const [newLevel, setNewLevel] = useState<Level>("casual")

  useEffect(() => {
    loadData()
  }, [userId])

  const loadData = async () => {
    const supabase = createClient()

    // Load user's interests
    const { data: userInterests } = await supabase
      .from("user_interests")
      .select(`
        activity_id,
        frequency,
        level,
        is_active,
        last_engaged_at,
        activity:activities(id, label, verb)
      `)
      .eq("user_id", userId)

    // Load all activities for add/swap
    const { data: activities } = await supabase
      .from("activities")
      .select("id, label, verb, category")
      .eq("status", "active")
      .order("label")

    if (userInterests) {
      type UserInterestRow = {
        activity_id: string
        activity: { label: string; verb: string } | null
        frequency: string | null
        level: string | null
        is_active: boolean | null
        last_engaged_at: string | null
      }
      const mapped: UserInterest[] = userInterests.map((ui: UserInterestRow) => ({
        activityId: ui.activity_id,
        label: ui.activity?.label || "",
        verb: ui.activity?.verb || "",
        frequency: ui.frequency as Frequency,
        level: ui.level as Level,
        isActive: ui.is_active ?? true,
        lastEngagedAt: ui.last_engaged_at,
      }))
      setInterests(mapped)
    }

    if (activities) {
      setAllActivities(activities)
    }

    setLoading(false)
  }

  const toggleActive = async (activityId: string) => {
    const interest = interests.find((i) => i.activityId === activityId)
    if (!interest) return

    const newIsActive = !interest.isActive

    // Optimistic update
    setInterests((prev) =>
      prev.map((i) =>
        i.activityId === activityId ? { ...i, isActive: newIsActive } : i
      )
    )

    const supabase = createClient()
    const { error } = await supabase
      .from("user_interests")
      .update({ is_active: newIsActive })
      .eq("user_id", userId)
      .eq("activity_id", activityId)

    if (error) {
      // Revert on error
      setInterests((prev) =>
        prev.map((i) =>
          i.activityId === activityId ? { ...i, isActive: !newIsActive } : i
        )
      )
      setError(error.message)
    }
  }

  const startEdit = (interest: UserInterest) => {
    setEditingId(interest.activityId)
    setEditFrequency(interest.frequency)
    setEditLevel(interest.level)
  }

  const saveEdit = async () => {
    if (!editingId) return

    setSaving(true)

    const supabase = createClient()
    const { error } = await supabase
      .from("user_interests")
      .update({
        frequency: editFrequency,
        level: editLevel,
      })
      .eq("user_id", userId)
      .eq("activity_id", editingId)

    if (error) {
      setError(error.message)
    } else {
      setInterests((prev) =>
        prev.map((i) =>
          i.activityId === editingId
            ? { ...i, frequency: editFrequency, level: editLevel }
            : i
        )
      )
      setEditingId(null)
      onSaved?.()
    }

    setSaving(false)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const openSwapModal = (activityId: string) => {
    setSwappingId(activityId)
    setSelectedNewActivity(null)
    setNewFrequency("monthly")
    setNewLevel("casual")
    setShowAddModal(true)
  }

  const openAddModal = () => {
    setSwappingId(null)
    setSelectedNewActivity(null)
    setNewFrequency("monthly")
    setNewLevel("casual")
    setShowAddModal(true)
  }

  const closeAddModal = () => {
    setShowAddModal(false)
    setSwappingId(null)
    setSelectedNewActivity(null)
  }

  const confirmAddOrSwap = async () => {
    if (!selectedNewActivity) return

    setSaving(true)
    const supabase = createClient()

    if (swappingId) {
      // Remove old interest
      await supabase
        .from("user_interests")
        .delete()
        .eq("user_id", userId)
        .eq("activity_id", swappingId)
    }

    // Add new interest
    const { error } = await supabase.from("user_interests").insert({
      user_id: userId,
      activity_id: selectedNewActivity.id,
      frequency: newFrequency,
      level: newLevel,
      is_active: true,
      last_engaged_at: new Date().toISOString(),
    })

    if (error) {
      setError(error.message)
    } else {
      await loadData()
      closeAddModal()
      onSaved?.()
    }

    setSaving(false)
  }

  // Activities not already selected
  const availableActivities = allActivities.filter(
    (a) => !interests.some((i) => i.activityId === a.id)
  )

  const activeCount = interests.filter((i) => i.isActive).length
  const quietCount = interests.filter((i) => !i.isActive).length

  if (loading) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-stone-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
              Your interests
            </label>
            <p className="text-xs text-stone-400 mt-1">
              {activeCount} active{quietCount > 0 && `, ${quietCount} quiet`}
            </p>
          </div>
          {interests.length < MAX_INTERESTS && (
            <button
              onClick={openAddModal}
              className="px-3 py-1.5 bg-stone-100 text-stone-600 rounded-lg text-xs font-medium hover:bg-stone-200 transition-all"
            >
              + Add
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-xs">{error}</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {interests.map((interest) => (
            <div
              key={interest.activityId}
              className={cn(
                "border rounded-xl p-4 transition-all",
                interest.isActive
                  ? "border-stone-200 bg-white"
                  : "border-stone-100 bg-stone-50"
              )}
            >
              {editingId === interest.activityId ? (
                // Edit mode
                <div className="flex flex-col gap-3">
                  <p className="font-medium text-stone-900">{interest.verb}</p>

                  <div>
                    <p className="text-xs text-stone-500 mb-2">How often?</p>
                    <div className="flex gap-2">
                      {(["yearly", "monthly", "weekly"] as Frequency[]).map((f) => (
                        <button
                          key={f}
                          onClick={() => setEditFrequency(f)}
                          className={cn(
                            "flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all border",
                            editFrequency === f
                              ? "bg-stone-900 text-white border-stone-900"
                              : "bg-white text-stone-600 border-stone-200"
                          )}
                        >
                          {FREQUENCY_LABELS[f]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-stone-500 mb-2">Level</p>
                    <div className="flex gap-2">
                      {(["beginner", "casual", "experienced"] as Level[]).map((l) => (
                        <button
                          key={l}
                          onClick={() => setEditLevel(l)}
                          className={cn(
                            "flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all border",
                            editLevel === l
                              ? "bg-stone-900 text-white border-stone-900"
                              : "bg-white text-stone-600 border-stone-200"
                          )}
                        >
                          {LEVEL_LABELS[l]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={cancelEdit}
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg text-xs font-medium border border-stone-200 text-stone-500"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={saving}
                      className="flex-1 py-2 rounded-lg text-xs font-medium bg-stone-900 text-white"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              ) : (
                // View mode
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-medium",
                        interest.isActive ? "text-stone-900" : "text-stone-400"
                      )}
                    >
                      {interest.verb}
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      {FREQUENCY_LABELS[interest.frequency]} · {LEVEL_LABELS[interest.level]}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleActive(interest.activityId)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-medium transition-all",
                        interest.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-stone-100 text-stone-400"
                      )}
                    >
                      {interest.isActive ? "Active" : "Quiet"}
                    </button>

                    <button
                      onClick={() => startEdit(interest)}
                      className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => openSwapModal(interest.activityId)}
                      className="p-1.5 text-stone-400 hover:text-stone-600 transition-colors"
                      title="Replace"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17 1l4 4-4 4" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <path d="M7 23l-4-4 4-4" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {interests.length === 0 && (
            <p className="text-stone-400 text-sm text-center py-4">
              No interests yet
            </p>
          )}
        </div>
      </div>

      {/* Add/Swap Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-medium text-stone-900">
              {swappingId ? "Replace interest" : "Add interest"}
            </h2>
            <p className="mt-1 text-stone-500 text-sm">
              {swappingId
                ? "Choose something to replace it with"
                : `${MAX_INTERESTS - interests.length} slot${MAX_INTERESTS - interests.length === 1 ? "" : "s"} remaining`}
            </p>

            {selectedNewActivity ? (
              // Configure the new interest
              <div className="mt-6 flex flex-col gap-4">
                <div className="p-3 bg-stone-50 rounded-xl">
                  <p className="font-medium text-stone-900">{selectedNewActivity.verb}</p>
                  <p className="text-xs text-stone-500">{selectedNewActivity.label}</p>
                </div>

                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                    How often?
                  </p>
                  <div className="flex gap-2">
                    {(["yearly", "monthly", "weekly"] as Frequency[]).map((f) => (
                      <button
                        key={f}
                        onClick={() => setNewFrequency(f)}
                        className={cn(
                          "flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all border",
                          newFrequency === f
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-white text-stone-600 border-stone-200"
                        )}
                      >
                        {FREQUENCY_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                    Experience level
                  </p>
                  <div className="flex gap-2">
                    {(["beginner", "casual", "experienced"] as Level[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setNewLevel(l)}
                        className={cn(
                          "flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all border",
                          newLevel === l
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-white text-stone-600 border-stone-200"
                        )}
                      >
                        {LEVEL_LABELS[l]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={() => setSelectedNewActivity(null)}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500"
                  >
                    Back
                  </button>
                  <button
                    onClick={confirmAddOrSwap}
                    disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-stone-900 text-white"
                  >
                    {saving ? "Saving..." : swappingId ? "Replace" : "Add"}
                  </button>
                </div>
              </div>
            ) : (
              // Pick an activity
              <div className="mt-4 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-2">
                  {availableActivities.map((activity) => (
                    <button
                      key={activity.id}
                      onClick={() => setSelectedNewActivity(activity)}
                      className="text-left px-4 py-3 rounded-xl border border-stone-200 hover:border-stone-400 transition-all"
                    >
                      <p className="font-medium text-stone-900 text-sm">{activity.verb}</p>
                      <p className="text-xs text-stone-400">{activity.label}</p>
                    </button>
                  ))}

                  {availableActivities.length === 0 && (
                    <p className="text-stone-400 text-sm text-center py-8">
                      No more activities available
                    </p>
                  )}
                </div>
              </div>
            )}

            {!selectedNewActivity && (
              <button
                onClick={closeAddModal}
                className="mt-4 w-full py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
