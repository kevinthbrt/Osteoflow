'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { MedicalHistorySection } from './medical-history-section'
import type { MedicalHistoryEntry } from '@/types/database'

interface MedicalHistorySectionWrapperProps {
  patientId: string
  initialEntries: MedicalHistoryEntry[]
  refreshTrigger?: number
}

export function MedicalHistorySectionWrapper({
  patientId,
  initialEntries,
  refreshTrigger,
}: MedicalHistorySectionWrapperProps) {
  const [entries, setEntries] = useState<MedicalHistoryEntry[]>(initialEntries)
  const router = useRouter()
  const dbRef = useRef(createClient())

  const fetchEntries = useCallback(async () => {
    const { data } = await dbRef.current
      .from('medical_history_entries')
      .select('*')
      .eq('patient_id', patientId)
      .order('display_order', { ascending: true })
    if (data) setEntries(data)
  }, [patientId])

  // Full refresh: re-fetch local state + invalidate server cache (used after user edits)
  const refreshEntries = useCallback(async () => {
    await fetchEntries()
    router.refresh()
  }, [fetchEntries, router])

  // Lightweight refresh triggered by AI field acceptance — local state only, no page reload
  useEffect(() => {
    if (refreshTrigger) fetchEntries()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger])

  return (
    <MedicalHistorySection
      patientId={patientId}
      entries={entries}
      onEntriesChange={refreshEntries}
    />
  )
}
