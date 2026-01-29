/**
 * Server-side database client for Osteoflow desktop.
 *
 * Previously used @supabase/ssr to create a server client with cookie handling.
 * Now returns a local SQLite-backed client with Supabase-compatible API.
 *
 * This is used by Server Components and API routes.
 */

import { createLocalClient } from '@/lib/database/query-builder'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClient(): Promise<any> {
  return createLocalClient()
}

/**
 * Service client with elevated privileges.
 * In desktop mode, this is identical to createClient() since there's no RLS.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createServiceClient(): Promise<any> {
  return createLocalClient()
}
