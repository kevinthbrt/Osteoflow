export const WEATHER_STORAGE_KEY = 'osteoflow_weather_location'

export type StoredLocation = {
  cityName: string
  lat: number
  lon: number
}

export type GeoSuggestion = {
  id: number
  name: string
  lat: number
  lon: number
  admin1?: string
  country?: string
  postcodes?: string[]
}

export type WeatherData = {
  cityName: string
  temperature: number
  feelsLike: number
  weatherCode: number
  windSpeed: number
  humidity: number
  isDay: boolean
}

export const WMO_ICONS: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '☀️', label: 'Ensoleillé' },
  1: { emoji: '🌤️', label: 'Peu nuageux' },
  2: { emoji: '⛅', label: 'Partiellement nuageux' },
  3: { emoji: '☁️', label: 'Nuageux' },
  45: { emoji: '🌫️', label: 'Brouillard' },
  48: { emoji: '🌫️', label: 'Brouillard givrant' },
  51: { emoji: '🌦️', label: 'Bruine légère' },
  53: { emoji: '🌦️', label: 'Bruine' },
  55: { emoji: '🌦️', label: 'Bruine dense' },
  61: { emoji: '🌧️', label: 'Pluie légère' },
  63: { emoji: '🌧️', label: 'Pluie' },
  65: { emoji: '🌧️', label: 'Pluie forte' },
  71: { emoji: '🌨️', label: 'Neige légère' },
  73: { emoji: '🌨️', label: 'Neige' },
  75: { emoji: '❄️', label: 'Neige forte' },
  80: { emoji: '🌦️', label: 'Averses' },
  81: { emoji: '🌧️', label: 'Averses' },
  82: { emoji: '⛈️', label: 'Averses violentes' },
  95: { emoji: '⛈️', label: 'Orage' },
  96: { emoji: '⛈️', label: 'Orage avec grêle' },
  99: { emoji: '⛈️', label: 'Orage fort' },
}

export function getWeatherInfo(code: number, isDay: boolean) {
  return WMO_ICONS[code] || { emoji: isDay ? '🌤️' : '🌙', label: 'Variable' }
}

export function formatPostcodes(postcodes?: string[]): string {
  if (!postcodes?.length) return ''
  if (postcodes.length <= 3) return postcodes.join(', ')
  return `${postcodes.slice(0, 2).join(', ')}…`
}

export function loadStoredLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(WEATHER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredLocation
  } catch {
    return null
  }
}

export function saveLocation(location: StoredLocation) {
  localStorage.setItem(WEATHER_STORAGE_KEY, JSON.stringify(location))
}

export async function searchCities(query: string): Promise<GeoSuggestion[]> {
  if (query.trim().length < 2) return []
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=fr&format=json`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      lat: r.latitude,
      lon: r.longitude,
      admin1: r.admin1,
      country: r.country,
      postcodes: r.postcodes,
    }))
  } catch {
    return []
  }
}

export async function fetchWeatherFromCoords(
  lat: number,
  lon: number
): Promise<Omit<WeatherData, 'cityName'> | null> {
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m,is_day&timezone=auto`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const c = data.current
    return {
      temperature: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      weatherCode: c.weather_code,
      windSpeed: Math.round(c.wind_speed_10m),
      humidity: c.relative_humidity_2m,
      isDay: c.is_day === 1,
    }
  } catch {
    return null
  }
}
