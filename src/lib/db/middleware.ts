/**
 * Middleware for Osteoflow desktop.
 *
 * Auth is enforced by the dashboard layout (server component) which checks
 * the local SQLite database directly. The middleware is a simple pass-through
 * because Next.js middleware runs in Edge Runtime which does not support
 * Node.js modules (fs, path, better-sqlite3).
 */

import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request })
}
