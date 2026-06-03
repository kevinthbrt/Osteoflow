'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircleQuestion, X, ArrowLeft, Paperclip, Loader2, CheckCircle, Clock, Wrench, ChevronRight, Send, User, Shield } from 'lucide-react'

interface Message {
  id: string
  sender: 'user' | 'admin'
  content: string
  created_at: string
}

interface Ticket {
  id: string
  title: string
  message: string
  status: 'pending' | 'in_progress' | 'resolved'
  created_at: string
  attachment_name?: string | null
  attachment_url?: string | null
  admin_reply?: string | null
  last_admin_message_at?: string | null
  messages?: Message[]
}

const STATUS_CONFIG = {
  pending: { label: 'Reçu', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30', icon: Clock },
  in_progress: { label: 'En cours', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30', icon: Wrench },
  resolved: { label: 'Corrigé', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle },
}

const BTN = 56

function getSeenMap(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem('support_widget_seen') || '{}') } catch { return {} }
}

function markSeen(ticketId: string) {
  const map = getSeenMap()
  map[ticketId] = new Date().toISOString()
  try { localStorage.setItem('support_widget_seen', JSON.stringify(map)) } catch {}
}

function isUnread(ticket: Ticket): boolean {
  if (!ticket.last_admin_message_at) return false
  const seen = getSeenMap()
  const seenAt = seen[ticket.id]
  if (!seenAt) return true
  return new Date(ticket.last_admin_message_at) > new Date(seenAt)
}

interface SupportWidgetProps {
  userEmail?: string
}

