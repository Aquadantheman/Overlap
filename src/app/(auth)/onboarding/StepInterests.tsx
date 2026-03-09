"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import type { InterestSelection, Frequency, Level } from "./OnboardingFlow"

type Activity = {
  id: string
  label: string
  verb: string
  category: string
  parent_id: string | null
  tier: number
}

type Props = {
  interests: InterestSelection[]
  onChange: (interests: InterestSelection[]) => void
  onComplete: () => void
  onBack: () => void
  saving?: boolean
}

const MAX_ACTIVITIES = 7

const CATEGORY_LABELS: Record<string, string> = {
  nature: "Nature",
  making: "Making",
  movement: "Movement",
  food: "Food",
  music: "Music",
  learning: "Learning",
  games: "Games",
  community: "Community",
  arts: "Arts",
  technology: "Technology",
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "yearly", label: "A few times a year" },
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
]

const LEVEL_OPTIONS: { value: Level; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "casual", label: "Casual" },
  { value: "experienced", label: "Experienced" },
]

export default function StepInterests({
  interests, onChange, onComplete, onBack, saving
}: Props) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // For the detail modal
  const [pendingActivity, setPendingActivity] = useState<Activity | null>(null)
  const [pendingFrequency, setPendingFrequency] = useState<Frequency>("monthly")
  const [pendingLevel, setPendingLevel] = useState<Level>("casual")

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from("activities")
      .select("id, label, verb, category, parent_id, tier")
      .eq("status", "active")
      .order("tier")
      .order("label")
      .then(({ data, error }: { data: Activity[] | null; error: { message: string } | null }) => {
        if (error) setError(error.message)
        if (data) setActivities(data)
        setLoading(false)
      })
  }, [])

  const selectedIds = interests.map((i) => i.activityId)
  const isSelected = (id: string) => selectedIds.includes(id)
  const atMax = interests.length >= MAX_ACTIVITIES
  const canContinue = interests.length >= 1

  const handleActivityClick = (activity: Activity) => {
    if (isSelected(activity.id)) {
      // Remove it
      onChange(interests.filter((i) => i.activityId !== activity.id))
    } else if (!atMax) {
      // Show the detail modal
      setPendingActivity(activity)
      setPendingFrequency("monthly")
      setPendingLevel("casual")
    }
  }

  const confirmSelection = () => {
    if (!pendingActivity) return
    onChange([
      ...interests,
      {
        activityId: pendingActivity.id,
        frequency: pendingFrequency,
        level: pendingLevel,
      },
    ])
    setPendingActivity(null)
  }

  const cancelSelection = () => {
    setPendingActivity(null)
  }

  const tier1 = activities.filter((a) => a.tier === 1)
  const categories = [...new Set(tier1.map((a) => a.category))]
  const getChildren = (parentId: string) =>
    activities.filter((a) => a.parent_id === parentId)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-red-500 text-sm">Failed to load activities: {error}</p>
        <button onClick={onBack} className="text-stone-500 text-sm underline">Go back</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium text-stone-900 tracking-tight">
          What do you actually do?
        </h1>
        <p className="mt-2 text-stone-500 text-sm leading-relaxed">
          Pick everything that feels true. These are the only signals anyone
          will use to find you.
        </p>
        {interests.length > 0 && (
          <p className={cn("mt-2 text-xs", atMax ? "text-amber-600" : "text-stone-400")}>
            {interests.length} / {MAX_ACTIVITIES} selected
            {atMax && " (max reached)"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
        {categories.map((category) => (
          <div key={category} className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-stone-400 uppercase tracking-wide px-1">
              {CATEGORY_LABELS[category] || category}
            </p>
            {tier1
              .filter((a) => a.category === category)
              .map((activity) => {
                const children = getChildren(activity.id)
                const isOpen = expanded === activity.id
                return (
                  <div key={activity.id}>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleActivityClick(activity)}
                        disabled={atMax && !isSelected(activity.id)}
                        className={cn(
                          "flex-1 text-left px-4 py-2.5 rounded-xl text-sm transition-all border",
                          isSelected(activity.id)
                            ? "bg-stone-900 text-white border-stone-900"
                            : atMax
                              ? "bg-stone-50 text-stone-300 border-stone-100 cursor-not-allowed"
                              : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                        )}
                      >
                        {activity.verb}
                      </button>
                      {children.length > 0 && (
                        <button
                          onClick={() => setExpanded(isOpen ? null : activity.id)}
                          className={cn(
                            "px-3 rounded-xl border text-stone-400 text-xs transition-all",
                            isOpen
                              ? "border-stone-400 text-stone-600"
                              : "border-stone-200 hover:border-stone-400"
                          )}
                        >
                          {isOpen ? "^" : "v"}
                        </button>
                      )}
                    </div>
                    {isOpen && children.length > 0 && (
                      <div className="ml-4 mt-1.5 flex flex-col gap-1.5">
                        {children.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => handleActivityClick(child)}
                            disabled={atMax && !isSelected(child.id)}
                            className={cn(
                              "text-left px-4 py-2 rounded-xl text-sm transition-all border",
                              isSelected(child.id)
                                ? "bg-stone-700 text-white border-stone-700"
                                : atMax
                                  ? "bg-stone-50 text-stone-300 border-stone-100 cursor-not-allowed"
                                  : "bg-stone-50 text-stone-600 border-stone-200 hover:border-stone-400"
                            )}
                          >
                            {child.verb}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={saving}
          className="w-1/3 py-3 rounded-xl font-medium text-sm border border-stone-200 text-stone-500 hover:border-stone-400 transition-all disabled:opacity-50"
        >
          Back
        </button>
        <button
          onClick={onComplete}
          disabled={!canContinue || saving}
          className={cn(
            "w-2/3 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
            canContinue && !saving
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
            "Find my overlap"
          )}
        </button>
      </div>

      {/* Detail Modal */}
      {pendingActivity && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h2 className="text-lg font-medium text-stone-900">
              {pendingActivity.verb}
            </h2>
            <p className="mt-1 text-stone-500 text-sm">
              {pendingActivity.label}
            </p>

            <div className="mt-6 flex flex-col gap-4">
              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                  How often?
                </p>
                <div className="flex gap-2">
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPendingFrequency(opt.value)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all border",
                        pendingFrequency === opt.value
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
                  Experience level
                </p>
                <div className="flex gap-2">
                  {LEVEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPendingLevel(opt.value)}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all border",
                        pendingLevel === opt.value
                          ? "bg-stone-900 text-white border-stone-900"
                          : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={cancelSelection}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-stone-200 text-stone-500 hover:border-stone-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmSelection}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-stone-900 text-white hover:bg-stone-700 transition-all"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
