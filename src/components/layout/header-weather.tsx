'use client'

import { useEffect, useState, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Wind, Droplets, Thermometer, MapPin, Check } from 'lucide-react'

const STORAGE_KEY = 'osteoflow_weather_location'

type StoredLocation = {
  cityName: string
  lat: number
  lon: number
}

type GeoSuggestion = {
  id: number
  name: string
  lat: number
  lon: number
  admin1?: string
  admin2?: string
  country?: string
  postcodes?: string[]
}

type WeatherData = {
  cityName: string
  temperature: number
  feelsLike: number
  weatherCode: number
  windSpeed: number
  humidity: number
  isDay: boolean
}

const WMO_ICONS: Record<number, { emoji: string; label: string }> = {
  0: { emoji: '☀️', label: 'Ensoleillé' },
  1: { emoji: '🌤️', label: 'Peu nuageux' },
  2: { emoji: '⛅', label: 'Partiellement nuageux' },
  3: { emoji: '☁️', label: 'Nuageux' },
  45: { emoji: '🌫️', label: 'Brouillard' },
  48: { emoji: '🌫️', label: 'Brouillard givrant' },
  51: { emoji: '🌦️', label: 'Bruine' },
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

async function searchCities(query: string): Promise<GeoSuggestion[]> {
  if (query.trim().length < 2) return []
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=6&language=fr&format=json`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map((r: any) => ({
      id: r.id,
      name: r.name,
      lat: r.latitude,
      lon: r.longitude,
      admin1: r.admin1,
      admin2: r.admin2,
      country: r.country,
      postcodes: r.postcodes,
    }))
  } catch {
    return []
  }
}

async function fetchWeatherFromCoords(lat: number, lon: number): Promise<Omit<WeatherData, 'cityName'> | null> {
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

function formatPostcodes(postcodes?: string[]): string {
  if (!postcodes?.length) return ''
  if (postcodes.length <= 3) return postcodes.join(', ')
  return `${postcodes.slice(0, 2).join(', ')}…`
}

function loadStoredLocation(): StoredLocation | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredLocation
  } catch {
    return null
  }
}

export function HeaderWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [hasLocation, setHasLocation] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>()

  const loadWeather = async (location: StoredLocation) => {
    setWeatherLoading(true)
    const w = await fetchWeatherFromCoords(location.lat, location.lon)
    if (w) setWeather({ ...w, cityName: location.cityName })
    setWeatherLoading(false)
  }

  useEffect(() => {
    const loc = loadStoredLocation()
    if (loc) {
      setHasLocation(true)
      loadWeather(loc)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh every 30 minutes
  useEffect(() => {
    if (!weather) return
    const interval = setInterval(() => {
      const loc = loadStoredLocation()
      if (loc) loadWeather(loc)
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weather?.cityName])

  // Debounced suggestions
  useEffect(() => {
    clearTimeout(suggestTimer.current)
    if (query.trim().length < 2) { setSuggestions([]); return }
    suggestTimer.current = setTimeout(async () => {
      setSuggestLoading(true)
      const results = await searchCities(query)
      setSuggestions(results)
      setSuggestLoading(false)
    }, 300)
    return () => clearTimeout(suggestTimer.current)
  }, [query])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else { setQuery(''); setSuggestions([]) }
  }, [open])

  const handleSelect = async (suggestion: GeoSuggestion) => {
    const location: StoredLocation = {
      cityName: suggestion.name,
      lat: suggestion.lat,
      lon: suggestion.lon,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(location))
    setHasLocation(true)
    setOpen(false)
    setQuery('')
    setSuggestions([])
    await loadWeather(location)
  }

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode, weather.isDay) : null

  if (!hasLocation) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:bg-accent/50 transition-colors border border-dashed border-border/50"
      >
        <MapPin className="h-3.5 w-3.5" />
        Météo
        {open && (
          <WeatherPopoverBody
            query={query}
            setQuery={setQuery}
            suggestions={suggestions}
            suggestLoading={suggestLoading}
            onSelect={handleSelect}
            inputRef={inputRef}
            onClose={() => setOpen(false)}
          />
        )}
      </button>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm hover:bg-accent/50 transition-colors select-none cursor-pointer">
          {weatherLoading ? (
            <span className="text-xs text-muted-foreground animate-pulse">…</span>
          ) : weather && weatherInfo ? (
            <>
              <span className="text-base leading-none" role="img" aria-label={weatherInfo.label}>
                {weatherInfo.emoji}
              </span>
              <span className="font-medium tabular-nums">{weather.temperature}°</span>
              <span className="text-muted-foreground text-xs hidden lg:block truncate max-w-[90px]">
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
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          {/* Search */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Changer de ville</p>
            <div className="relative">
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tapez une ville…"
                className="text-sm h-9 pr-8"
              />
              {suggestLoading && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              )}
            </div>

            {/* Suggestions dropdown */}
            {suggestions.length > 0 && (
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-sm">
                {suggestions.map((s) => {
                  const postcodeStr = formatPostcodes(s.postcodes)
                  const isSelected = weather?.cityName === s.name
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleSelect(s)}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent/60 transition-colors flex items-center gap-2 border-b border-border/30 last:border-0"
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.name}
                          {postcodeStr && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              ({postcodeStr})
                            </span>
                          )}
                        </p>
                        {s.admin1 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {s.admin1}{s.country && s.country !== 'France' ? ` · ${s.country}` : ''}
                          </p>
                        )}
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}

            {query.trim().length >= 2 && !suggestLoading && suggestions.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">Aucune ville trouvée</p>
            )}
          </div>

          {/* Current weather details */}
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

// Sub-component used when no location is set yet (no Popover wrapper)
function WeatherPopoverBody({
  query, setQuery, suggestions, suggestLoading, onSelect, inputRef, onClose,
}: {
  query: string
  setQuery: (v: string) => void
  suggestions: GeoSuggestion[]
  suggestLoading: boolean
  onSelect: (s: GeoSuggestion) => void
  inputRef: React.RefObject<HTMLInputElement>
  onClose: () => void
}) {
  return (
    <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border rounded-2xl shadow-xl p-4 z-50 space-y-2"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-sm font-medium">Choisir une ville</p>
      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tapez une ville…"
          className="text-sm h-9 pr-8"
          autoFocus
        />
        {suggestLoading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        )}
      </div>
      {suggestions.length > 0 && (
        <div className="border border-border/50 rounded-xl overflow-hidden bg-background">
          {suggestions.map((s) => {
            const postcodeStr = formatPostcodes(s.postcodes)
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className="w-full text-left px-3 py-2.5 hover:bg-accent/60 transition-colors flex items-center gap-2 border-b border-border/30 last:border-0"
              >
                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {s.name}
                    {postcodeStr && <span className="ml-1.5 text-xs font-normal text-muted-foreground">({postcodeStr})</span>}
                  </p>
                  {s.admin1 && <p className="text-xs text-muted-foreground truncate">{s.admin1}{s.country && s.country !== 'France' ? ` · ${s.country}` : ''}</p>}
                </div>
              </button>
            )
          })}
        </div>
      )}
      {query.trim().length >= 2 && !suggestLoading && suggestions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">Aucune ville trouvée</p>
      )}
    </div>
  )
}
