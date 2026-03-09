"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

type Props = {
  handle: string
  phone: string
  onHandleChange: (val: string) => void
  onPhoneChange: (val: string) => void
  onNext: () => void
}

// Format phone as user types: (XXX) XXX-XXXX
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10)
  if (digits.length === 0) return ""
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  return digits.length === 10
}

export default function StepHandle({ handle, phone, onHandleChange, onPhoneChange, onNext }: Props) {
  const [touchedHandle, setTouchedHandle] = useState(false)
  const [touchedPhone, setTouchedPhone] = useState(false)

  const handleValid = handle.length >= 2 && handle.length <= 24 && /^[a-zA-Z0-9_-]+$/.test(handle)
  const phoneValid = isValidPhone(phone)
  const canContinue = handleValid && phoneValid

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium text-stone-900 tracking-tight">
          Let's get started
        </h1>
        <p className="mt-2 text-stone-500 text-sm leading-relaxed">
          Pick a handle and add your phone. Your phone is never shown to anyone — it just helps us keep out bots.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Handle
          </label>
          <input
            type="text"
            value={handle}
            onChange={(e) => {
              onHandleChange(e.target.value)
              setTouchedHandle(true)
            }}
            placeholder="your handle"
            maxLength={24}
            className={cn(
              "w-full px-4 py-3 rounded-xl border bg-white text-stone-900",
              "placeholder:text-stone-300 outline-none transition-all",
              "focus:ring-2 focus:ring-stone-800 focus:border-transparent",
              touchedHandle && !handleValid
                ? "border-red-300"
                : "border-stone-200"
            )}
          />
          <p className="text-xs text-stone-400">
            2-24 characters. Letters, numbers, _ and - only.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              onPhoneChange(formatPhone(e.target.value))
              setTouchedPhone(true)
            }}
            placeholder="(555) 555-5555"
            className={cn(
              "w-full px-4 py-3 rounded-xl border bg-white text-stone-900",
              "placeholder:text-stone-300 outline-none transition-all",
              "focus:ring-2 focus:ring-stone-800 focus:border-transparent",
              touchedPhone && !phoneValid
                ? "border-red-300"
                : "border-stone-200"
            )}
          />
          <p className="text-xs text-stone-400">
            US numbers only. Never shared, never displayed.
          </p>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canContinue}
        className={cn(
          "w-full py-3 rounded-xl font-medium text-sm transition-all",
          canContinue
            ? "bg-stone-900 text-white hover:bg-stone-700"
            : "bg-stone-100 text-stone-300 cursor-not-allowed"
        )}
      >
        Continue
      </button>
    </div>
  )
}
