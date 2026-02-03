/**
 * Client-side database client for Osteoflow desktop.
 *
 * Returns a browser-safe client that proxies database operations
 * through API routes (/api/db, /api/auth/*).
 *
 * This is used by 'use client' components which cannot import Node.js modules.
 */

import { createBrowserClient } from '@/lib/database/client-query-builder'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): any {
  return createBrowserClient()
}
