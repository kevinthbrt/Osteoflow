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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Search, MessageCircle, Loader2, Mail, User, Send } from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState('patient')

  // Manual email form
  const [manualEmail, setManualEmail] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualMessage, setManualMessage] = useState('')
  const [isSendingManual, setIsSendingManual] = useState(false)

  const { toast } = useToast()
  const supabase = createClient()

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setPatients([])
      setManualEmail('')
      setManualName('')
      setManualMessage('')
      setActiveTab('patient')
    }
  }, [open])

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
        .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
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
    if (activeTab === 'patient') {
      searchPatients(searchQuery)
    }
  }, [searchQuery, searchPatients, activeTab])

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
        onOpenChange(false)
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
      onOpenChange(false)
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

  const handleSendManualEmail = async () => {
    if (!manualEmail || !manualMessage) {
      toast({
        variant: 'destructive',
        title: 'Champs requis',
        description: 'Veuillez remplir l\'email et le message',
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(manualEmail)) {
      toast({
        variant: 'destructive',
        title: 'Email invalide',
        description: 'Veuillez saisir une adresse email valide',
      })
      return
    }

    setIsSendingManual(true)
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

      // Check if a patient exists with this email
      const { data: existingPatient } = await supabase
        .from('patients')
        .select('id, first_name, last_name')
        .eq('practitioner_id', practitioner.id)
        .eq('email', manualEmail)
        .single()

      let conversationId: string
      let patientData: { id: string; first_name: string; last_name: string; email: string }

      if (existingPatient) {
        // Use existing patient
        patientData = { ...existingPatient, email: manualEmail }

        // Check/create conversation
        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('practitioner_id', practitioner.id)
          .eq('patient_id', existingPatient.id)
          .single()

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const { data: newConv, error } = await supabase
            .from('conversations')
            .insert({
              practitioner_id: practitioner.id,
              patient_id: existingPatient.id,
              subject: `Conversation avec ${existingPatient.first_name} ${existingPatient.last_name}`,
            })
            .select('id')
            .single()

          if (error) throw error
          conversationId = newConv.id
        }
      } else {
        // Create a temporary/external conversation without patient link
        // We'll need a special handling - for now, show error and suggest creating patient
        toast({
          variant: 'destructive',
          title: 'Patient non trouvé',
          description: 'Créez d\'abord ce patient dans votre base pour pouvoir lui envoyer des messages suivis.',
        })
        setIsSendingManual(false)
        return
      }

      // Send the email via API
      const response = await fetch('/api/messages/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          patientEmail: manualEmail,
          patientName: manualName || patientData.first_name,
          content: manualMessage,
        }),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi')
      }

      toast({
        variant: 'success',
        title: 'Email envoyé',
        description: `Message envoyé à ${manualEmail}`,
      })

      // Fetch the full conversation and return it
      const { data: fullConv } = await supabase
        .from('conversations')
        .select('*, patient:patients(*)')
        .eq('id', conversationId)
        .single()

      if (fullConv) {
        onCreated(fullConv)
      }

      onOpenChange(false)
    } catch (error) {
      console.error('Error sending manual email:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'envoyer l\'email',
      })
    } finally {
      setIsSendingManual(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Nouveau message
          </DialogTitle>
          <DialogDescription>
            Envoyez un message à un patient ou à une adresse email
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="patient" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Patient
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email direct
            </TabsTrigger>
          </TabsList>

          {/* Patient Search Tab */}
          <TabsContent value="patient" className="mt-4">
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un patient..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus={activeTab === 'patient'}
                />
              </div>

              {/* Fixed height container to prevent jumping */}
              <div className="h-64 overflow-y-auto border rounded-lg">
                {isLoading ? (
                  <div className="p-2 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : patients.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    {searchQuery
                      ? 'Aucun patient trouvé'
                      : 'Tapez pour rechercher un patient'}
                  </div>
                ) : (
                  <div className="p-1">
                    {patients.map((patient) => (
                      <button
                        key={patient.id}
                        onClick={() => handleSelectPatient(patient)}
                        disabled={isCreating}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50"
                      >
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {getInitials(patient.first_name, patient.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {patient.email || patient.phone || 'Pas d\'email'}
                          </p>
                        </div>
                        {isCreating && (
                          <Loader2 className="h-4 w-4 animate-spin text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Manual Email Tab */}
          <TabsContent value="email" className="mt-4">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manual-email">Adresse email *</Label>
                  <Input
                    id="manual-email"
                    type="email"
                    placeholder="patient@exemple.com"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    autoFocus={activeTab === 'email'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-name">Nom du destinataire</Label>
                  <Input
                    id="manual-name"
                    placeholder="Jean Dupont"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="manual-message">Message *</Label>
                <Textarea
                  id="manual-message"
                  placeholder="Votre message..."
                  rows={5}
                  value={manualMessage}
                  onChange={(e) => setManualMessage(e.target.value)}
                />
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
                <p>
                  <strong>Note :</strong> L'email doit correspondre à un patient existant
                  dans votre base pour que la conversation soit enregistrée.
                </p>
              </div>

              <Button
                onClick={handleSendManualEmail}
                disabled={isSendingManual || !manualEmail || !manualMessage}
                className="w-full"
              >
                {isSendingManual ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Envoyer l'email
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
