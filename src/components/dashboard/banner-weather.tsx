'use client'

import { useEffect, useState, useRef } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { MapPin, Check, Wind, Droplets, Thermometer } from 'lucide-react'
import {
  type WeatherData,
  type ForecastDay,
  type GeoSuggestion,
  type StoredLocation,
  getWeatherInfo,
  formatPostcodes,
  loadStoredLocation,
  saveLocation,
  searchCities,
  fetchWeatherWithForecast,
} from '@/lib/utils/weather'

const DAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function getDayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Auj.'
  if (index === 1) return 'Dem.'
  // Parse as noon local time to avoid UTC-offset day shift
  const d = new Date(`${dateStr}T12:00:00`)
  return DAY_SHORT[d.getDay()]
}

export function BannerWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [forecast, setForecast] = useState<ForecastDay[]>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<GeoSuggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestTimer = useRef<ReturnType<typeof setTimeout>>()

  const loadWeather = async (location: StoredLocation) => {
    const result = await fetchWeatherWithForecast(location.lat, location.lon)
    if (result) {
      setWeather({ ...result.current, cityName: location.cityName })
      setForecast(result.forecast)
    }
  }

  useEffect(() => {
    setMounted(true)
    const loc = loadStoredLocation()
    if (loc) loadWeather(loc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  if (!mounted) return null

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode, weather.isDay) : null
  const hasLocation = !!loadStoredLocation()

  return (
    <div className="flex flex-col items-start md:items-end gap-2">
      {/* Current weather chip */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 px-4 py-2.5 transition-colors cursor-pointer text-left"
          >
            {weather && weatherInfo ? (
              <>
                <span className="text-3xl leading-none" role="img" aria-label={weatherInfo.label}>
                  {weatherInfo.emoji}
                </span>
                <div>
                  <p className="text-white text-xl font-light tabular-nums leading-tight">
                    {weather.temperature}°C
                  </p>
                  <p className="text-white/70 text-xs leading-tight">
                    {weather.cityName} · {weatherInfo.label}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-white/60 text-sm">
                <MapPin className="h-4 w-4" />
                <span>{hasLocation ? 'Chargement…' : 'Ajouter la météo'}</span>
              </div>
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
              <div className="border-t pt-3 space-y-2">
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

      {/* 6-day forecast row */}
      {forecast.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {forecast.map((day, i) => {
            const info = getWeatherInfo(day.weatherCode, true)
            return (
              <div
                key={day.date}
                className="flex flex-col items-center gap-0.5 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-2.5 py-1.5 min-w-[48px]"
              >
                <span className="text-white/60 text-[10px] font-medium leading-none">
                  {getDayLabel(day.date, i)}
                </span>
                <span className="text-base leading-none" role="img" aria-label={info.label}>
                  {info.emoji}
                </span>
                <span className="text-white text-xs font-medium tabular-nums leading-none">
                  {day.tempMax}°
                </span>
                <span className="text-white/50 text-[10px] tabular-nums leading-none">
                  {day.tempMin}°
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
