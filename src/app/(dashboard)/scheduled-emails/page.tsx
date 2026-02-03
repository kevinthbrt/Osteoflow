'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/db/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Mail, CheckCircle2, XCircle, Clock, RefreshCw, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface ScheduledTask {
  id: string
  type: string
  consultation_id: string | null
  scheduled_for: string
  executed_at: string | null
  status: string
  error_message: string | null
  created_at: string
  consultation?: {
    date_time: string
    reason: string
    patient?: {
      first_name: string
      last_name: string
      email: string | null
    }
  }
}

function formatDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function statusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Envoyé
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Échoué
        </Badge>
      )
    case 'cancelled':
      return (
        <Badge variant="secondary">
          Annulé
        </Badge>
      )
    default:
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          En attente
        </Badge>
      )
  }
}

function typeLabel(type: string) {
  switch (type) {
    case 'follow_up_email':
      return 'Suivi J+7'
    case 'post_session_advice':
      return 'Conseils post-séance'
    default:
      return type
  }
}

export default function ScheduledEmailsPage() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all')
  const [search, setSearch] = useState('')
  const db = createClient()

  const loadTasks = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user } } = await db.auth.getUser()
      if (!user) return

      const { data: practitioner } = await db
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) return

      let query = db
        .from('scheduled_tasks')
        .select(`*, consultation:consultations (date_time, reason, patient:patients (first_name, last_name, email))`)
        .eq('practitioner_id', practitioner.id)
        .order('scheduled_for', { ascending: false })
        .limit(100)

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query
      if (error) {
        console.error('Error loading tasks:', error)
        return
      }

      setTasks(data || [])
    } catch (e) {
      console.error('Error:', e)
    } finally {
      setIsLoading(false)
    }
  }, [db, filter])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const filteredTasks = tasks.filter((task) => {
    if (!search) return true
    const patient = task.consultation?.patient
    if (!patient) return false
    const name = `${patient.first_name} ${patient.last_name}`.toLowerCase()
    return name.includes(search.toLowerCase())
  })

  const counts = {
    all: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Emails programmés</h1>
        <p className="text-muted-foreground">
          Suivi des emails automatiques et de leur statut d&apos;envoi.
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilter('all')}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.all}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilter('pending')}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.pending}</p>
                <p className="text-xs text-muted-foreground">En attente</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilter('completed')}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.completed}</p>
                <p className="text-xs text-muted-foreground">Envoyés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setFilter('failed')}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{counts.failed}</p>
                <p className="text-xs text-muted-foreground">Échoués</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un patient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline" size="sm" onClick={loadTasks} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {/* Task list */}
      <Card>
        <CardHeader>
          <CardTitle>
            {filter === 'all' ? 'Tous les emails' : filter === 'pending' ? 'En attente' : filter === 'completed' ? 'Envoyés' : 'Échoués'}
          </CardTitle>
          <CardDescription>
            {filteredTasks.length} email(s) programmé(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Aucun email programmé trouvé.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTasks.map((task) => {
                const patient = task.consultation?.patient
                return (
                  <div key={task.id} className="py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">
                          {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient inconnu'}
                        </p>
                        {statusBadge(task.status)}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{typeLabel(task.type)}</span>
                        <span>Programmé : {formatDateTime(task.scheduled_for)}</span>
                        {task.executed_at && (
                          <span>Exécuté : {formatDateTime(task.executed_at)}</span>
                        )}
                      </div>
                      {patient?.email && (
                        <p className="text-xs text-muted-foreground mt-0.5">{patient.email}</p>
                      )}
                      {task.error_message && (
                        <p className="text-xs text-red-500 mt-1">{task.error_message}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
