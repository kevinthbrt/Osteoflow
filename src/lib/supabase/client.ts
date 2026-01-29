/**
 * Client-side database client for Osteoflow desktop.
 *
 * Previously used @supabase/ssr to create a browser client.
 * Now returns a local SQLite-backed client with Supabase-compatible API.
 *
 * This is used by 'use client' components.
 */

import { createLocalClient } from '@/lib/database/query-builder'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  return createLocalClient()
}
