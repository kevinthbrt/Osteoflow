'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/db/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useToast } from '@/hooks/use-toast'
import {
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
import { ConsultationPaymentEditor } from '@/components/consultations/consultation-payment-editor'

const PAYMENT_ICONS: Record<string, React.ReactNode> = {
  card: <CreditCard className="h-4 w-4" />,
  cash: <Banknote className="h-4 w-4" />,
  check: <FileText className="h-4 w-4" />,
  transfer: <CreditCard className="h-4 w-4" />,
  other: <CreditCard className="h-4 w-4" />,
}

interface Props {
  invoiceId: string | null
  onClose: () => void
}

export function InvoiceModal({ invoiceId, onClose }: Props) {
  const { toast } = useToast()
  const [invoice, setInvoice] = useState<any>(null)
  const [practitioner, setPractitioner] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [isSendingEmail, setIsSendingEmail] = useState(false)
  const [showEmailDialog, setShowEmailDialog] = useState(false)

  useEffect(() => {
    if (!invoiceId) {
      setInvoice(null)
      return
    }
    setLoading(true)
    const db = createClient()
    Promise.all([
      db.from('invoices')
        .select('*, consultation:consultations(*, patient:patients(*), session_type:session_types(*)), payments(*)')
        .eq('id', invoiceId)
        .single(),
      db.auth.getUser(),
    ]).then(async ([{ data: inv }, { data: { user } }]) => {
      setInvoice(inv)
      if (user) {
        const { data: prac } = await db
          .from('practitioners')
          .select('*')
          .eq('user_id', user.id)
          .single()
        setPractitioner(prac)
      }
      setLoading(false)
    })
  }, [invoiceId])

  const handleStatusChange = async (newStatus: string) => {
    if (!invoice) return
    const db = createClient()
    const updates: any = { status: newStatus }
    if (newStatus === 'issued' && !invoice.issued_at) updates.issued_at = new Date().toISOString()
    if (newStatus === 'paid' && !invoice.paid_at) updates.paid_at = new Date().toISOString()
    const { error } = await db.from('invoices').update(updates).eq('id', invoice.id)
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de mettre à jour le statut' })
      return
    }
    setInvoice({ ...invoice, ...updates })
    toast({ title: 'Statut mis à jour', description: `La facture est "${invoiceStatusLabels[newStatus]}"` })
  }

  const handleSendEmail = async () => {
    if (!invoice) return
    setIsSendingEmail(true)
    try {
      const res = await fetch('/api/emails/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id }),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Erreur')
      toast({
        variant: 'success',
        title: 'Email envoyé',
        description: `Facture envoyée à ${patient?.email}`,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : "Impossible d'envoyer l'email",
      })
    } finally {
      setIsSendingEmail(false)
      setShowEmailDialog(false)
    }
  }

  const patient = invoice?.consultation?.patient
  const totalPaid = (invoice?.payments || []).reduce((s: number, p: any) => s + p.amount, 0)
  const remaining = invoice ? invoice.amount - totalPaid : 0

  return (
    <>
      <Dialog open={!!invoiceId} onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {loading || !invoice ? (
            <>
              <DialogHeader>
                <DialogTitle className="sr-only">Chargement de la facture…</DialogTitle>
              </DialogHeader>
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4 pr-6">
                  <div>
                    <DialogTitle className="text-xl font-mono">{invoice.invoice_number}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {invoice.issued_at ? `Émise le ${formatDate(invoice.issued_at)}` : 'Brouillon'}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/invoices/${invoice.id}/pdf`, '_blank')}
                    >
                      <Printer className="mr-1.5 h-3.5 w-3.5" />
                      Imprimer
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/invoices/${invoice.id}/pdf`} download={`${invoice.invoice_number}.pdf`}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        PDF
                      </a>
                    </Button>
                    {patient?.email && (
                      <Button size="sm" onClick={() => setShowEmailDialog(true)}>
                        <Mail className="mr-1.5 h-3.5 w-3.5" />
                        Email
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="grid gap-6 lg:grid-cols-3 mt-2">
                {/* Main (2/3) */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Invoice details */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Détails de la facture</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Client</p>
                          <p className="font-medium">{patient?.last_name} {patient?.first_name}</p>
                          {patient?.email && (
                            <p className="text-sm text-muted-foreground">{patient.email}</p>
                          )}
                        </div>
                        {practitioner && (
                          <div className="text-right">
                            <p className="font-medium">
                              {practitioner.practice_name || `${practitioner.first_name} ${practitioner.last_name}`}
                            </p>
                            {practitioner.address && (
                              <p className="text-sm text-muted-foreground">{practitioner.address}</p>
                            )}
                            {practitioner.city && practitioner.postal_code && (
                              <p className="text-sm text-muted-foreground">
                                {practitioner.postal_code} {practitioner.city}
                              </p>
                            )}
                            {practitioner.siret && (
                              <p className="text-sm text-muted-foreground">SIRET: {practitioner.siret}</p>
                            )}
                          </div>
                        )}
                      </div>

                      <Separator />

                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 text-xs font-medium text-muted-foreground">
                              Description
                            </th>
                            <th className="text-right py-2 text-xs font-medium text-muted-foreground">
                              Montant
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="py-3">
                              <p className="font-medium text-sm">
                                {invoice.consultation.session_type?.name ?? 'Consultation'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatDateTime(invoice.consultation.date_time)}
                              </p>
                              <p className="text-xs text-muted-foreground">
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
                            <td className="py-2 font-bold text-sm">Total</td>
                            <td className="py-2 text-right text-lg font-bold">
                              {formatCurrency(invoice.amount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {invoice.notes && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Notes</p>
                            <p className="text-sm">{invoice.notes}</p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Payments */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Paiements reçus</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {invoice.payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Aucun paiement enregistré</p>
                      ) : (
                        <div className="space-y-2">
                          {invoice.payments.map((payment: any) => (
                            <div
                              key={payment.id}
                              className="flex items-center justify-between p-2.5 border rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                {PAYMENT_ICONS[payment.method]}
                                <div>
                                  <p className="text-sm font-medium">
                                    {paymentMethodLabels[payment.method]}
                                    {payment.method === 'check' && payment.check_number && (
                                      <span className="text-muted-foreground font-normal">
                                        {' — '}N° {payment.check_number}
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(payment.payment_date)}
                                  </p>
                                </div>
                              </div>
                              <p className="text-sm font-medium">{formatCurrency(payment.amount)}</p>
                            </div>
                          ))}
                          <Separator />
                          <div className="flex justify-between text-sm">
                            <span>Total payé</span>
                            <span className="font-bold">{formatCurrency(totalPaid)}</span>
                          </div>
                          {remaining > 0 && (
                            <div className="flex justify-between text-sm text-destructive">
                              <span>Reste à payer</span>
                              <span className="font-bold">{formatCurrency(remaining)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <ConsultationPaymentEditor
                    payments={invoice.payments || []}
                    invoiceId={invoice.id}
                    invoiceAmount={invoice.amount}
                  />
                </div>

                {/* Sidebar (1/3) */}
                <div className="space-y-4">
                  {/* Status */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Statut</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
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
                      <div className="space-y-1.5 text-xs">
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
                  {patient && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Patient
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={patient.gender === 'M' ? 'default' : 'female'}>
                            {patient.gender === 'M' ? 'H' : 'F'}
                          </Badge>
                          <span className="text-sm font-medium">
                            {patient.last_name} {patient.first_name}
                          </span>
                        </div>
                        <Button variant="outline" size="sm" className="w-full" asChild>
                          <Link href={`/patients/${patient.id}`}>Voir le dossier</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Consultation */}
                  {invoice.consultation && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Consultation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1">
                        <p className="text-sm font-medium">
                          {formatDateTime(invoice.consultation.date_time)}
                        </p>
                        <p className="text-xs text-muted-foreground">{invoice.consultation.reason}</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Envoyer la facture par email</AlertDialogTitle>
            <AlertDialogDescription>
              La facture sera envoyée à <strong>{patient?.email}</strong>. Le PDF sera attaché.
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
    </>
  )
}
