'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/db/client'
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
import { Search, MessageCircle, Loader2, Mail, User, Send, Users, ArrowLeft, Sparkles } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'
import { QuickReplies } from '@/components/messages/quick-replies'
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

  // Broadcast state
  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastContent, setBroadcastContent] = useState('')
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)

  const { toast } = useToast()
  const db = createClient()

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      setPatients([])
      setManualEmail('')
      setManualName('')
      setManualMessage('')
      setActiveTab('patient')
      setShowBroadcast(false)
      setBroadcastContent('')
      setShowQuickReplies(false)
    }
  }, [open])

  const searchPatients = useDebouncedCallback(async (query: string) => {
    if (!query.trim()) {
      setPatients([])
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await db
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
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: practitioner } = await db
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) throw new Error('Praticien non trouvé')

      // Check if conversation already exists
      const { data: existingConv } = await db
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
      const { data: newConv, error } = await db
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
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: practitioner } = await db
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) throw new Error('Praticien non trouvé')

      // Check if a patient exists with this email
      const { data: existingPatient } = await db
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
        const { data: existingConv } = await db
          .from('conversations')
          .select('id')
          .eq('practitioner_id', practitioner.id)
          .eq('patient_id', existingPatient.id)
          .single()

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const { data: newConv, error } = await db
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
        // No patient found - check for existing external conversation or create one
        const { data: existingExtConv } = await db
          .from('conversations')
          .select('id')
          .eq('practitioner_id', practitioner.id)
          .eq('external_email', manualEmail)
          .is('patient_id', null)
          .single()

        if (existingExtConv) {
          conversationId = existingExtConv.id
        } else {
          // Create external conversation
          const { data: newExtConv, error: extError } = await db
            .from('conversations')
            .insert({
              practitioner_id: practitioner.id,
              patient_id: null,
              external_email: manualEmail,
              external_name: manualName || manualEmail.split('@')[0],
              subject: `Conversation avec ${manualName || manualEmail}`,
            })
            .select('id')
            .single()

          if (extError) throw extError
          conversationId = newExtConv.id
        }

        patientData = {
          id: '',
          first_name: manualName || manualEmail.split('@')[0],
          last_name: '',
          email: manualEmail,
        }
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
      const { data: fullConv } = await db
        .from('conversations')
        .select('*, external_email, external_name, patient:patients(*)')
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

  const handleBroadcast = async () => {
    if (!broadcastContent.trim()) return
    setIsBroadcasting(true)
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: broadcastContent }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: data.error || 'Erreur lors de la diffusion',
        })
      } else {
        toast({
          variant: 'success',
          title: 'Diffusion envoyée',
          description: `${data.sent}/${data.total} email(s) envoyé(s)`,
        })
        onOpenChange(false)
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de diffuser le message',
      })
    } finally {
      setIsBroadcasting(false)
    }
  }

  // Broadcast compose view
  if (showBroadcast) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setShowBroadcast(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Users className="h-5 w-5 text-primary" />
              Diffuser à tous les patients
            </DialogTitle>
            <DialogDescription>
              Envoyer un email à tous vos patients actifs ayant une adresse email.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {showQuickReplies && (
              <QuickReplies
                onSelect={(content) => {
                  setBroadcastContent(content)
                  setShowQuickReplies(false)
                }}
                onClose={() => setShowQuickReplies(false)}
              />
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQuickReplies(!showQuickReplies)}
              >
                <Sparkles className="h-4 w-4 mr-1" />
                Modèles
              </Button>
            </div>

            <Textarea
              placeholder="Votre message..."
              value={broadcastContent}
              onChange={(e) => setBroadcastContent(e.target.value)}
              rows={6}
              disabled={isBroadcasting}
            />

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowBroadcast(false)}
                disabled={isBroadcasting}
              >
                Retour
              </Button>
              <Button
                onClick={handleBroadcast}
                disabled={isBroadcasting || !broadcastContent.trim()}
              >
                {isBroadcasting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Envoyer à tous
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
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
              {/* Broadcast option */}
              <button
                onClick={() => setShowBroadcast(true)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed border-primary/30 hover:bg-primary/5 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary">Envoyer à tous les patients</p>
                  <p className="text-sm text-muted-foreground">
                    Diffuser un message à tous vos patients
                  </p>
                </div>
              </button>

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
              <div className="h-56 overflow-y-auto border rounded-lg">
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
                  <strong>Astuce :</strong> Si l'email correspond à un patient, la conversation sera liée à sa fiche.
                  Sinon, un contact externe sera créé automatiquement.
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
