'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, MessageCircle, Loader2 } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import type { Patient } from '@/types/database'

interface NewConversationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (conversation: unknown) => void
}

interface PatientResult extends Pick<Patient, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'> {}

export function NewConversationModal({
  open,
  onOpenChange,
  onCreated,
}: NewConversationModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [patients, setPatients] = useState<PatientResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const searchPatients = useDebouncedCallback(async (query: string) => {
    if (!query.trim()) {
      setPatients([])
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('id, first_name, last_name, email, phone')
        .is('archived_at', null)
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(10)

      if (error) throw error
      setPatients(data as PatientResult[])
    } catch (error) {
      console.error('Error searching patients:', error)
    } finally {
      setIsLoading(false)
    }
  }, 300)

  useEffect(() => {
    searchPatients(searchQuery)
  }, [searchQuery, searchPatients])

  const handleSelectPatient = async (patient: PatientResult) => {
    setIsCreating(true)
    try {
      // Get practitioner
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: practitioner } = await supabase
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) throw new Error('Praticien non trouvé')

      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('*')
        .eq('practitioner_id', practitioner.id)
        .eq('patient_id', patient.id)
        .single()

      if (existingConv) {
        onCreated({ ...existingConv, patient })
        return
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          practitioner_id: practitioner.id,
          patient_id: patient.id,
          subject: `Conversation avec ${patient.first_name} ${patient.last_name}`,
        })
        .select()
        .single()

      if (error) throw error

      onCreated({ ...newConv, patient })
      toast({
        title: 'Conversation créée',
        description: `Vous pouvez maintenant échanger avec ${patient.first_name}`,
      })
    } catch (error) {
      console.error('Error creating conversation:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer la conversation',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Nouvelle conversation
          </DialogTitle>
          <DialogDescription>
            Recherchez un patient pour démarrer une conversation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un patient..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : patients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery
                  ? 'Aucun patient trouvé'
                  : 'Commencez à taper pour rechercher'}
              </div>
            ) : (
              <div className="space-y-1">
                {patients.map((patient) => (
                  <button
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    disabled={isCreating}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(patient.first_name, patient.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">
                        {patient.first_name} {patient.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {patient.email || patient.phone}
                      </p>
                    </div>
                    {isCreating && (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
