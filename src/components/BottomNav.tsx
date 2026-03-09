"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"

type NavItem = {
  id: string
  label: string
  href: string
}

const navItems: NavItem[] = [
  { id: "overlap", label: "Overlap", href: "/overlap" },
  { id: "activity", label: "Activity", href: "/activity" },
  { id: "profile", label: "Profile", href: "/profile" },
]

type BottomNavProps = {
  activityBadge?: number
}

export default function BottomNav({ activityBadge = 0 }: BottomNavProps) {
  const pathname = usePathname()

  const getActiveTab = () => {
    if (pathname.startsWith("/overlap")) return "overlap"
    if (pathname.startsWith("/activity") || pathname.startsWith("/connections") || pathname.startsWith("/meetups")) return "activity"
    if (pathname.startsWith("/profile") || pathname.startsWith("/settings") || pathname.startsWith("/network")) return "profile"
    return "overlap"
  }

  const activeTab = getActiveTab()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex h-16">
        {navItems.map((item) => {
          const isActive = activeTab === item.id
          const showBadge = item.id === "activity" && activityBadge > 0

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center py-3 transition-colors",
                isActive
                  ? "text-stone-900"
                  : "text-stone-400 hover:text-stone-600"
              )}
            >
              <div className="relative">
                <NavIcon id={item.id} isActive={isActive} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] bg-emerald-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
                    {activityBadge > 99 ? "99+" : activityBadge}
                  </span>
                )}
              </div>
              <span className={cn(
                "text-xs mt-1",
                isActive ? "font-medium" : "font-normal"
              )}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function NavIcon({ id, isActive }: { id: string; isActive: boolean }) {
  const strokeWidth = isActive ? 2.5 : 2

  switch (id) {
    case "overlap":
      // Venn diagram / overlap icon
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="12" r="5" />
          <circle cx="15" cy="12" r="5" />
        </svg>
      )
    case "activity":
      // Activity / pulse icon
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      )
    case "profile":
      // Person icon
      return (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 1 0-16 0" />
        </svg>
      )
    default:
      return null
  }
}
