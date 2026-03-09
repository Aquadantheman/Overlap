"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getPendingPingCount } from "@/lib/pings/softPing"
import { getPendingMeetupCount } from "@/lib/meetups/meetups"
import BottomNav from "@/components/BottomNav"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [activityBadge, setActivityBadge] = useState(0)

  useEffect(() => {
    async function loadBadgeCounts() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      const [pingCount, meetupCount] = await Promise.all([
        getPendingPingCount(user.id),
        getPendingMeetupCount(user.id),
      ])

      setActivityBadge(pingCount + meetupCount)
    }

    loadBadgeCounts()
  }, [])

  return (
    <>
      <main className="pb-20">
        {children}
      </main>
      <BottomNav activityBadge={activityBadge} />
    </>
  )
}
