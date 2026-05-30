import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/db/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, Calendar, FileText, Phone, Mail, Briefcase, Cake } from 'lucide-react'
import { formatDate, formatPhone, calculateAge } from '@/lib/utils'
import { ConsultationTimeline } from '@/components/consultations/consultation-timeline'
import { MedicalHistorySectionWrapper } from '@/components/patients/medical-history-section-wrapper'
import { DraftResumeBanner } from '@/components/consultations/draft-resume-banner'
import { ExercisePrescriptionSection } from '@/components/exercises/exercise-prescription-section'
import { UnarchiveButton } from '@/components/patients/unarchive-button'

interface PatientPageProps {
  params: Promise<{ id: string }>
}

export default async function PatientPage({ params }: PatientPageProps) {
  const { id } = await params
  const db = await createClient()

  const { data: patient, error } = await db
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !patient) {
    notFound()
  }

  // Get consultations with invoices
  const { data: consultations } = await db
    .from('consultations')
    .select(`
      *,
      invoices (*)
    `)
    .eq('patient_id', id)
    .order('date_time', { ascending: false })

  // Get medical history entries
  const { data: medicalHistoryEntries } = await db
    .from('medical_history_entries')
    .select('*')
    .eq('patient_id', id)
    .order('display_order', { ascending: true })

  const today = new Date()
  const birthDate = new Date(patient.birth_date)
  const isBirthday = today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate()

  return (
    <div className="space-y-6">
      <DraftResumeBanner patientId={id} />
      {isBirthday && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800/40">
          <div className="w-8 h-8 rounded-lg bg-pink-100 dark:bg-pink-800/40 flex items-center justify-center shrink-0">
            <Cake className="h-4 w-4 text-pink-600 dark:text-pink-400" />
          </div>
          <p className="text-sm font-medium text-pink-800 dark:text-pink-300">
            🎂 C'est l'anniversaire de {patient.first_name} aujourd'hui ! {calculateAge(patient.birth_date)} ans.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/patients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {patient.last_name} {patient.first_name}
              </h1>
              <Badge variant={patient.gender === 'M' ? 'default' : 'secondary'}>
                {patient.gender === 'M' ? 'Homme' : 'Femme'}
              </Badge>
              {patient.archived_at && (
                <Badge variant="outline">Archivé</Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {calculateAge(patient.birth_date)} ans - né(e) le {formatDate(patient.birth_date)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {patient.archived_at && (
            <UnarchiveButton
              patientId={id}
              patientName={`${patient.first_name} ${patient.last_name}`}
            />
          )}
          <Button variant="outline" asChild>
            <Link href={`/patients/${id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Modifier
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/patients/${id}/consultation/new`}>
              <Calendar className="mr-2 h-4 w-4" />
              Nouvelle consultation
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Patient Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Coordonnées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`tel:${patient.phone}`}
                  className="hover:underline"
                >
                  {formatPhone(patient.phone)}
                </a>
              </div>
              {patient.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`mailto:${patient.email}`}
                    className="hover:underline"
                  >
                    {patient.email}
                  </a>
                </div>
              )}
             {patient.profession && (
               <div className="flex items-center gap-2 text-sm">
                 <Briefcase className="h-4 w-4 text-muted-foreground" />
                 <span>{patient.profession}</span>
               </div>
             )}
              {patient.sport_activity && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Activité sportive :</span>
                  <span>{patient.sport_activity}</span>
                </div>
              )}
              {patient.primary_physician && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Médecin traitant :</span>
                  <span>{patient.primary_physician}</span>
                </div>
              )}
              {patient.pregnancy_due_date && (
                <div className="flex items-center gap-2 text-sm text-pink-600">
                  <span className="font-medium">Grossesse — terme prévu :</span>
                  <span>{new Date(patient.pregnancy_due_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Structured Medical History */}
          <MedicalHistorySectionWrapper
            patientId={id}
            initialEntries={medicalHistoryEntries || []}
          />

          {/* Notes */}
          {patient.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{patient.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Exercise prescriptions */}
          <ExercisePrescriptionSection
            patientId={id}
            patientName={`${patient.first_name} ${patient.last_name}`}
          />

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statistiques</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Consultations</span>
                <span className="font-medium">{consultations?.length || 0}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Créé le</span>
                <span>{formatDate(patient.created_at)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Dernière mise à jour</span>
                <span>{formatDate(patient.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Consultations Timeline */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Consultations
              </CardTitle>
              <Button size="sm" asChild>
                <Link href={`/patients/${id}/consultation/new`}>
                  <Calendar className="mr-2 h-4 w-4" />
                  Nouvelle
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <ConsultationTimeline
                consultations={consultations || []}
                patientId={id}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
