'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  MessageCircle,
  Search,
  Plus,
  Send,
  Clock,
  CheckCheck,
  AlertCircle,
  ArrowLeft,
  Sparkles,
  Trash2,
  Loader2,
  Paperclip,
  X,
  Download,
  FileText,
  Image,
  RefreshCw,
  UserX,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { getInitials } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { NewConversationModal } from '@/components/messages/new-conversation-modal'
import { RelaunchPanel } from '@/components/messages/relaunch-panel'
import { ActiveCampaignBanner } from '@/components/messages/active-campaign-banner'
import { QuickReplies } from '@/components/messages/quick-replies'
import type { Patient } from '@/types/database'

interface Conversation {
  id: string
  patient_id: string | null
  subject: string | null
  last_message_at: string
  unread_count: number
  external_email: string | null
  external_name: string | null
  patient: Pick<Patient, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'> | null
}

// Helper functions for external/patient conversations
function getContactName(conv: Conversation): string {
  if (conv.patient) {
    return `${conv.patient.first_name} ${conv.patient.last_name}`
  }
  return conv.external_name || conv.external_email || 'Contact inconnu'
}

function getContactEmail(conv: Conversation): string | null {
  if (conv.patient) {
    return conv.patient.email || conv.patient.phone || null
  }
  return conv.external_email
}

function getContactInitials(conv: Conversation): string {
  if (conv.patient) {
    return getInitials(conv.patient.first_name, conv.patient.last_name)
  }
  if (conv.external_name) {
    const parts = conv.external_name.split(' ')
    return getInitials(parts[0] || '', parts[1] || '')
  }
  if (conv.external_email) {
    return conv.external_email.substring(0, 2).toUpperCase()
  }
  return '?'
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value?: string | null): boolean {
  if (!value) return false
  return emailRegex.test(value)
}

