'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { MedicalHistorySection } from './medical-history-section'
import type { MedicalHistoryEntry } from '@/types/database'

interface MedicalHistorySectionWrapperProps {
  patientId: string
  initialEntries: MedicalHistoryEntry[]
}

export function MedicalHistorySectionWrapper({
  patientId,
  initialEntries,
}: MedicalHistorySectionWrapperProps) {
  const [entries, setEntries] = useState<MedicalHistoryEntry[]>(initialEntries)
  const router = useRouter()
  const db = createClient()

  const refreshEntries = useCallback(async () => {
    const { data } = await db
      .from('medical_history_entries')
      .select('*')
      .eq('patient_id', patientId)
      .order('display_order', { ascending: true })

    if (data) {
      setEntries(data)
    }
    router.refresh()
  }, [patientId, db, router])

  return (
    <MedicalHistorySection
      patientId={patientId}
      entries={entries}
      onEntriesChange={refreshEntries}
    />
  )
}
