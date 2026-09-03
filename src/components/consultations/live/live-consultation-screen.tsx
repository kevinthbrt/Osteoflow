'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ConsultationLive, type LiveResult } from '@/components/consultations/live/consultation-live'
import type {
  HistoryEntry,
  PastConsultation,
  PatientSummary,
} from '@/components/consultations/live/live-patient-panel'
import { useToast } from '@/hooks/use-toast'

/**
 * Raccorde le mode consultation au reste de l'application.
 *
 * L'anamnèse terminée est écrite dans le brouillon de consultation, puis on
 * bascule sur le formulaire, qui le restaure tout seul. Le mode consultation est
 * donc une nouvelle façon de SAISIR, branchée sur la plomberie existante :
 * facturation, relance, pièces jointes et hypothèses restent où elles sont, et
 * rien en aval n'a besoin de savoir qu'il existe.
 */

interface LiveConsultationScreenProps {
  patientId: string
  patientName: string
  patientContext?: string
  patient: PatientSummary
  history: HistoryEntry[]
  pastConsultations: PastConsultation[]
}

export function LiveConsultationScreen({
  patientId,
  patientName,
  patientContext,
  patient,
  history,
  pastConsultations,
}: LiveConsultationScreenProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [finishing, setFinishing] = useState(false)

  const handleFinish = useCallback(async (result: LiveResult) => {
    setFinishing(true)
    try {
      // La phrase de synthèse est un confort, pas une condition : son échec ne
      // doit pas faire perdre l'anamnèse qui vient d'être recueillie.
      let summary = ''
      try {
        const res = await fetch('/api/ai/summarize-anamnesis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: result.reason, sections: result.sections }),
        })
        if (res.ok) summary = (await res.json()).summary ?? ''
      } catch { /* on continue sans synthèse */ }

      const draftRes = await fetch('/api/consultation/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_id: patientId,
          reason: result.reason,
          anamnesis: result.markdown,
          anamnesis_sections: JSON.stringify(result.sections),
          anamnesis_summary: summary || undefined,
        }),
      })
      if (!draftRes.ok) throw new Error('draft')

      router.push(`/patients/${patientId}/consultation/new`)
    } catch {
      setFinishing(false)
      toast({
        title: 'Impossible de poursuivre',
        description: "L'anamnèse n'a pas pu être transmise au formulaire. Elle est toujours à l'écran, réessayez.",
        variant: 'destructive',
      })
    }
  }, [patientId, router, toast])

  const handleCancel = useCallback(() => {
    router.push(`/patients/${patientId}`)
  }, [patientId, router])

  return (
    <ConsultationLive
      patientId={patientId}
      patientName={patientName}
      patient={patient}
      history={history}
      pastConsultations={pastConsultations}
      patientContext={patientContext}
      onFinish={handleFinish}
      onCancel={handleCancel}
      finishing={finishing}
    />
  )
}
