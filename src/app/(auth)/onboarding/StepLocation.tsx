"use client"

import { cn } from "@/lib/utils"
import type { ComfortLevel } from "./OnboardingFlow"

type Props = {
  zipCode: string
  neighborhood: string
  radiusMiles: number
  comfortLevel: ComfortLevel
  onChange: (patch: {
    zipCode?: string
    neighborhood?: string
    radiusMiles?: number
    comfortLevel?: ComfortLevel
  }) => void
  onNext: () => void
  onBack: () => void
}

// Min/max for the slider
const MIN_RADIUS = 1
const MAX_RADIUS = 15

export default function StepLocation({
  zipCode, neighborhood, radiusMiles, comfortLevel, onChange, onNext, onBack
}: Props) {
  const isValid = zipCode.length === 5 && /^\d+$/.test(zipCode) && neighborhood.length >= 2

  // Format the label based on distance
  const getDistanceLabel = (miles: number) => {
    if (miles <= 2) return "walking distance"
    if (miles <= 5) return "biking distance"
    if (miles <= 10) return "short drive"
    return "across town"
  }

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

        <div className="flex flex-col gap-3">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            How far are you willing to go?
          </label>
          <div className="px-1">
            <input
              type="range"
              min={MIN_RADIUS}
              max={MAX_RADIUS}
              value={radiusMiles}
              onChange={(e) => onChange({ radiusMiles: parseInt(e.target.value) })}
              className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-900"
            />
            <div className="flex justify-between mt-2">
              <span className="text-xs text-stone-400">{MIN_RADIUS} mi</span>
              <span className="text-sm font-medium text-stone-900">
                {radiusMiles} {radiusMiles === 1 ? "mile" : "miles"}
              </span>
              <span className="text-xs text-stone-400">{MAX_RADIUS} mi</span>
            </div>
          </div>
          <p className="text-xs text-stone-400 text-center">
            {getDistanceLabel(radiusMiles)}
          </p>
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
