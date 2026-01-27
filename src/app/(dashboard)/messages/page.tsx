'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
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
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { getInitials } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { NewConversationModal } from '@/components/messages/new-conversation-modal'
import { QuickReplies } from '@/components/messages/quick-replies'
import type { Patient } from '@/types/database'

interface Conversation {
  id: string
  patient_id: string
  subject: string | null
  last_message_at: string
  unread_count: number
  patient: Pick<Patient, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'>
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
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [isMobileView, setIsMobileView] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  // Check for mobile view
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          patient_id,
          subject,
          last_message_at,
          unread_count,
          patient:patients (id, first_name, last_name, email, phone)
        `)
        .eq('is_archived', false)
        .order('last_message_at', { ascending: false })

      if (error) throw error
      // Transform data to fix patient array from Supabase
      const formattedData = (data || []).map((conv) => ({
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
    }
  }, [supabase, toast])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data as Message[])

      // Mark as read
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }, [supabase])

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id)
    }
  }, [selectedConversation, fetchMessages])

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    setIsSending(true)
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation.id,
        content: newMessage.trim(),
        direction: 'outgoing',
        channel: 'internal',
        status: 'sent',
        sent_at: new Date().toISOString(),
      })

      if (error) throw error

      setNewMessage('')
      await fetchMessages(selectedConversation.id)
      await fetchConversations()

      toast({
        title: 'Message envoyé',
        description: 'Votre message a été enregistré',
      })
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'envoyer le message",
      })
    } finally {
      setIsSending(false)
    }
  }

  // Send email
  const handleSendEmail = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    const patient = selectedConversation.patient
    if (!patient.email) {
      toast({
        variant: 'destructive',
        title: 'Pas d\'email',
        description: 'Ce patient n\'a pas d\'adresse email',
      })
      return
    }

    setIsSending(true)
    try {
      // Send email via API
      const response = await fetch('/api/messages/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          patientEmail: patient.email,
          patientName: `${patient.first_name} ${patient.last_name}`,
          content: newMessage.trim(),
        }),
      })

      if (!response.ok) throw new Error('Échec envoi email')

      setNewMessage('')
      await fetchMessages(selectedConversation.id)
      await fetchConversations()

      toast({
        variant: 'success',
        title: 'Email envoyé',
        description: `Email envoyé à ${patient.email}`,
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

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true
    const fullName = `${conv.patient.first_name} ${conv.patient.last_name}`.toLowerCase()
    return fullName.includes(searchQuery.toLowerCase())
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
              {getInitials(
                selectedConversation.patient.first_name,
                selectedConversation.patient.last_name
              )}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {selectedConversation.patient.first_name}{' '}
              {selectedConversation.patient.last_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedConversation.patient.email || selectedConversation.patient.phone}
            </p>
          </div>
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
          onSend={handleSendMessage}
          onSendEmail={handleSendEmail}
          isSending={isSending}
          hasEmail={!!selectedConversation.patient.email}
          onQuickReply={(content) => setNewMessage(content)}
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
            <Button size="sm" onClick={() => setShowNewModal(true)}>
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
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {getInitials(conv.patient.first_name, conv.patient.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-medium truncate">
                      {conv.patient.first_name} {conv.patient.last_name}
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
                <AvatarFallback className="bg-primary/10 text-primary font-medium">
                  {getInitials(
                    selectedConversation.patient.first_name,
                    selectedConversation.patient.last_name
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-lg">
                  {selectedConversation.patient.first_name}{' '}
                  {selectedConversation.patient.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedConversation.patient.email || selectedConversation.patient.phone}
                </p>
              </div>
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
              onSend={handleSendMessage}
              onSendEmail={handleSendEmail}
              isSending={isSending}
              hasEmail={!!selectedConversation.patient.email}
              onQuickReply={(content) => setNewMessage(content)}
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

// Message input component
function MessageInput({
  value,
  onChange,
  onSend,
  onSendEmail,
  isSending,
  hasEmail,
  onQuickReply,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  onSendEmail: () => void
  isSending: boolean
  hasEmail: boolean
  onQuickReply: (content: string) => void
}) {
  const [showQuickReplies, setShowQuickReplies] = useState(false)

  return (
    <div className="p-4 border-t bg-background">
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
        >
          <Sparkles className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <Input
            placeholder="Écrivez votre message..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            disabled={isSending}
          />
        </div>
        <Button
          onClick={onSend}
          disabled={!value.trim() || isSending}
          className="flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
        {hasEmail && (
          <Button
            variant="outline"
            onClick={onSendEmail}
            disabled={!value.trim() || isSending}
            className="flex-shrink-0 gap-1"
          >
            Email
          </Button>
        )}
      </div>
    </div>
  )
}
