/**
 * Fetches diagnostic suggestions (pathologies + tests) from Osteoupgrade's Supabase
 * based on one or more anatomical regions.
 *
 * GET /api/osteoupgrade/diagnostics?regions=epaule,genou
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/db/server'

const OSTEOUPGRADE_URL = 'https://chttutptqainrnrbrljf.supabase.co'
const OSTEOUPGRADE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNodHR1dHB0cWFpbnJucmJybGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NjAzNjksImV4cCI6MjA3ODQzNjM2OX0.QzZ_AHBchcjEnQ5LHPEVgeGrc_AiFDOeNKA8h-AT2u0'

interface OsteoupgradePathology {
  id: string
  name: string
  description: string | null
  region: string
  clinical_signs: string | null
  image_url: string | null
  is_red_flag: boolean | null
  red_flag_reason: string | null
}

interface OsteoupgradeTest {
  id: string
  name: string
  description: string
  sensitivity: number | null
  specificity: number | null
}

interface OsteoupgradeTopography {
  id: string
  name: string
  region: string
  image_url: string | null
  description: string | null
}

async function getOsteoupgradeToken(db: Awaited<ReturnType<typeof import('@/lib/db/server').createClient>>): Promise<string | null> {
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  const { data: practitioner } = await db
    .from('practitioners')
    .select('osteoupgrade_token, osteoupgrade_token_expires_at')
    .eq('user_id', user.id)
    .single()

  if (!practitioner?.osteoupgrade_token) return null

  // Check expiry
  if (practitioner.osteoupgrade_token_expires_at) {
    const expiresAt = new Date(practitioner.osteoupgrade_token_expires_at).getTime()
    if (expiresAt < Date.now() + 5 * 60 * 1000) return null
  }

  return practitioner.osteoupgrade_token
}

function normalizeRegion(region: string): string {
  let normalized = region.toLowerCase().trim()
  const mapping: Record<string, string> = {
    'sacroiliaque': 'sacro-iliaque',
    'cotes': 'cotes',
    'crane': 'crane',
    'atm': 'atm',
  }
  if (mapping[normalized]) return mapping[normalized]
  if (normalized.includes('_')) {
    normalized = normalized.split('_')[0]
  }
  if (normalized.endsWith('s') && !normalized.includes('-')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const regionsParam = searchParams.get('regions')

    if (!regionsParam) {
      return NextResponse.json({ error: 'Paramètre regions requis' }, { status: 400 })
    }

    const regions = regionsParam.split(',').map((r) => r.trim()).filter(Boolean)
    if (regions.length === 0) {
      return NextResponse.json({ diagnostics: {} })
    }

    const db = await createClient()
    const token = await getOsteoupgradeToken(db)

    if (!token) {
      return NextResponse.json(
        { error: 'Compte Osteoupgrade non connecté ou token expiré' },
        { status: 401 }
      )
    }

    const results: Record<string, { pathologies: OsteoupgradePathology[]; tests: OsteoupgradeTest[]; topographies: OsteoupgradeTopography[] }> = {}

    // Fetch pathologies for each unique normalized region
    const uniqueRegions = [...new Set(regions.map(normalizeRegion))]

    await Promise.all(
      uniqueRegions.map(async (normalizedRegion) => {
        // Fetch pathologies for this region
        const pathUrl = new URL(`${OSTEOUPGRADE_URL}/rest/v1/pathologies`)
        pathUrl.searchParams.set('region', `eq.${normalizedRegion}`)
        pathUrl.searchParams.set('is_active', 'eq.true')
        pathUrl.searchParams.set('order', 'display_order.asc')
        pathUrl.searchParams.set('select', 'id,name,description,region,clinical_signs,image_url,is_red_flag,red_flag_reason')

        const pathResponse = await fetch(pathUrl.toString(), {
          headers: {
            apikey: OSTEOUPGRADE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        })

        if (!pathResponse.ok) {
          results[normalizedRegion] = { pathologies: [], tests: [] }
          return
        }

        const pathologies: OsteoupgradePathology[] = await pathResponse.json()

        // Fetch a quick sample of orthopedic tests for this region
        const testUrl = new URL(`${OSTEOUPGRADE_URL}/rest/v1/orthopedic_tests`)
        testUrl.searchParams.set('category', `eq.${normalizedRegion}`)
        testUrl.searchParams.set('select', 'id,name,description,sensitivity,specificity')
        testUrl.searchParams.set('limit', '5')

        const testResponse = await fetch(testUrl.toString(), {
          headers: {
            apikey: OSTEOUPGRADE_ANON_KEY,
            Authorization: `Bearer ${token}`,
          },
        })

        let tests: OsteoupgradeTest[] = []
        if (testResponse.ok) {
          tests = await testResponse.json()
        }

        // Fetch topographies for this region
        const topoUrl = new URL(`${OSTEOUPGRADE_URL}/rest/v1/elearning_topographic_views`)
        topoUrl.searchParams.set('region', `eq.${normalizedRegion}`)
        topoUrl.searchParams.set('is_active', 'eq.true')
        topoUrl.searchParams.set('select', 'id,name,region,image_url,description')
        topoUrl.searchParams.set('order', 'display_order.asc')

        let topographies: OsteoupgradeTopography[] = []
        try {
          const topoResponse = await fetch(topoUrl.toString(), {
            headers: {
              apikey: OSTEOUPGRADE_ANON_KEY,
              Authorization: `Bearer ${token}`,
            },
          })
          if (topoResponse.ok) {
            const topoData = await topoResponse.json()
            if (Array.isArray(topoData)) topographies = topoData
          }
        } catch { /* ignore if table doesn't exist */ }

        results[normalizedRegion] = { pathologies: pathologies || [], tests: tests || [], topographies }
      })
    )

    return NextResponse.json({ diagnostics: results })
  } catch (error) {
    console.error('Osteoupgrade diagnostics error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