export function SupportWidget({ userEmail }: SupportWidgetProps) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'list' | 'form' | 'success' | 'chat'>('list')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [unreadCount, setUnreadCount] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  const posRef = useRef<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('support-widget-pos')
      if (saved) {
        const p = JSON.parse(saved)
        setPos(p)
        posRef.current = p
      }
    } catch {}
  }, [])

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/support')
      if (res.ok) {
        const list: Ticket[] = (await res.json()).tickets || []
        setTickets(list)
        setUnreadCount(list.filter(isUnread).length)
        return list
      }
    } catch {}
    return []
  }

  const fetchMessages = async (ticketId: string, licenseEmail?: string) => {
    setLoadingMessages(true)
    try {
      const params = licenseEmail ? `?license_email=${encodeURIComponent(licenseEmail)}` : ''
      const res = await fetch(`/api/support/${ticketId}/messages${params}`)
      if (res.ok) {
        const data = await res.json()
        setMessages(data.messages || [])
      }
    } finally {
      setLoadingMessages(false)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    if (!open) {
      // Poll every 60s when widget is closed (for unread badge)
      pollingRef.current = setInterval(() => { fetchTickets() }, 60_000)
      fetchTickets()
    } else if (view === 'chat' && selectedTicket) {
      // Poll every 10s when chat is open
      pollingRef.current = setInterval(async () => {
        const list = await fetchTickets()
        const updated = list.find(t => t.id === selectedTicket.id)
        if (updated) {
          setSelectedTicket(updated)
          await fetchMessages(updated.id, userEmail)
        }
      }, 10_000)
      fetchTickets()
    } else {
      fetchTickets()
    }

    return () => { if (pollingRef.current) clearInterval(pollingRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, view, selectedTicket?.id])

  const openChat = async (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setView('chat')
    markSeen(ticket.id)
    setUnreadCount(prev => Math.max(0, prev - (isUnread(ticket) ? 1 : 0)))
    await fetchMessages(ticket.id, userEmail)
  }

  const sendReply = async () => {
    if (!selectedTicket || !replyText.trim() || sendingReply) return
    setSendingReply(true)
    const content = replyText.trim()
    setReplyText('')
    try {
      const res = await fetch(`/api/support/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, license_email: userEmail }),
      })
      if (res.ok) {
        const { message: newMsg } = await res.json()
        if (newMsg) setMessages(prev => [...prev, newMsg])
      }
    } finally {
      setSendingReply(false)
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = e.currentTarget.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: rect.left, origY: rect.top, moved: false }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const ds = dragRef.current
    if (!ds) return
    const dx = e.clientX - ds.startX
    const dy = e.clientY - ds.startY
    if (!ds.moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      ds.moved = true
      setDragging(true)
    }
    if (ds.moved) {
      const x = Math.max(0, Math.min(window.innerWidth - BTN, ds.origX + dx))
      const y = Math.max(0, Math.min(window.innerHeight - BTN, ds.origY + dy))
      const p = { x, y }
      posRef.current = p
      setPos(p)
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    const ds = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (!ds?.moved) {
      setOpen(o => !o)
    } else if (posRef.current) {
      try { localStorage.setItem('support-widget-pos', JSON.stringify(posRef.current)) } catch {}
    }
  }

  const btnStyle = (): React.CSSProperties =>
    posRef.current
      ? { position: 'fixed', left: posRef.current.x, top: posRef.current.y, bottom: 'auto', right: 'auto' }
      : { position: 'fixed', right: 24, bottom: 24 }

  const panelStyle = (): React.CSSProperties => {
    const PANEL_W = 360
    const GAP = 8
    const p = posRef.current ?? { x: window.innerWidth - BTN - 24, y: window.innerHeight - BTN - 24 }
    const left = Math.max(GAP, Math.min(window.innerWidth - PANEL_W - GAP, p.x + BTN - PANEL_W))
    const inBottomHalf = p.y > window.innerHeight / 2
    const vertical: React.CSSProperties = inBottomHalf
      ? { bottom: window.innerHeight - p.y + GAP, top: 'auto' }
      : { top: p.y + BTN + GAP, bottom: 'auto' }
    return { position: 'fixed', left, ...vertical, width: PANEL_W, maxHeight: 540, zIndex: 50 }
  }

  const handleSubmit = async () => {
    if (!title.trim() || !message.trim()) { setError('Titre et message requis'); return }
    setError('')
    setSubmitting(true)
    try {
      let attachment_b64: string | null = null
      let attachment_name: string | null = null
      let attachment_type: string | null = null
      let attachment_size: number | null = null

      if (file) {
        const buffer = await file.arrayBuffer()
        attachment_b64 = Buffer.from(buffer).toString('base64')
        attachment_name = file.name
        attachment_type = file.type
        attachment_size = file.size
      }

      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), message: message.trim(), user_email: userEmail, attachment_b64, attachment_name, attachment_type, attachment_size }),
      })

      if (!res.ok) { setError((await res.json()).error || 'Erreur'); return }
      setTitle(''); setMessage(''); setFile(null)
      setView('success')
      fetchTickets()
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => { setView('list'); setError(''); setTitle(''); setMessage(''); setFile(null); setSelectedTicket(null); setMessages([]) }

  void pos

  return (
    <>
      {/* FAB */}
      <button
        data-tour="support-widget"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={btnStyle()}
        className={`z-50 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 shadow-lg flex items-center justify-center transition-shadow duration-200 select-none relative ${dragging ? 'cursor-grabbing shadow-2xl scale-105' : 'cursor-grab'}`}
        title="Support"
      >
        {open && !dragging
          ? <X className="w-6 h-6 text-white pointer-events-none" />
          : <MessageCircleQuestion className="w-6 h-6 text-white pointer-events-none" />
        }
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 pointer-events-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && !dragging && (
        <div style={panelStyle()} className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-indigo-600 px-4 py-3 flex items-center gap-2 shrink-0">
            {(view === 'form' || view === 'success' || view === 'chat') && (
              <button onClick={reset} className="text-white/70 hover:text-white mr-1">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <MessageCircleQuestion className="w-5 h-5 text-white" />
            <span className="text-white font-semibold text-sm">
              {view === 'chat' && selectedTicket ? selectedTicket.title : 'Support MyOsteoFlow'}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {/* LIST */}
            {view === 'list' && (
              <div className="p-4 space-y-3">
                <button onClick={() => setView('form')}
                  className="w-full flex items-center justify-between rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 px-4 py-3 text-sm font-medium text-indigo-300 transition-colors">
                  <span>Nouveau ticket</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
                {loadingTickets ? (
                  <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
                ) : tickets.length === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-6">Aucun ticket pour l&apos;instant</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Mes demandes</p>
                    {tickets.map(t => {
                      const cfg = STATUS_CONFIG[t.status]
                      const Icon = cfg.icon
                      const unread = isUnread(t)
                      return (
                        <button key={t.id} onClick={() => openChat(t)}
                          className="w-full text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 space-y-1.5 transition-colors relative">
                          {unread && (
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500" />
                          )}
                          <div className="flex items-start justify-between gap-2 pr-4">
                            <p className="text-sm font-medium text-slate-200 leading-tight">{t.title}</p>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap shrink-0 ${cfg.color}`}>
                              <Icon className="w-3 h-3" />{cfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {new Date(t.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                            {t.attachment_name && <span className="ml-2"><Paperclip className="w-3 h-3 inline" /></span>}
                          </p>
                          {t.messages && t.messages.length > 0 && (
                            <p className="text-xs text-slate-400 truncate">
                              {t.messages[t.messages.length - 1].sender === 'admin' ? '→ ' : '← '}
                              {t.messages[t.messages.length - 1].content}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* FORM */}
            {view === 'form' && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Titre *</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Résumé de votre demande"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Description *</label>
                  <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Décrivez votre problème ou remarque..." rows={4}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none" />
                </div>
                <div>
                  <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                  {file ? (
                    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate flex-1">{file.name}</span>
                      <button onClick={() => setFile(null)} className="hover:text-red-400 shrink-0"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                      <Paperclip className="w-3.5 h-3.5" />Ajouter une pièce jointe (optionnel)
                    </button>
                  )}
                </div>
                {error && <p className="text-xs text-red-400">{error}</p>}
                <button onClick={handleSubmit} disabled={submitting}
                  className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-medium py-2.5 flex items-center justify-center gap-2 transition-colors">
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {submitting ? 'Envoi...' : 'Envoyer ma demande'}
                </button>
              </div>
            )}

            {/* SUCCESS */}
            {view === 'success' && (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400" />
                </div>
                <p className="font-semibold text-white">Demande envoyée !</p>
                <p className="text-sm text-slate-400">Nous avons bien reçu votre ticket. Vous pouvez suivre son avancement ici.</p>
                <button onClick={reset} className="text-sm text-indigo-400 hover:underline mt-1">Voir mes demandes</button>
              </div>
            )}

            {/* CHAT */}
            {view === 'chat' && selectedTicket && (
              <>
                {/* Status badge */}
                <div className="px-4 py-2 border-b border-white/10 shrink-0">
                  {(() => {
                    const cfg = STATUS_CONFIG[selectedTicket.status]
                    const Icon = cfg.icon
                    return (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                        <Icon className="w-3 h-3" />{cfg.label}
                      </span>
                    )
                  })()}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-6">Aucun message</p>
                  ) : (
                    messages.map(msg => (
                      <div key={msg.id} className={`flex gap-2 ${msg.sender === 'admin' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          msg.sender === 'admin' ? 'bg-indigo-500/30' : 'bg-white/10'
                        }`}>
                          {msg.sender === 'admin'
                            ? <Shield className="w-3 h-3 text-indigo-400" />
                            : <User className="w-3 h-3 text-slate-400" />}
                        </div>
                        <div className={`max-w-[78%] rounded-2xl px-3 py-2 ${
                          msg.sender === 'admin'
                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                            : 'bg-white/10 text-slate-200 rounded-tl-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <p className={`text-[10px] mt-1 ${msg.sender === 'admin' ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply input */}
                <div className="shrink-0 p-3 border-t border-white/10">
                  <div className="flex gap-2">
                    <textarea
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                      rows={2}
                      placeholder="Votre message… (Entrée pour envoyer)"
                      className="flex-1 px-3 py-2 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sendingReply || !replyText.trim()}
                      className="px-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors flex items-center justify-center"
                    >
                      {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
