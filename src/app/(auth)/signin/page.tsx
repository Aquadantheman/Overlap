"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type Mode = "signin" | "signup"

export default function SignInPage() {
  const [mode, setMode] = useState<Mode>("signin")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()

    if (mode === "signup") {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      // Session is automatically stored in cookies by Supabase
      window.location.href = "/onboarding"
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setLoading(false); return }
      window.location.href = "/overlap"
    }
  }

  const isValid = email.includes("@") && password.length >= 8

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-medium text-stone-900 tracking-tight">overlap</h1>
          <p className="mt-2 text-stone-500 text-sm leading-relaxed">
            {mode === "signup"
              ? "Find the people already living near you who do what you do."
              : "Welcome back."}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-stone-500 uppercase tracking-wide">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              onKeyDown={(e) => e.key === "Enter" && isValid && handleSubmit()}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-300 outline-none focus:ring-2 focus:ring-stone-800 focus:border-transparent transition-all"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!isValid || loading}
            className={cn(
              "w-full py-3 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
              isValid && !loading
                ? "bg-stone-900 text-white hover:bg-stone-700"
                : "bg-stone-100 text-stone-300 cursor-not-allowed"
            )}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-600 rounded-full animate-spin" />
                {mode === "signup" ? "Creating account..." : "Signing in..."}
              </>
            ) : (
              mode === "signup" ? "Create account" : "Sign in"
            )}
          </button>
        </div>

        <p className="text-center text-sm text-stone-400">
          {mode === "signup" ? "Already have an account?" : "New here?"}{" "}
          <button
            onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null) }}
            className="text-stone-700 underline underline-offset-2"
          >
            {mode === "signup" ? "Sign in" : "Create account"}
          </button>
        </p>

        {mode === "signup" && (
          <p className="text-center text-xs text-stone-300 leading-relaxed">
            No real name required. No ads. No data sold. Ever.
          </p>
        )}
      </div>
    </div>
  )
}
