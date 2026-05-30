'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  FileText,
  Printer,
  Trash2,
  Send,
  Clock,
  User,
  ChevronRight,
  ChevronsUpDown,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/db/client'
import { GenerateLetterModal } from '@/components/communication/generate-letter-modal'
import type { GenerateLetterModalProps } from '@/components/communication/generate-letter-modal'

const TEMPLATE_CARDS = [
  {
    id: 'referral' as const,
    name: "Courrier d'adressage",
    description: 'Adresser un patient à un confrère ou spécialiste avec résumé clinique',
    icon: Send,
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    iconColor: 'text-blue-600 bg-blue-100',
    category: 'Consultation',
  },
  {
    id: 'attestation_consultation' as const,
    name: 'Attestation de consultation',
    description: 'Attester la présence du patient, sans contenu médical',
    icon: FileText,
    color: 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
    iconColor: 'text-emerald-600 bg-emerald-100',
    category: 'Attestation',
  },
]

type TemplateId = (typeof TEMPLATE_CARDS)[number]['id']

interface SavedLetter {
  id: string
  template_id: string
  template_name: string
  header: string
  body: string
  patient_id: string | null
  consultation_id: string | null
  recipient_name: string | null
  recipient_title: string | null
  created_at: string
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  gender: string
  date_of_birth: string | null
}

interface Practitioner {
  id: string
  first_name: string
  last_name: string
  profession: string | null
  specialty: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  phone: string | null
  email: string | null
  rpps: string | null
  rpe: string | null
  rne: string | null
}

interface Consultation {
  id: string
  date_time: string
  reason: string
  anamnesis: string | null
  examination: string | null
  advice: string | null
}

