import { createBrowserClient } from '@supabase/ssr'

// Using 'any' for Database type to avoid strict typing issues with relational queries
// The actual types are enforced at the application level via TypeScript interfaces
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient() {
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
