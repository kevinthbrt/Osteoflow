/**
 * Middleware for Osteoflow desktop.
 *
 * Previously handled Supabase session refresh.
 * Now simplified: checks if a practitioner is selected in the local database.
 * If not, redirects to the login (practitioner selection) page.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/database/auth'

export async function updateSession(request: NextRequest) {
  // Public paths that don't require authentication
  const publicPaths = ['/login', '/api/emails/check-inbox', '/api/emails/follow-up']
  const isPublicPath = publicPaths.some(path => request.nextUrl.pathname.startsWith(path))

  const user = getCurrentUser()

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}
