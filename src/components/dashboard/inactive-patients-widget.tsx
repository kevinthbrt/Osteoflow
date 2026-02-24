'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { UserX, MessageCircle, ArrowRight, Clock } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface InactivePatient {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string | null
  last_consultation_date: string | null
  days_since_last: number
}

export function InactivePatientsWidget() {
  const [patients, setPatients] = useState<InactivePatient[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [months, setMonths] = useState('3')

  useEffect(() => {
    async function fetchInactive() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/patients/inactive?months=${months}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setPatients(data.data || [])
          setTotal(data.total || 0)
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false)
      }
    }
    fetchInactive()
  }, [months])

  const formatDaysSince = (days: number) => {
    if (days < 30) return `${days}j`
    const m = Math.floor(days / 30)
    return `${m} mois`
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <UserX className="h-5 w-5 text-orange-500" />
              Patients inactifs
            </CardTitle>
            <CardDescription>
              {total > 0 ? `${total} patient${total > 1 ? 's' : ''} sans consultation` : 'Aucun patient inactif'}
            </CardDescription>
          </div>
          <Select value={months} onValueChange={setMonths}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2">&gt; 2 mois</SelectItem>
              <SelectItem value="3">&gt; 3 mois</SelectItem>
              <SelectItem value="6">&gt; 6 mois</SelectItem>
              <SelectItem value="12">&gt; 1 an</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : patients.length === 0 ? (
          <p className="text-muted-foreground text-sm py-4 text-center">
            Tous vos patients sont actifs
          </p>
        ) : (
          <div className="space-y-3">
            {patients.map((patient) => (
              <Link
                key={patient.id}
                href={`/patients/${patient.id}`}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/50 transition-all duration-200"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-orange-100 dark:bg-orange-900/30 text-orange-600 text-sm">
                    {getInitials(patient.first_name, patient.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {patient.first_name} {patient.last_name}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {patient.last_consultation_date
                      ? `Dernière visite il y a ${formatDaysSince(patient.days_since_last)}`
                      : 'Jamais consulté'}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs shrink-0 text-orange-600 border-orange-200">
                  {formatDaysSince(patient.days_since_last)}
                </Badge>
              </Link>
            ))}
            {total > 5 && (
              <Button variant="ghost" size="sm" className="w-full text-muted-foreground" asChild>
                <Link href="/patients?filter=inactive">
                  Voir les {total} patients inactifs
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
