import { NextResponse } from 'next/server'

/**
 * Auth callback route.
 * In desktop mode, OAuth is not used. This simply redirects to the app.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/patients`)
}
