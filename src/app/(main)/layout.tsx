"use client"

import { useEffect, useState, useCallback } from "react"
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
  const [userId, setUserId] = useState<string | null>(null)

  const loadBadgeCounts = useCallback(async (uid: string) => {
    const [pingCount, meetupCount] = await Promise.all([
      getPendingPingCount(uid),
      getPendingMeetupCount(uid),
    ])
    setActivityBadge(pingCount + meetupCount)
  }, [])

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setUserId(user.id)
      loadBadgeCounts(user.id)
    }

    init()
  }, [loadBadgeCounts])

  // Set up real-time subscriptions for badge updates
  useEffect(() => {
    if (!userId) return

    const supabase = createClient()

    // Subscribe to soft_pings changes (new pings received)
    const pingsChannel = supabase
      .channel('badge-pings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'soft_pings',
          filter: `receiver_id=eq.${userId}`,
        },
        () => {
          loadBadgeCounts(userId)
        }
      )
      .subscribe()

    // Subscribe to meetups changes (new invites or status changes)
    const meetupsChannel = supabase
      .channel('badge-meetups')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meetup_invites',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadBadgeCounts(userId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(pingsChannel)
      supabase.removeChannel(meetupsChannel)
    }
  }, [userId, loadBadgeCounts])

  return (
    <>
      <main className="pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
      <BottomNav activityBadge={activityBadge} />
    </>
  )
}