export default function CommunicationPage() {
  const [letters, setLetters] = useState<SavedLetter[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>('referral')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [patientDropdownOpen, setPatientDropdownOpen] = useState(false)
  const [patientSearch, setPatientSearch] = useState('')
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [selectedConsultationId, setSelectedConsultationId] = useState<string>('')
  const [loadingConsultations, setLoadingConsultations] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const db = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [lettersRes, practRes, patientsRes] = await Promise.all([
        fetch('/api/communication/letters'),
        db.from('practitioners').select('*').single(),
        db.from('patients')
          .select('id, first_name, last_name, gender, date_of_birth')
          .is('archived_at', null)
          .order('last_name', { ascending: true }),
      ])

      if (lettersRes.ok) {
        const data = await lettersRes.json()
        setLetters(data.letters ?? [])
      }
      if (practRes.data) setPractitioner(practRes.data as Practitioner)
      if (patientsRes.data) setPatients(patientsRes.data as Patient[])
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadData() }, [loadData])

  // Charge les consultations quand le patient change
  useEffect(() => {
    if (!selectedPatient) {
      setConsultations([])
      setSelectedConsultationId('')
      return
    }
    setLoadingConsultations(true)
    db.from('consultations')
      .select('id, date_time, reason, anamnesis, examination, advice')
      .eq('patient_id', selectedPatient.id)
      .is('archived_at', null)
      .order('date_time', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        const list = (data as Consultation[]) ?? []
        setConsultations(list)
        setSelectedConsultationId(list[0]?.id ?? '')
        setLoadingConsultations(false)
      })
  }, [selectedPatient]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPatients = patientSearch.trim()
    ? patients.filter((p) => {
        const s = patientSearch.toLowerCase()
        return p.last_name.toLowerCase().includes(s) || p.first_name.toLowerCase().includes(s)
      })
    : patients

  const handleOpenModal = (templateId: TemplateId) => {
    setSelectedTemplateId(templateId)
    setModalOpen(true)
  }

  const selectedConsultation = consultations.find((c) => c.id === selectedConsultationId) ?? null

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce courrier ?')) return
    setDeletingId(id)
    try {
      await fetch(`/api/communication/letters/${id}`, { method: 'DELETE' })
      setLetters((prev) => prev.filter((l) => l.id !== id))
    } finally {
      setDeletingId(null)
    }
  }

  const modalProps: GenerateLetterModalProps | null =
    practitioner && selectedPatient
      ? {
          open: modalOpen,
          onClose: () => { setModalOpen(false); loadData() },
          patient: selectedPatient,
          practitioner,
          consultation: selectedConsultation
            ? {
                id: selectedConsultation.id,
                date_time: selectedConsultation.date_time,
                reason: selectedConsultation.reason,
                anamnesis: selectedConsultation.anamnesis,
                examination: selectedConsultation.examination,
                advice: selectedConsultation.advice,
              }
            : undefined,
          defaultTemplateId: selectedTemplateId,
        }
      : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <FileText className="h-8 w-8" />
          Communication
        </h1>
        <p className="text-muted-foreground mt-1">
          Générez des courriers professionnels à partir de vos consultations.
        </p>
      </div>

      {/* Template cards */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Nouveau courrier</h2>

        {/* Sélection patient — combobox avec recherche intégrée */}
        <div className="mb-5 space-y-2">
          {patients.length > 0 && (
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <label className="text-sm text-muted-foreground whitespace-nowrap">Patient :</label>
              <Popover
                open={patientDropdownOpen}
                onOpenChange={(open) => {
                  setPatientDropdownOpen(open)
                  if (!open) setPatientSearch('')
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={patientDropdownOpen}
                    className="w-64 justify-between font-normal"
                  >
                    {selectedPatient
                      ? `${selectedPatient.last_name} ${selectedPatient.first_name}`
                      : 'Sélectionner un patient…'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="Rechercher…"
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {filteredPatients.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">Aucun patient trouvé.</p>
                    ) : (
                      filteredPatients.map((p) => (
                        <button
                          key={p.id}
                          className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent flex items-center gap-2 ${
                            selectedPatient?.id === p.id ? 'bg-accent/50' : ''
                          }`}
                          onClick={() => {
                            setSelectedPatient(p)
                            setPatientDropdownOpen(false)
                            setPatientSearch('')
                          }}
                        >
                          <Check
                            className={`h-4 w-4 flex-shrink-0 ${
                              selectedPatient?.id === p.id ? 'opacity-100' : 'opacity-0'
                            }`}
                          />
                          {p.last_name} {p.first_name}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Sélection consultation */}
          {selectedPatient && (
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <label className="text-sm text-muted-foreground whitespace-nowrap">Consultation :</label>
              {loadingConsultations ? (
                <span className="text-sm text-muted-foreground">Chargement…</span>
              ) : consultations.length === 0 ? (
                <span className="text-sm text-muted-foreground italic">Aucune consultation</span>
              ) : (
                <select
                  className="text-sm border rounded-md px-3 py-1.5 bg-background flex-1 max-w-sm"
                  value={selectedConsultationId}
                  onChange={(e) => setSelectedConsultationId(e.target.value)}
                >
                  <option value="">Sans consultation (attestation simple)</option>
                  {consultations.map((c) => (
                    <option key={c.id} value={c.id}>
                      {new Date(c.date_time).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'long', year: 'numeric',
                      })} — {c.reason}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
          {TEMPLATE_CARDS.map((tpl) => (
            <button
              key={tpl.id}
              onClick={() => handleOpenModal(tpl.id)}
              disabled={!selectedPatient || !practitioner}
              className={`relative text-left rounded-xl border p-5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${tpl.color}`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${tpl.iconColor}`}>
                <tpl.icon className="h-5 w-5" />
              </div>
              <Badge variant="outline" className="text-xs mb-2">{tpl.category}</Badge>
              <p className="font-semibold text-sm mb-1">{tpl.name}</p>
              <p className="text-xs text-muted-foreground leading-snug">{tpl.description}</p>
              <ChevronRight className="absolute top-4 right-4 h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>

        {!practitioner && (
          <p className="text-sm text-amber-600 mt-2">
            Configurez votre profil praticien dans les{' '}
            <Link href="/settings" className="underline">paramètres</Link>{' '}
            pour générer des courriers.
          </p>
        )}
      </section>

      <Separator />

      {/* Courriers sauvegardés */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Courriers sauvegardés</h2>
          <Badge variant="secondary">{letters.length}</Badge>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : letters.length === 0 ? (
          <Card className="bg-muted/30">
            <CardContent className="py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">
                Aucun courrier sauvegardé. Générez votre premier courrier ci-dessus.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {letters.map((letter) => (
              <Card key={letter.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{letter.template_name}</CardTitle>
                      <CardDescription className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(letter.created_at).toLocaleDateString('fr-FR', {
                            day: 'numeric', month: 'long', year: 'numeric',
                          })}
                        </span>
                        {(letter.recipient_title || letter.recipient_name) && (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            {[letter.recipient_title, letter.recipient_name].filter(Boolean).join(' ')}
                          </span>
                        )}
                        {letter.consultation_id && (
                          <Link
                            href={`/consultations/${letter.consultation_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            Voir consultation
                          </Link>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/communication/letters/${letter.id}/pdf`, '_blank')}
                      >
                        <Printer className="h-3.5 w-3.5 mr-1.5" />
                        Imprimer
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(letter.id)}
                        disabled={deletingId === letter.id}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground font-mono line-clamp-2">
                    {letter.body.substring(0, 150)}…
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Modal */}
      {modalProps && <GenerateLetterModal {...modalProps} />}
    </div>
  )
}
