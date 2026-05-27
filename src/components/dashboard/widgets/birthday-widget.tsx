'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Cake, MessageCircle } from 'lucide-react'

type BirthdayPatient = {
  id: string
  first_name: string
  last_name: string
  birth_date: string
}

interface BirthdayWidgetProps {
  patients: BirthdayPatient[]
}

export function BirthdayWidget({ patients }: BirthdayWidgetProps) {
  const now = new Date()

  return (
    <Card className="border-border/30 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
            <Cake className="h-4 w-4 text-pink-500" />
          </div>
          Anniversaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        {patients.length === 0 ? (
          <div className="text-center py-6">
            <Cake className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Aucun anniversaire cette semaine</p>
          </div>
        ) : (
          <div className="space-y-2">
            {patients.map((patient) => {
              const bday = new Date(patient.birth_date)
              const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate())
              const age = now.getFullYear() - bday.getFullYear()
              const isToday =
                thisYearBday.getDate() === now.getDate() &&
                thisYearBday.getMonth() === now.getMonth()

              return (
                <Link
                  key={patient.id}
                  href={`/patients/${patient.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent/50 transition-all duration-200 group"
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isToday ? 'bg-pink-500' : 'bg-pink-100 dark:bg-pink-900/30'
                  }`}>
                    <Cake className={`h-4 w-4 ${isToday ? 'text-white' : 'text-pink-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {patient.first_name} {patient.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isToday ? "Aujourd'hui !" : thisYearBday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
                      {' · '}{age} ans
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      window.location.href = `/messages?patient=${patient.id}`
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
