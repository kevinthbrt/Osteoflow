'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Cloud, MapPin, Search, Wind, Droplets, Thermometer } from 'lucide-react'

const STORAGE_KEY = 'osteoflow_weather_city'

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
  51: { emoji: '🌦️', label: 'Bruine légère' },
  53: { emoji: '🌦️', label: 'Bruine modérée' },
  55: { emoji: '🌦️', label: 'Bruine dense' },
  61: { emoji: '🌧️', label: 'Pluie légère' },
  63: { emoji: '🌧️', label: 'Pluie modérée' },
  65: { emoji: '🌧️', label: 'Pluie forte' },
  71: { emoji: '🌨️', label: 'Neige légère' },
  73: { emoji: '🌨️', label: 'Neige modérée' },
  75: { emoji: '❄️', label: 'Neige forte' },
  80: { emoji: '🌦️', label: 'Averses légères' },
  81: { emoji: '🌧️', label: 'Averses modérées' },
  82: { emoji: '⛈️', label: 'Averses violentes' },
  95: { emoji: '⛈️', label: 'Orage' },
  96: { emoji: '⛈️', label: 'Orage avec grêle' },
  99: { emoji: '⛈️', label: 'Orage fort avec grêle' },
}

function getWeatherInfo(code: number, isDay: boolean) {
  const info = WMO_ICONS[code] || { emoji: isDay ? '🌤️' : '🌙', label: 'Variable' }
  return info
}

async function geocodeCity(city: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`,
    { signal: AbortSignal.timeout(5000) }
  )
  if (!res.ok) return null
  const data = await res.json()
  const result = data.results?.[0]
  if (!result) return null
  return { lat: result.latitude, lon: result.longitude, name: result.name }
}

async function fetchWeather(lat: number, lon: number): Promise<Omit<WeatherData, 'cityName'> | null> {
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
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [cityInput, setCityInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const loadWeather = async (city: string) => {
    setLoading(true)
    setError(null)
    try {
      const geo = await geocodeCity(city)
      if (!geo) {
        setError('Ville introuvable')
        setLoading(false)
        return
      }
      const w = await fetchWeather(geo.lat, geo.lon)
      if (!w) {
        setError('Météo indisponible')
        setLoading(false)
        return
      }
      const result: WeatherData = { ...w, cityName: geo.name }
      setWeather(result)
      localStorage.setItem(STORAGE_KEY, city)
    } catch {
      setError('Impossible de charger la météo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setCityInput(saved)
      loadWeather(saved)
    } else {
      setEditing(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (editing) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [editing])

  const handleSearch = async () => {
    if (!cityInput.trim()) return
    setEditing(false)
    await loadWeather(cityInput.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
    if (e.key === 'Escape') setEditing(false)
  }

  const weatherInfo = weather ? getWeatherInfo(weather.weatherCode, weather.isDay) : null

  return (
    <Card className="overflow-hidden border-border/30 h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
            <Cloud className="h-4 w-4 text-sky-500" />
          </div>
          Météo
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setEditing(true); setCityInput(weather?.cityName || '') }}
          className="h-8 w-8 p-0"
        >
          <MapPin className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Entrez votre ville</p>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ex: Paris, Lyon, Bordeaux..."
                className="text-sm"
              />
              <Button size="sm" onClick={handleSearch} className="shrink-0">
                <Search className="h-4 w-4" />
              </Button>
            </div>
            {weather && (
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setEditing(false)}>
                Annuler
              </Button>
            )}
          </div>
        ) : loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-16 bg-muted/40 rounded-xl" />
            <div className="h-4 bg-muted/30 rounded w-3/4" />
            <div className="h-4 bg-muted/30 rounded w-1/2" />
          </div>
        ) : error ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Réessayer
            </Button>
          </div>
        ) : weather && weatherInfo ? (
          <div className="space-y-4">
            {/* Main temp */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-light tabular-nums">{weather.temperature}°</p>
                <p className="text-sm text-muted-foreground mt-0.5">{weatherInfo.label}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3 w-3" />{weather.cityName}
                </p>
              </div>
              <div className="text-6xl select-none" role="img" aria-label={weatherInfo.label}>
                {weatherInfo.emoji}
              </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/30">
                <Thermometer className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium tabular-nums">{weather.feelsLike}°</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">Ressenti</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/30">
                <Wind className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium tabular-nums">{weather.windSpeed}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">km/h</span>
              </div>
              <div className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/30">
                <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium tabular-nums">{weather.humidity}%</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">Humidité</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-3">
            <Cloud className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Configurez votre ville</p>
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <MapPin className="h-4 w-4 mr-1" /> Choisir une ville
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
