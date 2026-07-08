import { NextResponse } from 'next/server'

/**
 * Server-side guard for sensitive local API routes (/api/db, uploads,
 * database backup/restore). The embedded HTTP server listens on 127.0.0.1,
 * which is reachable by any other local process — or, via a plain fetch(),
 * by a malicious webpage the user has open in a browser while MyOsteoFlow
 * is running. This checks a per-launch token (electron/main.ts) that only
 * this app's own renderer knows, obtained over Electron IPC and never
 * exposed to web content.
 *
 * Disabled outside production (`npm run dev`), where the Next.js dev server
 * runs as a separate process from Electron and never receives the token —
 * that's fine, the dev loop only ever runs on the developer's own machine.
 */
export function checkLocalApiToken(request: Request): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null

  const expected = process.env.LOCAL_API_TOKEN
  const provided = request.headers.get('x-local-api-token')

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
