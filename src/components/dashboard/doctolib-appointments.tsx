'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  CalendarClock,
  Plus,
  UserPlus,
  ArrowRight,
  Clock,
  RefreshCw,
} from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface DoctolibAppointment {
  time: string
  fullName: string
  lastName: string
  firstName: string
}

interface DoctolibSyncData {
  date: string
  syncedAt: string
  appointments: DoctolibAppointment[]
}

interface DoctolibAppointmentsProps {
  existingPatients: Array<{
    id: string
    first_name: string
    last_name: string
  }>
}

export function DoctolibAppointments({ existingPatients }: DoctolibAppointmentsProps) {
  const [syncData, setSyncData] = useState<DoctolibSyncData | null>(null)
  const router = useRouter()

  useEffect(() => {
    try {
      const stored = localStorage.getItem('doctolib_sync')
      if (stored) {
        const data: DoctolibSyncData = JSON.parse(stored)
        const today = new Date().toISOString().slice(0, 10)
        if (data.date === today) {
          setSyncData(data)
        }
      }
    } catch { /* ignore */ }
  }, [])

  // Match Doctolib names with existing patients
  const appointmentsWithMatch = useMemo(() => {
    if (!syncData) return []

    return syncData.appointments.map((apt) => {
      // Try to find a matching patient (case-insensitive)
      const match = existingPatients.find((p) => {
        const pFullName = `${p.last_name} ${p.first_name}`.toLowerCase()
        const pReverse = `${p.first_name} ${p.last_name}`.toLowerCase()
        const aptName = apt.fullName.toLowerCase()
        const aptComposed = `${apt.lastName} ${apt.firstName}`.toLowerCase()

        return (
          pFullName === aptName ||
          pFullName === aptComposed ||
          pReverse === aptName ||
          pReverse === aptComposed ||
          // Partial match on last name
          (p.last_name.toLowerCase() === apt.lastName.toLowerCase() &&
            p.first_name.toLowerCase().startsWith(apt.firstName.toLowerCase().slice(0, 3)))
        )
      })

      return { ...apt, matchedPatient: match || null }
    })
  }, [syncData, existingPatients])

  if (!syncData || syncData.appointments.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-cyan-600" />
            Agenda Doctolib
          </CardTitle>
          <CardDescription>Synchronisez votre agenda depuis l&apos;onglet Doctolib</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm mb-4">
              Aucun rendez-vous synchronis&eacute; pour aujourd&apos;hui
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/doctolib">
                <RefreshCw className="mr-1 h-4 w-4" />
                Aller sur Doctolib
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const syncTime = new Date(syncData.syncedAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-cyan-600" />
            Agenda Doctolib
          </CardTitle>
          <CardDescription>
            {syncData.appointments.length} RDV &bull; sync {syncTime}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/doctolib">
            <RefreshCw className="mr-1 h-4 w-4" />
            Sync
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {appointmentsWithMatch.map((apt, index) => (
            <div
              key={`${apt.time}-${index}`}
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-10 w-10 flex-shrink-0">
                <AvatarFallback className={apt.matchedPatient ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-600'}>
                  {getInitials(apt.firstName || apt.lastName, apt.firstName ? apt.lastName : '')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{apt.fullName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-xs">
                    <Clock className="mr-1 h-3 w-3" />
                    {apt.time}
                  </Badge>
                  {apt.matchedPatient ? (
                    <Badge variant="secondary" className="text-xs">
                      Patient connu
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">
                      Nouveau
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                {apt.matchedPatient ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/patients/${apt.matchedPatient!.id}/consultation/new`)}
                    title="Cr\u00e9er une consultation"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/patients/new?lastName=${encodeURIComponent(apt.lastName)}&firstName=${encodeURIComponent(apt.firstName)}`)}
                    title="Cr\u00e9er un nouveau patient"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
