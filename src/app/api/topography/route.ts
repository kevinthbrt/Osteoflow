import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = 'https://chttutptqainrnrbrljf.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodHR1dHB0cWFpbnJucmJybGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NjAzNjksImV4cCI6MjA3ODQzNjM2OX0.QzZ_AHBchcjEnQ5LHPEVgeGrc_AiFDOeNKA8h-AT2u0'

export async function GET() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/elearning_topographic_views?select=region,name,image_url,description&is_active=eq.true&order=display_order.asc`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(10000),
      }
    )
    const data = await res.json()
    if (!Array.isArray(data)) {
      return NextResponse.json({ views: [], error: 'invalid_response' })
    }
    return NextResponse.json({ views: data })
  } catch {
    return NextResponse.json({ views: [], error: 'fetch_failed' })
  }
}
