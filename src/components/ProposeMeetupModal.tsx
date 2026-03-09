"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { checkMeetupDensity, proposeMeetup, DensityCheck, MeetupType } from "@/lib/meetups/meetups"

type ProposeMeetupModalProps = {
  isOpen: boolean
  onClose: () => void
  userId: string
  connection: {
    id: string
    otherUserId: string
    otherHandle: string
    sharedActivities: { id: string; label: string }[]
  }
  onSuccess?: () => void
}

type TimeOption = "this_week" | "this_weekend" | "next_week" | "flexible"

const TIME_OPTIONS: { value: TimeOption; label: string }[] = [
  { value: "this_week", label: "This week" },
  { value: "this_weekend", label: "This weekend" },
  { value: "next_week", label: "Next week" },
  { value: "flexible", label: "Flexible" },
]

export default function ProposeMeetupModal({
  isOpen,
  onClose,
  userId,
  connection,
  onSuccess,
}: ProposeMeetupModalProps) {
  const [step, setStep] = useState<"activity" | "details">("activity")
  const [selectedActivity, setSelectedActivity] = useState<{ id: string; label: string } | null>(null)
  const [densityCheck, setDensityCheck] = useState<DensityCheck | null>(null)
  const [checkingDensity, setCheckingDensity] = useState(false)
  const [meetupType, setMeetupType] = useState<MeetupType | null>(null)
  const [neighborhood, setNeighborhood] = useState("")
  const [proposedTime, setProposedTime] = useState<TimeOption>("flexible")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep("activity")
      setSelectedActivity(null)
      setDensityCheck(null)
      setMeetupType(null)
      setNeighborhood("")
      setProposedTime("flexible")
      setNote("")
      setError(null)
    }
  }, [isOpen])

  // Check density when activity is selected
  const handleActivitySelect = async (activity: { id: string; label: string }) => {
    setSelectedActivity(activity)
    setCheckingDensity(true)
    setError(null)

    const result = await checkMeetupDensity(userId, connection.otherUserId, activity.id)
    setDensityCheck(result)
    setCheckingDensity(false)

    // Auto-select meetup type if only one option
    if (result.canGroup && !result.canOneOnOne) {
      setMeetupType("group")
    } else if (result.canOneOnOne && !result.canGroup) {
      setMeetupType("one_on_one")
    } else {
      setMeetupType(null)
    }
  }

  const handleContinue = () => {
    if (selectedActivity && (densityCheck?.canGroup || densityCheck?.canOneOnOne) && meetupType) {
      setStep("details")
    }
  }

  const handleSubmit = async () => {
    if (!selectedActivity || !meetupType || !neighborhood.trim()) {
      setError("Please fill in all required fields")
      return
    }

    setSubmitting(true)
    setError(null)

    // Determine who to invite
    const inviteeIds = [connection.otherUserId]

    // For group meetups, we could invite more people from nearbyUsers
    // For now, just invite the connected user - they can expand later
    // In a more advanced version, we'd let the proposer select from densityCheck.nearbyUsers

    const result = await proposeMeetup(
      userId,
      selectedActivity.id,
      meetupType,
      neighborhood.trim(),
      inviteeIds,
      proposedTime,
      note.trim() || undefined
    )

    setSubmitting(false)

    if (result.success) {
      onSuccess?.()
      onClose()
    } else {
      setError(result.error || "Failed to create meetup")
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !submitting && !checkingDensity && onClose()}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-stone-900">
              {step === "activity" ? "Propose a meetup" : "Meetup details"}
            </h2>
            <button
              onClick={onClose}
              className="text-stone-400 hover:text-stone-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {step === "activity" && (
            <>
              <p className="text-sm text-stone-500 mb-4">
                With @{connection.otherHandle}
              </p>

              {/* Activity selection */}
              <div className="space-y-2 mb-6">
                <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                  What activity?
                </label>
                {connection.sharedActivities.map((activity) => (
                  <button
                    key={activity.id}
                    onClick={() => handleActivitySelect(activity)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl text-left transition-all border",
                      selectedActivity?.id === activity.id
                        ? "bg-stone-900 text-white border-stone-900"
                        : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                    )}
                  >
                    {activity.label}
                  </button>
                ))}
              </div>

              {/* Density check results */}
              {checkingDensity && (
                <div className="flex items-center justify-center py-4">
                  <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin" />
                  <span className="ml-2 text-sm text-stone-500">Checking nearby activity...</span>
                </div>
              )}

              {densityCheck && !checkingDensity && (
                <div className="space-y-4">
                  {/* Show density info */}
                  <div className="px-4 py-3 bg-stone-50 rounded-xl">
                    <p className="text-sm text-stone-600">
                      {densityCheck.nearbyCount} {densityCheck.nearbyCount === 1 ? "person" : "people"} nearby share this interest
                    </p>
                  </div>

                  {/* Meetup type selection */}
                  {(densityCheck.canGroup || densityCheck.canOneOnOne) && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                        Meetup type
                      </label>

                      {densityCheck.canGroup && (
                        <button
                          onClick={() => setMeetupType("group")}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl text-left transition-all border",
                            meetupType === "group"
                              ? "bg-stone-900 text-white border-stone-900"
                              : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                          )}
                        >
                          <span className="block font-medium">Group meetup</span>
                          <span className={cn(
                            "block text-xs mt-0.5",
                            meetupType === "group" ? "text-stone-300" : "text-stone-400"
                          )}>
                            3+ people
                          </span>
                        </button>
                      )}

                      {densityCheck.canOneOnOne && (
                        <button
                          onClick={() => setMeetupType("one_on_one")}
                          className={cn(
                            "w-full px-4 py-3 rounded-xl text-left transition-all border",
                            meetupType === "one_on_one"
                              ? "bg-stone-900 text-white border-stone-900"
                              : "bg-white text-stone-700 border-stone-200 hover:border-stone-400"
                          )}
                        >
                          <span className="block font-medium">One-on-one</span>
                          <span className={cn(
                            "block text-xs mt-0.5",
                            meetupType === "one_on_one" ? "text-stone-300" : "text-stone-400"
                          )}>
                            Just you and @{connection.otherHandle}
                          </span>
                        </button>
                      )}

                      {!densityCheck.canGroup && densityCheck.canOneOnOne && (
                        <p className="text-xs text-stone-400 mt-2">
                          Only 2 people nearby share this interest — one-on-one is the way to go
                        </p>
                      )}

                      {/* Explain 1-on-1 unlock requirement */}
                      {densityCheck.canGroup && !densityCheck.canOneOnOne && (
                        <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg">
                          <p className="text-xs text-amber-700">
                            <span className="font-medium">Why no 1-on-1?</span> Complete a group meetup with @{connection.otherHandle} first to unlock 1-on-1 meetups. This helps build trust.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Can't do either */}
                  {!densityCheck.canGroup && !densityCheck.canOneOnOne && densityCheck.reason && (
                    <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-amber-700 text-sm">{densityCheck.reason}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Continue button */}
              <button
                onClick={handleContinue}
                disabled={!selectedActivity || !meetupType || checkingDensity}
                className={cn(
                  "w-full mt-6 py-3 rounded-xl font-medium text-sm transition-all",
                  selectedActivity && meetupType && !checkingDensity
                    ? "bg-stone-900 text-white hover:bg-stone-700"
                    : "bg-stone-100 text-stone-300 cursor-not-allowed"
                )}
              >
                Continue
              </button>
            </>
          )}

          {step === "details" && (
            <>
              <p className="text-sm text-stone-500 mb-4">
                {meetupType === "group" ? "Group" : "One-on-one"} • {selectedActivity?.label}
              </p>

              <div className="space-y-4">
                {/* Neighborhood */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                    Neighborhood / Area
                  </label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="e.g., Downtown, Prospect Park area"
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-stone-400 mt-1">
                    General area only — no specific addresses
                  </p>
                </div>

                {/* Time */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                    When
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {TIME_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setProposedTime(option.value)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-medium transition-all border",
                          proposedTime === option.value
                            ? "bg-stone-900 text-white border-stone-900"
                            : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
                    Note (optional)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any context or ideas..."
                    rows={2}
                    maxLength={200}
                    className="mt-2 w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all resize-none"
                  />
                  <p className="text-xs text-stone-400 mt-1 text-right">
                    {note.length}/200
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep("activity")}
                  className="flex-1 py-3 rounded-xl font-medium text-sm border border-stone-200 text-stone-600 hover:border-stone-400 transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!neighborhood.trim() || submitting}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
                    neighborhood.trim() && !submitting
                      ? "bg-stone-900 text-white hover:bg-stone-700"
                      : "bg-stone-100 text-stone-300 cursor-not-allowed"
                  )}
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                      Proposing...
                    </>
                  ) : (
                    "Propose meetup"
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
