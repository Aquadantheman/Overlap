import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let client: SupabaseClient | null = null

export function createClient() {
  if (client) return client
  client = createSupabaseClient(supabaseUrl, supabaseKey)
  return client
}
