'use client'

import { useEffect, useState, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { MapPin, Search, Wind, Droplets, Thermometer } from 'lucide-react'

const STORAGE_KEY = 'osteoflow_weather_city'

type WeatherData = {
  cityName: string
  temperature: number
  feelsLike: number
  weatherCode: number
  windSpeed: number
  humidity: number
  isDay: boolean
  savedQuery: string
}

const WMO_ICONS: Record<number, { emoji: string; label: string }> = {
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

function getWeatherInfo(code: number, isDay: boolean) {
  return WMO_ICONS[code] || { emoji: isDay ? '🌤️' : '🌙', label: 'Variable' }
}

async function geocodeQuery(query: string): Promise<{ lat: number; lon: number; name: string } | null> {
  // Parse input: "Paris 75001" → try postal code first, then city name
  const parts = query.trim().split(/\s+/)
  const lastPart = parts[parts.length - 1]
  const isPostalCode = /^\d{4,5}$/.test(lastPart)

  const candidates = isPostalCode
    ? [lastPart, parts.slice(0, -1).join(' '), query].filter(Boolean)
    : [query]

  for (const candidate of candidates) {
    if (!candidate.trim()) continue
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate)}&count=3&language=fr&format=json`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      const result = data.results?.[0]
      if (result) return { lat: result.latitude, lon: result.longitude, name: result.name }
    } catch {
      continue
    }
  }
  return null
}

async function fetchWeatherData(lat: number, lon: number): Promise<Omit<WeatherData, 'cityName' | 'savedQuery'> | null> {
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

export function HeaderWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [open, setOpen] = useState(false)
  const [cityInput, setCityInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadWeather = async (query: string) => {
    setLoading(true)
    setError(null)
    try {
      const geo = await geocodeQuery(query)
      if (!geo) { setError('Ville introuvable'); setLoading(false); return }
      const w = await fetchWeatherData(geo.lat, geo.lon)
      if (!w) { setError('Météo indisponible'); setLoading(false); return }
      const result: WeatherData = { ...w, cityName: geo.name, savedQuery: query }
      setWeather(result)
      localStorage.setItem(STORAGE_KEY, query)
    } catch {
      setError('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setCityInput(saved)
      loadWeather(saved)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const handleSearch = async () => {
    if (!cityInput.trim()) return
    await loadWeather(cityInput.trim())
    if (!error) setOpen(false)
  }

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode, weather.isDay) : null

  // Refresh every 30 minutes
  useEffect(() => {
    if (!weather) return
    const interval = setInterval(() => loadWeather(weather.savedQuery), 30 * 60 * 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather?.savedQuery])

  if (!weather && !localStorage.getItem(STORAGE_KEY)) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-accent/50 transition-colors border border-dashed border-border/50"
      >
        <MapPin className="h-3.5 w-3.5" />
        Météo
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm hover:bg-accent/50 transition-colors select-none cursor-pointer">
          {loading ? (
            <span className="text-xs text-muted-foreground animate-pulse">Chargement...</span>
          ) : weather && weatherInfo ? (
            <>
              <span className="text-base leading-none" role="img" aria-label={weatherInfo.label}>
                {weatherInfo.emoji}
              </span>
              <span className="font-medium tabular-nums">{weather.temperature}°</span>
              <span className="text-muted-foreground text-xs hidden lg:block truncate max-w-[100px]">
                {weather.cityName}
              </span>
            </>
          ) : (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Météo
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="end">
        <div className="space-y-4">
          {/* City search */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Localisation météo</p>
            <p className="text-xs text-muted-foreground">Entrez une ville, ou une ville avec son code postal.</p>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={cityInput}
                onChange={(e) => { setCityInput(e.target.value); setError(null) }}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                placeholder="Ex: Lyon 69001, Paris 75..."
                className="text-sm h-8"
              />
              <Button size="sm" onClick={handleSearch} disabled={loading} className="h-8 w-8 p-0 shrink-0">
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          {/* Weather details */}
          {weather && weatherInfo && (
            <div className="border-t pt-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-light tabular-nums">{weather.temperature}°C</p>
                  <p className="text-xs text-muted-foreground">{weatherInfo.label}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <MapPin className="h-3 w-3" />{weather.cityName}
                  </p>
                </div>
                <span className="text-4xl" role="img" aria-label={weatherInfo.label}>{weatherInfo.emoji}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-muted/30">
                  <Thermometer className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium tabular-nums">{weather.feelsLike}°</span>
                  <span className="text-[10px] text-muted-foreground">Ressenti</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-muted/30">
                  <Wind className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium tabular-nums">{weather.windSpeed}</span>
                  <span className="text-[10px] text-muted-foreground">km/h</span>
                </div>
                <div className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-muted/30">
                  <Droplets className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium tabular-nums">{weather.humidity}%</span>
                  <span className="text-[10px] text-muted-foreground">Humidité</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
