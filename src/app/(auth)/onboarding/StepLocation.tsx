"use client"

import { cn } from "@/lib/utils"
import type { ComfortLevel } from "./OnboardingFlow"

type Props = {
  zipCode: string
  neighborhood: string
  radiusMiles: 1 | 2 | 5 | 10
  comfortLevel: ComfortLevel
  onChange: (patch: {
    zipCode?: string
    neighborhood?: string
    radiusMiles?: 1 | 2 | 5 | 10
    comfortLevel?: ComfortLevel
  }) => void
  onNext: () => void
  onBack: () => void
}

const RADII: { value: 1 | 2 | 5 | 10; label: string }[] = [
  { value: 1, label: "1 mi" },
  { value: 2, label: "2 mi" },
  { value: 5, label: "5 mi" },
  { value: 10, label: "10 mi" },
]

export default function StepLocation({
  zipCode, neighborhood, radiusMiles, comfortLevel, onChange, onNext, onBack
}: Props) {
  const isValid = zipCode.length === 5 && /^\d+$/.test(zipCode) && neighborhood.length >= 2

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium text-stone-900 tracking-tight">
          Where are you?
        </h1>
        <p className="mt-2 text-stone-500 text-sm leading-relaxed">
          We only use your zip code to find nearby overlap. We never store
          your address or track your location.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Zip code
          </label>
          <input
            type="text"
            value={zipCode}
            onChange={(e) => onChange({ zipCode: e.target.value })}
            placeholder="11702"
            maxLength={5}
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Neighborhood or town
          </label>
          <input
            type="text"
            value={neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
            placeholder="Babylon"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all"
          />
          <p className="text-xs text-stone-400">
            This is display only — just so matches feel local and real.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            How far are you willing to go?
          </label>
          <div className="grid grid-cols-4 gap-2">
            {RADII.map((r) => (
              <button
                key={r.value}
                onClick={() => onChange({ radiusMiles: r.value })}
                className={cn(
                  "py-2.5 rounded-xl text-sm font-medium transition-all border",
                  radiusMiles === r.value
                    ? "bg-stone-900 text-white border-stone-900"
                    : "bg-white text-stone-500 border-stone-200 hover:border-stone-400"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Meeting preference
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onChange({ comfortLevel: "open" })}
              className={cn(
                "py-3 px-4 rounded-xl text-sm font-medium transition-all border text-left",
                comfortLevel === "open"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
              )}
            >
              <span className="block">Open</span>
              <span className={cn(
                "block text-xs mt-0.5",
                comfortLevel === "open" ? "text-stone-300" : "text-stone-400"
              )}>
                1-on-1 or groups
              </span>
            </button>
            <button
              onClick={() => onChange({ comfortLevel: "group_only" })}
              className={cn(
                "py-3 px-4 rounded-xl text-sm font-medium transition-all border text-left",
                comfortLevel === "group_only"
                  ? "bg-stone-900 text-white border-stone-900"
                  : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
              )}
            >
              <span className="block">Groups only</span>
              <span className={cn(
                "block text-xs mt-0.5",
                comfortLevel === "group_only" ? "text-stone-300" : "text-stone-400"
              )}>
                3+ people
              </span>
            </button>
          </div>
          <p className="text-xs text-stone-400">
            Visible to others before they ping you. You can change this anytime.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="w-1/3 py-3 rounded-xl font-medium text-sm border border-stone-200 text-stone-500 hover:border-stone-400 transition-all"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className={cn(
            "w-2/3 py-3 rounded-xl font-medium text-sm transition-all",
            isValid
              ? "bg-stone-900 text-white hover:bg-stone-700"
              : "bg-stone-100 text-stone-300 cursor-not-allowed"
          )}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
