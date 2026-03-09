"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
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

function isValidHandleFormat(handle: string): boolean {
  return handle.length >= 2 && handle.length <= 24 && /^[a-zA-Z0-9_-]+$/.test(handle)
}

export default function StepHandle({ handle, phone, onHandleChange, onPhoneChange, onNext }: Props) {
  // Track blur state (not change) to avoid showing errors while typing
  const [blurredHandle, setBlurredHandle] = useState(false)
  const [blurredPhone, setBlurredPhone] = useState(false)

  // Handle availability check state
  const [checkingHandle, setCheckingHandle] = useState(false)
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null)
  const [lastCheckedHandle, setLastCheckedHandle] = useState("")

  const handleFormatValid = isValidHandleFormat(handle)
  const phoneValid = isValidPhone(phone)

  // Can continue only if handle format is valid, available, and phone is valid
  const canContinue = handleFormatValid && handleAvailable === true && phoneValid

  // Show error only after blur AND when there's some input
  const showHandleFormatError = blurredHandle && handle.length > 0 && !handleFormatValid
  const showHandleTakenError = handleAvailable === false && handle === lastCheckedHandle
  const showPhoneError = blurredPhone && phone.length > 0 && !phoneValid

  // Check handle availability on blur (if format is valid)
  const checkHandleAvailability = async () => {
    setBlurredHandle(true)

    // Skip if format invalid or same as last check
    if (!handleFormatValid || handle === lastCheckedHandle) return

    setCheckingHandle(true)
    setHandleAvailable(null)

    const supabase = createClient()
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("handle", handle.toLowerCase())
      .maybeSingle()

    setCheckingHandle(false)
    setHandleAvailable(data === null) // Available if no match found
    setLastCheckedHandle(handle)
  }

  // Reset availability when handle changes
  useEffect(() => {
    if (handle !== lastCheckedHandle) {
      setHandleAvailable(null)
    }
  }, [handle, lastCheckedHandle])

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium text-stone-900 tracking-tight">
          Let's get started
        </h1>
        <p className="mt-2 text-stone-500 text-sm leading-relaxed">
          Pick a handle and add your phone to get started.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Handle
          </label>
          <div className="relative">
            <input
              type="text"
              value={handle}
              onChange={(e) => onHandleChange(e.target.value)}
              onBlur={checkHandleAvailability}
              placeholder="your handle"
              maxLength={24}
              className={cn(
                "w-full px-4 py-3 rounded-xl border bg-white text-stone-900",
                "placeholder:text-stone-300 outline-none transition-all",
                "focus:ring-2 focus:ring-stone-800 focus:border-transparent",
                "pr-10",
                showHandleFormatError || showHandleTakenError ? "border-red-300" :
                handleAvailable === true ? "border-emerald-300" : "border-stone-200"
              )}
            />
            {/* Status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checkingHandle && (
                <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
              )}
              {!checkingHandle && handleAvailable === true && handleFormatValid && (
                <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {!checkingHandle && handleAvailable === false && (
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          </div>
          {showHandleTakenError ? (
            <p className="text-xs text-red-500">
              This handle is already taken. Try another one.
            </p>
          ) : handleAvailable === true && handleFormatValid ? (
            <p className="text-xs text-emerald-600">
              @{handle} is available!
            </p>
          ) : (
            <p className="text-xs text-stone-400">
              2-24 characters. Letters, numbers, _ and - only.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">
            Phone
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => onPhoneChange(formatPhone(e.target.value))}
            onBlur={() => setBlurredPhone(true)}
            placeholder="(555) 555-5555"
            className={cn(
              "w-full px-4 py-3 rounded-xl border bg-white text-stone-900",
              "placeholder:text-stone-300 outline-none transition-all",
              "focus:ring-2 focus:ring-stone-800 focus:border-transparent",
              showPhoneError ? "border-red-300" : "border-stone-200"
            )}
          />
          <p className="text-xs text-stone-400">
            US numbers only. Your number is hashed and never stored as plain text.
            It's only used to prevent spam — never shared with matches.
          </p>
        </div>
      </div>

      <button
        onClick={onNext}
        disabled={!canContinue || checkingHandle}
        className={cn(
          "w-full py-3 rounded-xl font-medium text-sm transition-all",
          canContinue && !checkingHandle
            ? "bg-stone-900 text-white hover:bg-stone-700"
            : "bg-stone-100 text-stone-300 cursor-not-allowed"
        )}
      >
        Continue
      </button>
    </div>
  )
}
