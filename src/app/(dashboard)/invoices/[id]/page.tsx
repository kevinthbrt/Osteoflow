'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import {
  ArrowLeft,
  Download,
  Printer,
  Mail,
  User,
  Calendar,
  CreditCard,
  Banknote,
  FileText,
  Loader2,
} from 'lucide-react'
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils'
import { invoiceStatusLabels, paymentMethodLabels } from '@/lib/validations/invoice'
import type { Invoice, Payment, Consultation, Patient, Practitioner } from '@/types/database'

interface InvoiceWithDetails extends Invoice {
  consultation: Consultation & { patient: Patient }
  payments: Payment[]
}

const paymentMethodIcons: Record<string, React.ReactNode> = {
  card: <CreditCard className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  check: <FileText className="h-4 w-4" />,
  transfer: <CreditCard className="h-4 w-4" />,
  other: <CreditCard className="h-4 w-4" />,
}

export default function InvoicePage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()
  const [invoice, setInvoice] = useState<InvoiceWithDetails | null>(null)
  const [practitioner, setPractitioner] = useState<Practitioner | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const id = params.id as string

      // Get invoice with relations
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          consultation:consultations (
            *,
            patient:patients (*)
          ),
          payments (*)
        `)
        .eq('id', id)
        .single()

      if (invoiceError || !invoiceData) {
        router.push('/invoices')
        return
      }

      setInvoice(invoiceData as InvoiceWithDetails)

      // Get practitioner
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: practitionerData } = await supabase
          .from('practitioners')
          .select('*')
          .eq('user_id', user.id)
          .single()

        setPractitioner(practitionerData)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [params.id, supabase, router])

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return

    const updates: Partial<Invoice> = { status: newStatus as Invoice['status'] }

    if (newStatus === 'issued' && !invoice.issued_at) {
      updates.issued_at = new Date().toISOString()
    }
    if (newStatus === 'paid' && !invoice.paid_at) {
      updates.paid_at = new Date().toISOString()
    }

    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoice.id)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre à jour le statut',
      })
      return
    }

    setInvoice({ ...invoice, ...updates })
    toast({
      title: 'Statut mis à jour',
      description: `La facture est maintenant "${invoiceStatusLabels[newStatus]}"`,
    })
  }

  const handleSendEmail = async () => {
    if (!invoice) return

    setIsSendingEmail(true)

    try {
      const response = await fetch('/api/emails/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Erreur lors de l\'envoi')
      }

      toast({
        variant: 'success',
        title: 'Email envoyé',
        description: `La facture a été envoyée à ${invoice.consultation.patient.email}`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Impossible d\'envoyer l\'email',
      })
    } finally {
      setIsSendingEmail(false)
      setShowEmailDialog(false)
    }
  }

  const handlePrint = () => {
    window.open(`/api/invoices/${invoice?.id}/pdf`, '_blank')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!invoice) {
    return null
  }

  const patient = invoice.consultation.patient
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = invoice.amount - totalPaid

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/invoices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-mono">
              {invoice.invoice_number}
            </h1>
            <p className="text-muted-foreground">
              {invoice.issued_at
                ? `Émise le ${formatDate(invoice.issued_at)}`
                : 'Brouillon'}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimer
          </Button>
          <Button variant="outline" asChild>
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              download={`${invoice.invoice_number}.pdf`}
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger
            </a>
          </Button>
          {patient.email && (
            <Button onClick={() => setShowEmailDialog(true)}>
              <Mail className="mr-2 h-4 w-4" />
              Envoyer par email
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails de la facture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Header Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Client</p>
                  <p className="font-medium">
                    {patient.last_name} {patient.first_name}
                  </p>
                  {patient.email && (
                    <p className="text-sm text-muted-foreground">{patient.email}</p>
                  )}
                </div>
                {practitioner && (
                  <div className="text-right">
                    <p className="font-medium">
                      {practitioner.practice_name || `${practitioner.first_name} ${practitioner.last_name}`}
                    </p>
                    {practitioner.address && (
                      <p className="text-sm text-muted-foreground">
                        {practitioner.address}
                      </p>
                    )}
                    {practitioner.city && practitioner.postal_code && (
                      <p className="text-sm text-muted-foreground">
                        {practitioner.postal_code} {practitioner.city}
                      </p>
                    )}
                    {practitioner.siret && (
                      <p className="text-sm text-muted-foreground">
                        SIRET: {practitioner.siret}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-sm font-medium text-muted-foreground">
                        Description
                      </th>
                      <th className="text-right py-2 text-sm font-medium text-muted-foreground">
                        Montant
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-3">
                        <p className="font-medium">Consultation ostéopathique</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(invoice.consultation.date_time)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {invoice.consultation.reason}
                        </p>
                      </td>
                      <td className="py-3 text-right font-medium">
                        {formatCurrency(invoice.amount)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="border-t">
                      <td className="py-3 font-bold">Total</td>
                      <td className="py-3 text-right text-lg font-bold">
                        {formatCurrency(invoice.amount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {invoice.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Notes
                    </p>
                    <p className="text-sm">{invoice.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payments */}
          <Card>
            <CardHeader>
              <CardTitle>Paiements</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun paiement enregistré</p>
              ) : (
                <div className="space-y-3">
                  {invoice.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {paymentMethodIcons[payment.method]}
                        <div>
                          <p className="font-medium">
                            {paymentMethodLabels[payment.method]}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(payment.payment_date)}
                          </p>
                        </div>
                      </div>
                      <p className="font-medium">{formatCurrency(payment.amount)}</p>
                    </div>
                  ))}

                  <Separator />

                  <div className="flex justify-between items-center">
                    <span>Total payé</span>
                    <span className="font-bold">{formatCurrency(totalPaid)}</span>
                  </div>
                  {remaining > 0 && (
                    <div className="flex justify-between items-center text-destructive">
                      <span>Reste à payer</span>
                      <span className="font-bold">{formatCurrency(remaining)}</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Statut</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={invoice.status} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Brouillon</SelectItem>
                  <SelectItem value="issued">Émise</SelectItem>
                  <SelectItem value="paid">Payée</SelectItem>
                  <SelectItem value="cancelled">Annulée</SelectItem>
                </SelectContent>
              </Select>

              <div className="space-y-2 text-sm">
                {invoice.issued_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Émise le</span>
                    <span>{formatDate(invoice.issued_at)}</span>
                  </div>
                )}
                {invoice.paid_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payée le</span>
                    <span>{formatDate(invoice.paid_at)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Patient */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant={patient.gender === 'M' ? 'default' : 'secondary'}>
                  {patient.gender === 'M' ? 'H' : 'F'}
                </Badge>
                <span className="font-medium">
                  {patient.last_name} {patient.first_name}
                </span>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/patients/${patient.id}`}>
                  Voir le dossier
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Consultation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Consultation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                {formatDateTime(invoice.consultation.date_time)}
              </p>
              <p className="text-sm text-muted-foreground">
                {invoice.consultation.reason}
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/consultations/${invoice.consultation.id}`}>
                  Voir la consultation
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Email Dialog */}
      <AlertDialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer la facture par email</AlertDialogTitle>
            <AlertDialogDescription>
              La facture sera envoyée à <strong>{patient.email}</strong>.
              Le PDF sera attaché à l&apos;email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleSendEmail} disabled={isSendingEmail}>
              {isSendingEmail && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
