"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { geocodeZip } from "@/lib/geo/geocode"
import { hashPhone } from "@/lib/utils"
import StepHandle from "./StepHandle"
import StepLocation from "./StepLocation"
import StepInterests from "./StepInterests"

export type Commitment = "casual" | "regular" | "dedicated"
export type Level = "beginner" | "intermediate" | "experienced"
export type ComfortLevel = "group_only" | "open"

export type InterestSelection = {
  activityId: string
  commitment: Commitment
  level: Level | null  // null for activities without has_level
}

export type OnboardingData = {
  handle: string
  phone: string
  zipCode: string
  neighborhood: string
  radiusMiles: number
  comfortLevel: ComfortLevel
  interests: InterestSelection[]
}

const STEPS = ["handle", "location", "interests", "success"] as const
type Step = typeof STEPS[number]

export default function OnboardingFlow() {
  const [step, setStep] = useState<Step>("handle")
  const [data, setData] = useState<OnboardingData>({
    handle: "",
    phone: "",
    zipCode: "",
    neighborhood: "",
    radiusMiles: 5,
    comfortLevel: "open",
    interests: [],
  })
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    // Session is stored in cookies by Supabase - just retrieve it
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }: { data: { user: { id: string } | null } }) => {
      if (data?.user?.id) {
        setUserId(data.user.id)
      } else {
        // No session - redirect to signin
        router.replace("/signin")
      }
    })
  }, [])

  const update = (patch: Partial<OnboardingData>) =>
    setData((prev) => ({ ...prev, ...patch }))

  const mainSteps = ["handle", "location", "interests"] as const
  const stepIndex = mainSteps.indexOf(step as typeof mainSteps[number])
  const progress = step === "success" ? 100 : ((stepIndex + 1) / mainSteps.length) * 100

  const handleComplete = async () => {
    setSaving(true)
    setError(null)

    if (!userId) {
      setError("Session expired. Please sign in again.")
      setSaving(false)
      return
    }

    const supabase = createClient()

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single()

    if (existing) {
      router.replace("/overlap")
      return
    }

    // Geocode the zip code to get coordinates for matching
    const geo = await geocodeZip(data.zipCode)
    if (!geo) {
      setError(`We couldn't locate zip code "${data.zipCode}". Please double-check the number and try again.`)
      setStep("location") // Go back to location step
      setSaving(false)
      return
    }

    // Hash the phone number (simple hash for now - use bcrypt in production)
    const phoneHash = await hashPhone(data.phone)

    const { error: profileError } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        handle: data.handle,
        phone_hash: phoneHash,
        zip_code: data.zipCode,
        neighborhood: data.neighborhood,
        radius_miles: data.radiusMiles,
        comfort_level: data.comfortLevel,
        lat: geo.lat,
        lng: geo.lng,
      })

    if (profileError) {
      if (profileError.code === "23505") {
        setError(`The handle "@${data.handle}" is already taken. Please choose a different one.`)
        setStep("handle") // Go back to handle step
      } else {
        setError(`Something went wrong: ${profileError.message}. Please try again.`)
      }
      setSaving(false)
      return
    }

    const interests = data.interests.map((interest) => ({
      user_id: userId,
      activity_id: interest.activityId,
      commitment: interest.commitment,
      level: interest.level,  // null for activities without has_level
    }))

    const { error: interestsError } = await supabase
      .from("user_interests")
      .insert(interests)

    if (interestsError) {
      setError(`Couldn't save your interests: ${interestsError.message}. Please try again.`)
      setSaving(false)
      return
    }

    // Show success screen briefly before redirecting
    setSaving(false)
    setStep("success")
    setTimeout(() => {
      router.replace("/overlap")
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md mb-12">
        <div className="h-0.5 bg-stone-200 rounded-full">
          <div
            className="h-0.5 bg-stone-800 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="w-full max-w-md">
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {step === "handle" && (
          <StepHandle
            handle={data.handle}
            phone={data.phone}
            onHandleChange={(handle) => update({ handle })}
            onPhoneChange={(phone) => update({ phone })}
            onNext={() => setStep("location")}
          />
        )}
        {step === "location" && (
          <StepLocation
            zipCode={data.zipCode}
            neighborhood={data.neighborhood}
            radiusMiles={data.radiusMiles}
            comfortLevel={data.comfortLevel}
            onChange={(patch) => update(patch)}
            onNext={() => setStep("interests")}
            onBack={() => setStep("handle")}
          />
        )}
        {step === "interests" && (
          <StepInterests
            interests={data.interests}
            onChange={(interests) => update({ interests })}
            onComplete={handleComplete}
            onBack={() => setStep("location")}
            saving={saving}
          />
        )}
        {step === "success" && (
          <div className="flex flex-col items-center text-center py-12">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-medium text-stone-900 tracking-tight">
              You're all set!
            </h1>
            <p className="mt-2 text-stone-500 text-sm leading-relaxed max-w-xs">
              Looking for people who share your interests nearby...
            </p>
            <div className="mt-6 flex items-center gap-2 text-stone-400">
              <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              <span className="text-sm">Finding your overlap</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
