'use client'

import { useEffect, useState, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Wind, Droplets, Thermometer, MapPin, Check } from 'lucide-react'
import {
  type WeatherData,
  type GeoSuggestion,
  type StoredLocation,
  getWeatherInfo,
  formatPostcodes,
  loadStoredLocation,
  saveLocation,
  searchCities,
  fetchWeatherFromCoords,
} from '@/lib/utils/weather'

export function HeaderWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>()

  const loadWeather = async (location: StoredLocation) => {
    setWeatherLoading(true)
    const w = await fetchWeatherFromCoords(location.lat, location.lon)
    if (w) setWeather({ ...w, cityName: location.cityName })
    setWeatherLoading(false)
  }

  useEffect(() => {
    setMounted(true)
    const loc = loadStoredLocation()
    if (loc) loadWeather(loc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh every 30 min
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

  const handleSelect = async (s: GeoSuggestion) => {
    const location: StoredLocation = { cityName: s.name, lat: s.lat, lon: s.lon }
    saveLocation(location)
    setOpen(false)
    await loadWeather(location)
  }

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode, weather.isDay) : null

  // Avoid SSR mismatch — only render after mount
  if (!mounted) return null

  const hasLocation = !!loadStoredLocation()

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm hover:bg-accent/50 transition-colors cursor-pointer select-none">
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
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 border border-dashed border-border/60 rounded-lg px-2 py-0.5">
              <MapPin className="h-3 w-3" />
              {hasLocation ? 'Météo…' : 'Météo'}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {weather ? 'Changer de ville' : 'Choisir une ville'}
            </p>
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

            {suggestions.length > 0 && (
              <div className="border border-border/50 rounded-xl overflow-hidden bg-background shadow-sm">
                {suggestions.map((s) => {
                  const codes = formatPostcodes(s.postcodes)
                  const isSelected = weather?.cityName === s.name
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleSelect(s)}
                      className="w-full text-left px-3 py-2.5 hover:bg-accent/60 transition-colors flex items-center gap-2 border-b border-border/30 last:border-0"
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.name}
                          {codes && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                              ({codes})
                            </span>
                          )}
                        </p>
                        {s.admin1 && (
                          <p className="text-xs text-muted-foreground truncate">
                            {s.admin1}
                            {s.country && s.country !== 'France' ? ` · ${s.country}` : ''}
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
                <span className="text-4xl" role="img" aria-label={weatherInfo.label}>
                  {weatherInfo.emoji}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Thermometer, value: `${weather.feelsLike}°`, label: 'Ressenti' },
                  { icon: Wind, value: `${weather.windSpeed}`, label: 'km/h' },
                  { icon: Droplets, value: `${weather.humidity}%`, label: 'Humidité' },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 p-2 rounded-lg bg-muted/30">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium tabular-nums">{value}</span>
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
