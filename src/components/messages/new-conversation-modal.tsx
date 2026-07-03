'use client'

import { useState, useEffect, useRef } from 'react'
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
import { Progress } from '@/components/ui/progress'
import { Search, MessageCircle, Loader2, Mail, User, Send, Users, ArrowLeft, Sparkles } from 'lucide-react'
import { getInitials } from '@/lib/utils'
import { buildSearchOrFilters } from '@/lib/utils/search'
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
  const [broadcastActiveSinceDate, setBroadcastActiveSinceDate] = useState('')
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [broadcastCampaign, setBroadcastCampaign] = useState<{
    status: string
    total: number
    sent: number
    failed: number
    dailyLimitReached?: boolean
  } | null>(null)
  const [broadcastDeduplicated, setBroadcastDeduplicated] = useState(0)
  const [broadcastPreview, setBroadcastPreview] = useState<{
    totalPatients: number
    totalEmails: number
    deduplicated: number
  } | null>(null)
  const [isLoadingBroadcastPreview, setIsLoadingBroadcastPreview] = useState(false)

  const { toast } = useToast()
  const dbRef = useRef(createClient())
  const broadcastPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (broadcastPollRef.current) clearInterval(broadcastPollRef.current)
    }
  }, [])

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
      setBroadcastActiveSinceDate('')
      setShowQuickReplies(false)
      setBroadcastCampaign(null)
      setBroadcastDeduplicated(0)
      setBroadcastPreview(null)
      if (broadcastPollRef.current) clearInterval(broadcastPollRef.current)
    }
  }, [open])

  // Live preview of how many emails a broadcast will actually send —
  // recomputed whenever the "active since" filter changes.
  useEffect(() => {
    if (!showBroadcast) return
    let cancelled = false
    setIsLoadingBroadcastPreview(true)
    const params = broadcastActiveSinceDate ? `?activeSinceDate=${broadcastActiveSinceDate}` : ''
    fetch(`/api/messages/broadcast/recipient-count${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setBroadcastPreview(data)
      })
      .catch((error) => console.error('Error fetching broadcast preview:', error))
      .finally(() => {
        if (!cancelled) setIsLoadingBroadcastPreview(false)
      })
    return () => {
      cancelled = true
    }
  }, [showBroadcast, broadcastActiveSinceDate])

  const searchPatients = useDebouncedCallback(async (query: string) => {
    if (!query.trim()) {
      setPatients([])
      return
    }

    setIsLoading(true)
    try {
      let builder = dbRef.current
        .from('patients')
        .select('id, first_name, last_name, email, phone')
        .is('archived_at', null)

      for (const filter of buildSearchOrFilters(query, ['first_name', 'last_name', 'email'])) {
        builder = builder.or(filter)
      }

      const { data, error } = await builder.limit(10)

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
      const { data: { user } } = await dbRef.current.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: practitioner } = await dbRef.current
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) throw new Error('Praticien non trouvé')

      // Check if conversation already exists
      const { data: existingConv } = await dbRef.current
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
      const { data: newConv, error } = await dbRef.current
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
      const { data: { user } } = await dbRef.current.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      const { data: practitioner } = await dbRef.current
        .from('practitioners')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!practitioner) throw new Error('Praticien non trouvé')

      // Check if a patient exists with this email
      const { data: existingPatient } = await dbRef.current
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
        const { data: existingConv } = await dbRef.current
          .from('conversations')
          .select('id')
          .eq('practitioner_id', practitioner.id)
          .eq('patient_id', existingPatient.id)
          .single()

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const { data: newConv, error } = await dbRef.current
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
        const { data: existingExtConv } = await dbRef.current
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
          const { data: newExtConv, error: extError } = await dbRef.current
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
      const { data: fullConv } = await dbRef.current
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

  const pollBroadcastCampaign = (campaignId: string) => {
    if (broadcastPollRef.current) clearInterval(broadcastPollRef.current)
    broadcastPollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages/campaigns/${campaignId}`)
        const data = await res.json()
        if (!res.ok) return
        setBroadcastCampaign(data)
        if (data.status === 'completed' || data.status === 'failed' || data.status === 'cancelled') {
          if (broadcastPollRef.current) clearInterval(broadcastPollRef.current)
          setIsBroadcasting(false)
          if (data.status === 'completed') {
            toast({
              variant: 'success',
              title: 'Diffusion terminée',
              description: `${data.sent}/${data.total} email(s) envoyé(s)${data.failed ? `, ${data.failed} échec(s)` : ''}`,
            })
          } else if (data.status === 'failed') {
            toast({
              variant: 'destructive',
              title: 'Diffusion échouée',
              description: data.errorMessage || 'Erreur lors de la diffusion',
            })
          }
        } else if (data.dailyLimitReached) {
          // Gmail's daily cap is reached — stop polling for now, sending
          // resumes automatically tomorrow via the background cron.
          if (broadcastPollRef.current) clearInterval(broadcastPollRef.current)
          setIsBroadcasting(false)
        }
      } catch (error) {
        console.error('Error polling broadcast campaign:', error)
      }
    }, 1500)
  }

  // A campaign paused for the day (Gmail's daily cap) is no longer "isBroadcasting"
  // (polling stopped) but still has recipients left — don't let a fresh click
  // start a second, duplicate campaign on top of it.
  const hasUnfinishedBroadcast = Boolean(
    broadcastCampaign && !['completed', 'failed', 'cancelled'].includes(broadcastCampaign.status)
  )

  const handleBroadcast = async () => {
    if (!broadcastContent.trim()) return
    setIsBroadcasting(true)
    setBroadcastCampaign(null)
    try {
      const res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: broadcastContent, activeSinceDate: broadcastActiveSinceDate || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: data.error || 'Erreur lors de la diffusion',
        })
        setIsBroadcasting(false)
        return
      }

      // Sending happens in the background — poll for progress instead of
      // waiting on a single request that could take minutes for large lists.
      setBroadcastCampaign({ status: 'pending', total: data.total, sent: 0, failed: 0 })
      setBroadcastDeduplicated(data.deduplicated || 0)
      pollBroadcastCampaign(data.campaignId)
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de diffuser le message',
      })
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

            <div className="space-y-1.5">
              <Label htmlFor="broadcast-active-since" className="text-xs font-normal text-muted-foreground">
                Envoyer uniquement aux patients actifs depuis le (optionnel)
              </Label>
              <Input
                id="broadcast-active-since"
                type="date"
                value={broadcastActiveSinceDate}
                onChange={(e) => setBroadcastActiveSinceDate(e.target.value)}
                disabled={isBroadcasting}
                className="w-40 h-8"
              />
              <p className="text-xs text-muted-foreground">
                Pour éviter de contacter d&apos;anciens patients non revus depuis longtemps.
              </p>
            </div>

            <div className="rounded-lg border p-3 text-sm bg-muted/30">
              {isLoadingBroadcastPreview ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Calcul du nombre de destinataires…
                </span>
              ) : broadcastPreview ? (
                broadcastPreview.totalEmails === 0 ? (
                  <span className="text-muted-foreground">Aucun patient ne correspond à ce filtre.</span>
                ) : (
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      Ce message sera envoyé à{' '}
                      <span className="text-primary">{broadcastPreview.totalEmails} email{broadcastPreview.totalEmails > 1 ? 's' : ''}</span>
                      {' '}({broadcastPreview.totalPatients} patient{broadcastPreview.totalPatients > 1 ? 's' : ''})
                    </p>
                    {broadcastPreview.deduplicated > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {broadcastPreview.deduplicated} patient{broadcastPreview.deduplicated > 1 ? 's' : ''} partage{broadcastPreview.deduplicated > 1 ? 'nt' : ''} une adresse avec un autre — un seul email envoyé par adresse.
                      </p>
                    )}
                  </div>
                )
              ) : null}
            </div>

            {broadcastCampaign && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {broadcastCampaign.status === 'completed'
                      ? 'Diffusion terminée'
                      : broadcastCampaign.status === 'failed'
                      ? 'Échec de la diffusion'
                      : broadcastCampaign.dailyLimitReached
                      ? 'En pause — limite quotidienne atteinte'
                      : 'Envoi en cours en arrière-plan…'}
                  </span>
                  <span className="text-muted-foreground">
                    {broadcastCampaign.sent}/{broadcastCampaign.total}
                  </span>
                </div>
                <Progress
                  value={broadcastCampaign.total > 0 ? (broadcastCampaign.sent / broadcastCampaign.total) * 100 : 0}
                />
                {broadcastCampaign.dailyLimitReached && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Gmail limite l&apos;envoi à 450 emails par jour. Il reste {broadcastCampaign.total - broadcastCampaign.sent - broadcastCampaign.failed} patient(s) à contacter — l&apos;envoi reprendra automatiquement demain jusqu&apos;à ce que tout le monde soit contacté.
                  </p>
                )}
                {broadcastDeduplicated > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {broadcastDeduplicated} patient{broadcastDeduplicated > 1 ? 's' : ''} partage{broadcastDeduplicated > 1 ? 'nt' : ''} une adresse email avec un autre — un seul email envoyé par adresse.
                  </p>
                )}
                {isBroadcasting && (
                  <p className="text-xs text-muted-foreground">
                    Vous pouvez fermer cette fenêtre, l&apos;envoi continue en arrière-plan.
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => (isBroadcasting || hasUnfinishedBroadcast ? onOpenChange(false) : setShowBroadcast(false))}
              >
                {isBroadcasting || hasUnfinishedBroadcast ? 'Fermer' : 'Retour'}
              </Button>
              <Button
                onClick={handleBroadcast}
                disabled={
                  isBroadcasting ||
                  hasUnfinishedBroadcast ||
                  !broadcastContent.trim() ||
                  broadcastPreview?.totalEmails === 0
                }
              >
                {isBroadcasting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Envoyer à tous{broadcastPreview ? ` (${broadcastPreview.totalEmails})` : ''}
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
