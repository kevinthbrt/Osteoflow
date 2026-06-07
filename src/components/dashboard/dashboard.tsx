'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Plus, Sparkles } from 'lucide-react'

import { VideoWidget } from './widgets/video-widget'
import { ProgressWidget } from './widgets/progress-widget'
import { ReviewWidget, FeaturedFormationWidget, type WidgetsData } from './widgets/osteoupgrade-widgets'
import { FlashcardsWidget } from './widgets/flashcards-widget'
import { BannerWeather } from './banner-weather'
import { ProfileCompletionWidget } from './profile-completion-widget'

import type { Practitioner } from '@/types/database'

interface DashboardProps {
  practitioner: Practitioner
  practitionerEmail: string
  stats: {
    totalPatients: number
    todayConsultations: number
    monthlyRevenue: number
    unreadMessages: number
  }
  recentConsultations: Array<{
    id: string
    date_time: string
    reason: string
    patient: { id: string; first_name: string; last_name: string } | null
  }>
  patientsForConsultation: Array<{
    id: string
    first_name: string
    last_name: string
    email?: string | null
  }>
}

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bonjour'
  if (h < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

export function Dashboard({
  practitioner,
  practitionerEmail,
  stats,
  patientsForConsultation,
}: DashboardProps) {
  const [isNewConsultationOpen, setIsNewConsultationOpen] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const router = useRouter()

  // OsteoUpgrade widgets (revue + nouveauté) — single fetch shared by both cards
  const [widgets, setWidgets] = useState<WidgetsData | null>(null)
  const [widgetsLoading, setWidgetsLoading] = useState(true)
  const [widgetsRefreshKey, setWidgetsRefreshKey] = useState(0)

  useEffect(() => {
    setWidgetsLoading(true)
    fetch('/api/osteoupgrade-widgets', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setWidgets)
      .catch(() => setWidgets(null))
      .finally(() => setWidgetsLoading(false))
  }, [widgetsRefreshKey])

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase()
    if (!q) return []
    return patientsForConsultation
      .filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q))
      .slice(0, 50)
  }, [patientSearch, patientsForConsultation])

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header banner ── */}
      <div className="relative overflow-hidden rounded-2xl px-6 py-5 text-white gradient-primary">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/3 blur-lg" />
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-white/70" />
                <span className="text-sm text-white/70">
                  {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
              <h1 className="text-2xl font-bold">{greeting()}, {practitioner.first_name} !</h1>
            </div>
            <Button
              className="self-start gap-2 bg-white/15 text-white border border-white/20 hover:bg-white/25 backdrop-blur-sm"
              onClick={() => setIsNewConsultationOpen(true)}
              data-tour="dashboard-new-consult"
            >
              <Plus className="h-4 w-4" />
              Nouvelle consultation
            </Button>
          </div>
          <BannerWeather />
        </div>
      </div>

      {/* ── Complétude du profil ── */}
      <ProfileCompletionWidget />

      {/* ── Row 1 : Revue (gauche) · Vidéo (centre) · Nouveauté (droite) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <ReviewWidget
            review={widgets?.review ?? null}
            loading={widgetsLoading}
            onRefresh={() => setWidgetsRefreshKey((k) => k + 1)}
          />
        </div>
        <div className="lg:col-span-2">
          <VideoWidget />
        </div>
        <div className="lg:col-span-1">
          <FeaturedFormationWidget
            formation={widgets?.featured_formation ?? null}
            loading={widgetsLoading}
            practitionerEmail={practitionerEmail}
          />
        </div>
      </div>

      {/* ── Row 2 : Progression (3/4) · Flashcards (1/4) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <ProgressWidget layout="horizontal" />
        </div>
        <div className="lg:col-span-1">
          <FlashcardsWidget />
        </div>
      </div>

      {/* ── New consultation dialog ── */}
      <Dialog open={isNewConsultationOpen} onOpenChange={setIsNewConsultationOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nouvelle consultation</DialogTitle>
            <DialogDescription>Recherchez un patient pour créer une consultation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Rechercher par nom ou prénom..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {!patientSearch.trim() ? (
                <p className="text-center text-sm text-muted-foreground py-6">Tapez un nom pour rechercher.</p>
              ) : filteredPatients.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-6">Aucun patient trouvé.</p>
              ) : (
                filteredPatients.map((patient) => (
                  <button
                    key={patient.id}
                    type="button"
                    onClick={() => {
                      setIsNewConsultationOpen(false)
                      setPatientSearch('')
                      router.push(`/patients/${patient.id}/consultation/new`)
                    }}
                    className="w-full rounded-xl border border-border/60 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-accent/50"
                  >
                    <p className="font-medium">{patient.first_name} {patient.last_name}</p>
                    <p className="text-sm text-muted-foreground">{patient.email || 'Email non renseigné'}</p>
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <Link href="/patients/new">Créer un nouveau patient</Link>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
