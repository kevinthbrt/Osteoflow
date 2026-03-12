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

async function supaFetch(path: string, token: string): Promise<{ ok: boolean; data: unknown; status: number }> {
  const url = `${OSTEOUPGRADE_URL}/rest/v1/${path}`
  const res = await fetch(url, {
    headers: {
      apikey: OSTEOUPGRADE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    console.error(`[pathology detail] ${res.status} on ${url}:`, data)
  }
  return { ok: res.ok, data, status: res.status }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const db = await createClient()
    const token = await getToken(db)
    if (!token) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

    const { id } = params

    // 1. Fetch pathology
    const { ok: pathOk, data: pathData } = await supaFetch(
      `pathologies?id=eq.${id}&select=id,name,description,region,clinical_signs,image_url,is_red_flag,red_flag_reason`,
      token
    )
    if (!pathOk || !Array.isArray(pathData) || pathData.length === 0) {
      return NextResponse.json({ error: 'Non trouvé' }, { status: 404 })
    }
    const pathology = pathData[0]

    // 2. Fetch test links
    const { ok: tlOk, data: tlData } = await supaFetch(
      `pathology_tests?pathology_id=eq.${id}&select=test_id,order_index&order=order_index.asc`,
      token
    )
    const testLinks: { test_id: string; order_index: number }[] =
      tlOk && Array.isArray(tlData) ? tlData : []

    let tests: unknown[] = []
    if (testLinks.length > 0) {
      const ids = testLinks.map((l) => l.test_id).join(',')
      const { ok: tOk, data: tData } = await supaFetch(
        `orthopedic_tests?id=in.(${ids})&select=id,name,description,indications,sensitivity,specificity,rv_positive,rv_negative,interest,sources,video_url`,
        token
      )
      if (tOk && Array.isArray(tData)) {
        tests = testLinks
          .map((l) => (tData as { id: string }[]).find((t) => t.id === l.test_id))
          .filter(Boolean)
      }
    }

    // 3. Fetch cluster links
    const { ok: clOk, data: clData } = await supaFetch(
      `pathology_clusters?pathology_id=eq.${id}&select=cluster_id,order_index&order=order_index.asc`,
      token
    )
    const clusterLinks: { cluster_id: string; order_index: number }[] =
      clOk && Array.isArray(clData) ? clData : []

    let clusters: unknown[] = []
    if (clusterLinks.length > 0) {
      const ids = clusterLinks.map((l) => l.cluster_id).join(',')
      const { ok: cOk, data: cData } = await supaFetch(
        `orthopedic_test_clusters?id=in.(${ids})&select=id,name,description,indications,interest,sources,sensitivity,specificity,rv_positive,rv_negative`,
        token
      )
      if (cOk && Array.isArray(cData)) {
        clusters = clusterLinks
          .map((l) => (cData as { id: string }[]).find((c) => c.id === l.cluster_id))
          .filter(Boolean)
      }
    }

    console.log(`[pathology detail] id=${id} tests=${tests.length} clusters=${clusters.length} testLinks=${testLinks.length} clusterLinks=${clusterLinks.length}`)

    return NextResponse.json({ pathology: { ...pathology, tests, clusters } })
  } catch (error) {
    console.error('Pathology detail error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