interface Message {
  id: string
  content: string
  direction: 'outgoing' | 'incoming'
  channel: 'email' | 'sms' | 'internal'
  status: 'draft' | 'sent' | 'delivered' | 'failed'
  sent_at: string | null
  created_at: string
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showRelaunchPanel, setShowRelaunchPanel] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  const { toast } = useToast()
  const dbRef = useRef(createClient())
  const hasLoadedRef = useRef(false)

  // Check for mobile view
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    // Only show skeletons on initial load to prevent flickering
    if (!hasLoadedRef.current) {
      setIsLoading(true)
    }
    try {
      const { data, error } = await dbRef.current
        .from('conversations')
        .select(`
          id,
          patient_id,
          subject,
          last_message_at,
          unread_count,
          external_email,
          external_name,
          patient:patients (id, first_name, last_name, email, phone)
        `)
        .eq('is_archived', false)
        .isNot('patient_id', null)
        .order('last_message_at', { ascending: false })

      if (error) throw error
      // Transform data to fix patient array from Supabase
      const formattedData = (data || []).map((conv: any) => ({
        ...conv,
        patient: Array.isArray(conv.patient) ? conv.patient[0] : conv.patient,
      }))
      setConversations(formattedData as Conversation[])
    } catch (error) {
      console.error('Error fetching conversations:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de charger les conversations',
      })
    } finally {
      setIsLoading(false)
      hasLoadedRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await dbRef.current
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data as Message[])

      // Mark as read
      await dbRef.current
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id)
    }
  }, [selectedConversation, fetchMessages])

  // Send email
  const handleSendEmail = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    const recipientEmail = getContactEmail(selectedConversation)
    const recipientName = getContactName(selectedConversation)

    if (!recipientEmail || !isValidEmail(recipientEmail)) {
      toast({
        variant: 'destructive',
        title: 'Pas d\'email',
        description: 'Ce contact n\'a pas d\'adresse email',
      })
      return
    }

    setIsSending(true)
    try {
      // Use FormData to support attachments
      const form = new FormData()
      form.append('conversationId', selectedConversation.id)
      form.append('patientEmail', recipientEmail)
      form.append('patientName', recipientName)
      form.append('content', newMessage.trim())
      attachments.forEach((f) => form.append('attachments', f))

      const response = await fetch('/api/messages/send-email', {
        method: 'POST',
        body: form,
      })

      if (!response.ok) throw new Error('Échec envoi email')

      setNewMessage('')
      setAttachments([])
      await fetchMessages(selectedConversation.id)
      await fetchConversations()

      toast({
        variant: 'success',
        title: 'Email envoyé',
        description: `Email envoyé à ${recipientEmail}`,
      })
    } catch (error) {
      console.error('Error sending email:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'envoyer l'email",
      })
    } finally {
      setIsSending(false)
    }
  }

  const handleDeleteConversation = async () => {
    if (!selectedConversation) return

    setIsDeleting(true)
    try {
      const { error: messagesError } = await dbRef.current
        .from('messages')
        .delete()
        .eq('conversation_id', selectedConversation.id)

      if (messagesError) throw messagesError

      const { error: conversationError } = await dbRef.current
        .from('conversations')
        .delete()
        .eq('id', selectedConversation.id)

      if (conversationError) throw conversationError

      setSelectedConversation(null)
      setMessages([])
      await fetchConversations()

      toast({
        variant: 'success',
        title: 'Conversation supprimée',
        description: 'La conversation a été supprimée avec succès',
      })
    } catch (error) {
      console.error('Error deleting conversation:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer la conversation',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleResync = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/emails/resync', { method: 'POST' })
      if (!res.ok) throw new Error()
      await fetch('/api/emails/check-inbox')
      await fetchConversations()
      toast({
        variant: 'success',
        title: 'Resynchronisation terminée',
        description: 'Les emails ont été re-importés avec les bons caractères.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de resynchroniser la boîte de réception.',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    // Search in patient name or external contact
    const contactName = getContactName(conv).toLowerCase()
    const contactEmail = getContactEmail(conv)?.toLowerCase() || ''
    return contactName.includes(searchLower) || contactEmail.includes(searchLower)
  })

  // Mobile: show conversation list or messages
  if (isMobileView && selectedConversation) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Mobile header */}
        <div className="flex items-center gap-3 p-4 border-b bg-background">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedConversation(null)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {getContactInitials(selectedConversation)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {getContactName(selectedConversation)}
            </p>
            <p className="text-xs text-muted-foreground">
              {getContactEmail(selectedConversation) || 'Pas d\'email'}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isDeleting}
                className="text-destructive"
                aria-label="Supprimer la conversation"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action supprimera définitivement la conversation et tous ses messages.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteConversation}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        {/* Input */}
        <MessageInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={handleSendEmail}
          isSending={isSending}
          hasEmail={isValidEmail(getContactEmail(selectedConversation))}
          previewName={getContactName(selectedConversation)}
          onQuickReply={(content) => setNewMessage(content)}
          attachments={attachments}
          onAttachmentsChange={setAttachments}
        />
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Conversation list */}
      <div className={`w-full md:w-80 lg:w-96 border-r flex flex-col ${selectedConversation && !isMobileView ? 'hidden md:flex' : ''}`}>
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Messagerie
            </h1>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleResync}
              disabled={isSyncing}
              title="Resynchroniser la boîte de réception (corrige les caractères spéciaux)"
              className="px-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRelaunchPanel(true)}
              title="Voir les patients non vus depuis longtemps et les relancer"
              className="flex-1"
            >
              <UserX className="h-4 w-4 mr-1" />
              Patients inactifs
            </Button>
            <Button size="sm" onClick={() => setShowNewModal(true)} className="flex-1">
              <Plus className="h-4 w-4 mr-1" />
              Nouveau
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un patient..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ActiveCampaignBanner />

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {searchQuery ? 'Aucune conversation trouvée' : 'Aucune conversation'}
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowNewModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Démarrer une conversation
              </Button>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b ${
                  selectedConversation?.id === conv.id ? 'bg-muted/50' : ''
                }`}
              >
                <Avatar className="h-12 w-12">
                  <AvatarFallback className={`font-medium ${conv.patient ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-600'}`}>
                    {getContactInitials(conv)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate">
                      {getContactName(conv)}
                      {!conv.patient && (
                        <span className="ml-2 text-xs text-orange-600">(externe)</span>
                      )}
                    </p>
                    {conv.unread_count > 0 && (
                      <Badge className="ml-2">{conv.unread_count}</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {conv.subject || 'Nouvelle conversation'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_message_at), {
                      addSuffix: true,
                      locale: fr,
                    })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Messages panel */}
      <div className="hidden md:flex flex-1 flex-col">
        {selectedConversation ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 p-4 border-b bg-muted/30">
              <Avatar className="h-12 w-12">
                <AvatarFallback className={`font-medium ${selectedConversation.patient ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-600'}`}>
                  {getContactInitials(selectedConversation)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-lg">
                  {getContactName(selectedConversation)}
                  {!selectedConversation.patient && (
                    <span className="ml-2 text-sm font-normal text-orange-600">(contact externe)</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {getContactEmail(selectedConversation) || 'Pas d\'email'}
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={isDeleting}
                    className="border-destructive text-destructive"
                    aria-label="Supprimer la conversation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action supprimera définitivement la conversation et tous ses messages.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteConversation}>
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Sparkles className="h-12 w-12 text-primary/50 mb-4" />
                  <p className="text-muted-foreground">
                    Démarrez la conversation en envoyant un message
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
            </div>

            {/* Input */}
            <MessageInput
              value={newMessage}
              onChange={setNewMessage}
              onSend={handleSendEmail}
              isSending={isSending}
              hasEmail={isValidEmail(getContactEmail(selectedConversation))}
              previewName={getContactName(selectedConversation)}
              onQuickReply={(content) => setNewMessage(content)}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Sélectionnez une conversation
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Ou créez-en une nouvelle
              </p>
            </div>
          </div>
        )}
      </div>

      {/* New conversation modal */}
      <NewConversationModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
        onCreated={(conv) => {
          setShowNewModal(false)
          fetchConversations()
          setSelectedConversation(conv as Conversation)
        }}
      />

      <RelaunchPanel open={showRelaunchPanel} onOpenChange={setShowRelaunchPanel} />

    </div>
  )
}

function MessageAttachments({ messageId, isOutgoing }: { messageId: string; isOutgoing: boolean }) {
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; mime_type: string; file_size: number }>>([])

  useEffect(() => {
    fetch(`/api/messages/attachments?message_id=${messageId}`)
      .then((r) => r.ok ? r.json() : { attachments: [] })
      .then((d) => setAttachments(d.attachments || []))
      .catch(() => {})
  }, [messageId])

  if (attachments.length === 0) return null

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {attachments.map((a) => {
        const isImage = a.mime_type.startsWith('image/')
        const size = a.file_size < 1024 * 1024
          ? `${(a.file_size / 1024).toFixed(0)} Ko`
          : `${(a.file_size / (1024 * 1024)).toFixed(1)} Mo`
        return (
          <a
            key={a.id}
            href={`/api/messages/attachments/${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-black/5 ${
              isOutgoing ? 'border-primary-foreground/30 text-primary-foreground' : 'border-border text-foreground'
            }`}
          >
            {isImage ? <Image className="h-3.5 w-3.5 shrink-0" /> : <FileText className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate max-w-[140px]">{a.filename}</span>
            <span className={`shrink-0 ${isOutgoing ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{size}</span>
            <Download className="h-3 w-3 shrink-0 opacity-60" />
          </a>
        )
      })}
    </div>
  )
}

// Message bubble component
function MessageBubble({ message }: { message: Message }) {
  const isOutgoing = message.direction === 'outgoing'

  const statusIcon = () => {
    switch (message.status) {
      case 'sent':
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-primary" />
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-destructive" />
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />
    }
  }

  return (
    <div className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOutgoing
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted rounded-bl-sm'
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        <MessageAttachments messageId={message.id} isOutgoing={isOutgoing} />
        <div
          className={`flex items-center gap-1 mt-1 text-xs ${
            isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`}
        >
          {message.channel === 'email' && (
            <Badge variant="outline" className="h-4 text-[10px] px-1">
              Email
            </Badge>
          )}
          <span>
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true,
              locale: fr,
            })}
          </span>
          {isOutgoing && statusIcon()}
        </div>
      </div>
    </div>
  )
}

function AttachmentPill({ file, onRemove }: { file: File; onRemove: () => void }) {
  const isImage = file.type.startsWith('image/')
  const size = file.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(0)} Ko`
    : `${(file.size / (1024 * 1024)).toFixed(1)} Mo`

  return (
    <div className="flex items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs max-w-[180px]">
      {isImage ? <Image className="h-3 w-3 shrink-0 text-blue-500" /> : <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />}
      <span className="truncate text-foreground">{file.name}</span>
      <span className="text-muted-foreground shrink-0">{size}</span>
      <button onClick={onRemove} className="shrink-0 text-muted-foreground hover:text-destructive">
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}

// Message input component
function MessageInput({
  value,
  onChange,
  onSend,
  isSending,
  hasEmail,
  previewName,
  onQuickReply,
  attachments,
  onAttachmentsChange,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  isSending: boolean
  hasEmail: boolean
  previewName?: string
  onQuickReply: (content: string) => void
  attachments: File[]
  onAttachmentsChange: (files: File[]) => void
}) {
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewContent = value.trim() || 'Votre message apparaîtra ici.'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    onAttachmentsChange([...attachments, ...files])
    e.target.value = ''
  }

  const removeAttachment = (index: number) => {
    onAttachmentsChange(attachments.filter((_, i) => i !== index))
  }

  const canSend = (value.trim() || attachments.length > 0) && !isSending && hasEmail

  return (
    <div className="p-4 border-t bg-background">
      <div className="mb-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
          Prévisualisation
        </p>
        <p className="mt-2 whitespace-pre-wrap text-foreground">{previewContent}</p>
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {attachments.map((f, i) => (
              <AttachmentPill key={i} file={f} onRemove={() => removeAttachment(i)} />
            ))}
          </div>
        )}
      </div>
      {showQuickReplies && (
        <QuickReplies
          onSelect={(content) => {
            onQuickReply(content)
            setShowQuickReplies(false)
          }}
          onClose={() => setShowQuickReplies(false)}
        />
      )}
      <div className="flex items-end gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          className="flex-shrink-0"
          title="Réponses rapides"
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSending}
          className="flex-shrink-0 relative"
          title="Joindre un fichier"
        >
          <Paperclip className="h-4 w-4" />
          {attachments.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-medium">
              {attachments.length}
            </span>
          )}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        />
        <div className="flex-1">
          <Textarea
            placeholder="Écrivez votre message..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={isSending}
            rows={3}
          />
        </div>
        <Button
          onClick={onSend}
          disabled={!canSend}
          className="flex-shrink-0"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
