"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { geocodeZip } from "@/lib/geo/geocode"
import { hashPhone } from "@/lib/utils"
import StepHandle from "./StepHandle"
import StepLocation from "./StepLocation"
import StepInterests from "./StepInterests"

export type Frequency = "yearly" | "monthly" | "weekly"
export type Level = "beginner" | "casual" | "experienced"
export type ComfortLevel = "group_only" | "open"

export type InterestSelection = {
  activityId: string
  frequency: Frequency
  level: Level
}

export type OnboardingData = {
  handle: string
  phone: string
  zipCode: string
  neighborhood: string
  radiusMiles: 1 | 2 | 5 | 10
  comfortLevel: ComfortLevel
  interests: InterestSelection[]
}

const STEPS = ["handle", "location", "interests"] as const
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
    supabase.auth.getUser().then(({ data }) => {
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

  const stepIndex = STEPS.indexOf(step)
  const progress = ((stepIndex + 1) / STEPS.length) * 100

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
      setError("Could not find that zip code. Please check and try again.")
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
        setError("That handle is already taken. Try another.")
      } else {
        setError(profileError.message)
      }
      setSaving(false)
      return
    }

    const interests = data.interests.map((interest) => ({
      user_id: userId,
      activity_id: interest.activityId,
      frequency: interest.frequency,
      level: interest.level,
    }))

    const { error: interestsError } = await supabase
      .from("user_interests")
      .insert(interests)

    if (interestsError) {
      setError(interestsError.message)
      setSaving(false)
      return
    }

    router.replace("/overlap")
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
      </div>
    </div>
  )
}
