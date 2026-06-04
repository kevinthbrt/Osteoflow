import { NextRequest, NextResponse } from 'next/server'

// Proxy pour open-meteo.com — évite le blocage CORS dans Electron
// (le renderer sur localhost:3456 ne peut pas appeler des domaines externes directement)

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') // 'forecast' | 'geocoding'

  let upstream: string

  if (type === 'geocoding') {
    const name = searchParams.get('name') ?? ''
    upstream =
      `https://geocoding-api.open-meteo.com/v1/search` +
      `?name=${encodeURIComponent(name)}&count=6&language=fr&format=json`
  } else {
    const lat = searchParams.get('lat') ?? ''
    const lon = searchParams.get('lon') ?? ''
    const extra = searchParams.get('extra') === '1'
      ? `&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=6`
      : ''
    upstream =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day` +
      extra +
      `&timezone=auto`
  }

  try {
    const res = await fetch(upstream, { signal: AbortSignal.timeout(6000) })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'upstream_error' }, { status: 502 })
  }
}
