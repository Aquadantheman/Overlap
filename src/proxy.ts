import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: must call getUser() to refresh session cookies
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Logged in users don't need to be on signin
  if (user && pathname === "/signin") {
    return NextResponse.redirect(new URL("/overlap", request.url))
  }

  // Protected routes
  const protectedPaths = ["/overlap", "/connections", "/settings"]
  if (!user && protectedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/signin", request.url))
  }

  // IMPORTANT: return supabaseResponse not NextResponse.next()
  // so cookies get properly set on the response
  return supabaseResponse
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|_next/data).*)"],
}
