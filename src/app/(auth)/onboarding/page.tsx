import { Suspense } from "react"
import OnboardingFlow from "./OnboardingFlow"

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50" />}>
      <OnboardingFlow />
    </Suspense>
  )
}
