/**
 * Fetches full pathology details (description, tests, clusters) from Osteoupgrade.
 * GET /api/osteoupgrade/pathology/[id]
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

const OSTEOUPGRADE_URL = 'https://chttutptqainrnrbrljf.supabase.co'
const OSTEOUPGRADE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodHR1dHB0cWFpbnJucmJybGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NjAzNjksImV4cCI6MjA3ODQzNjM2OX0.QzZ_AHBchcjEnQ5LHPEVgeGrc_AiFDOeNKA8h-AT2u0'

async function getToken(db: Awaited<ReturnType<typeof import('@/lib/db/server').createClient>>): Promise<string | null> {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null
  const { data: p } = await db
    .from('practitioners')
    .select('osteoupgrade_token, osteoupgrade_token_expires_at')
    .eq('user_id', user.id)
    .single()
  if (!p?.osteoupgrade_token) return null
  if (p.osteoupgrade_token_expires_at) {
    const exp = new Date(p.osteoupgrade_token_expires_at).getTime()
    if (exp < Date.now() + 5 * 60 * 1000) return null
  }
  return p.osteoupgrade_token
}

async function supaFetch(path: string, token: string) {
  const res = await fetch(`${OSTEOUPGRADE_URL}/rest/v1/${path}`, {
    headers: { apikey: OSTEOUPGRADE_ANON_KEY, Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const db = await createClient()
    const token = await getToken(db)
    if (!token) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

    const { id } = params

    // 1. Fetch pathology
    const pathologies = await supaFetch(
      `pathologies?id=eq.${id}&select=id,name,description,region,clinical_signs,image_url,is_red_flag,red_flag_reason`,
      token
    )
    const pathology = pathologies?.[0]
    if (!pathology) return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })

    // 2. Fetch test links ordered
    const testLinks: { test_id: string; order_index: number }[] =
      (await supaFetch(`pathology_tests?pathology_id=eq.${id}&select=test_id,order_index&order=order_index.asc`, token)) ?? []

    let tests: unknown[] = []
    if (testLinks.length > 0) {
      const ids = testLinks.map((l) => l.test_id).join(',')
      const raw = await supaFetch(
        `orthopedic_tests?id=in.(${ids})&select=id,name,description,indications,sensitivity,specificity,rv_positive,rv_negative,interest,sources,video_url`,
        token
      )
      if (Array.isArray(raw)) {
        // Preserve order from pathology_tests
        tests = testLinks
          .map((l) => raw.find((t: { id: string }) => t.id === l.test_id))
          .filter(Boolean)
      }
    }

    // 3. Fetch cluster links ordered
    const clusterLinks: { cluster_id: string; order_index: number }[] =
      (await supaFetch(`pathology_clusters?pathology_id=eq.${id}&select=cluster_id,order_index&order=order_index.asc`, token)) ?? []

    let clusters: unknown[] = []
    if (clusterLinks.length > 0) {
      const ids = clusterLinks.map((l) => l.cluster_id).join(',')
      const raw = await supaFetch(
        `orthopedic_test_clusters?id=in.(${ids})&select=id,name,description,indications,interest,sources,sensitivity,specificity,rv_positive,rv_negative`,
        token
      )
      if (Array.isArray(raw)) {
        clusters = clusterLinks
          .map((l) => raw.find((c: { id: string }) => c.id === l.cluster_id))
          .filter(Boolean)
      }
    }

    return NextResponse.json({ pathology: { ...pathology, tests, clusters } })
  } catch (error) {
    console.error('Pathology detail error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
