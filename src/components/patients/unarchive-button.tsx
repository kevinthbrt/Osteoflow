'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArchiveRestore } from 'lucide-react'
import { createClient } from '@/lib/db/client'
import { useToast } from '@/hooks/use-toast'

interface UnarchiveButtonProps {
  patientId: string
  patientName: string
}

export function UnarchiveButton({ patientId, patientName }: UnarchiveButtonProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const db = createClient()

  const handleUnarchive = async () => {
    setLoading(true)
    const { error } = await db
      .from('patients')
      .update({ archived_at: null })
      .eq('id', patientId)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de désarchiver le patient',
      })
      setLoading(false)
      return
    }

    toast({
      title: 'Patient désarchivé',
      description: `${patientName} a été réactivé`,
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleUnarchive} disabled={loading}>
      <ArchiveRestore className="mr-2 h-4 w-4" />
      Désarchiver
    </Button>
  )
}
