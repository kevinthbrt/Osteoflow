import { createBrowserClient } from '@supabase/ssr'

// Using 'any' for Database type to avoid strict typing issues with relational queries
// The actual types are enforced at the application level via TypeScript interfaces
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Return a dummy client during build time if env vars are not set
  if (!supabaseUrl || !supabaseKey) {
    // This should only happen during static build
    return createBrowserClient<any>(
      'https://placeholder.supabase.co',
      'placeholder-key'
    )
  }

  return createBrowserClient<any>(supabaseUrl, supabaseKey)
}
