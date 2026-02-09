import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/utils'
import type { Consultation } from '@/types/database'

interface PastConsultationsPreviewProps {
  patientId: string
  consultations: Consultation[]
  maxItems?: number
}

export function PastConsultationsPreview({
  patientId,
  consultations,
  maxItems = 5,
}: PastConsultationsPreviewProps) {
  const visibleConsultations = consultations.slice(0, maxItems)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Consultations précédentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleConsultations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune consultation enregistrée pour ce patient.
          </p>
        ) : (
          <ul className="space-y-2">
            {visibleConsultations.map((consultation) => (
              <li key={consultation.id} className="text-sm">
                <Link
                  href={`/consultations/${consultation.id}`}
                  className="font-medium hover:underline"
                >
                  {formatDateTime(consultation.date_time)}
                </Link>
                <p className="text-muted-foreground line-clamp-2">
                  {consultation.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
        {consultations.length > maxItems && (
          <Link
            href={`/patients/${patientId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Voir toutes les consultations
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
