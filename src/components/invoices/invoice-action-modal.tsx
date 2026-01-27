'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import {
  Mail,
  Printer,
  Download,
  CheckCircle,
  Loader2,
  FileText,
  ArrowRight,
  X,
} from 'lucide-react'

interface InvoiceActionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoiceId: string
  invoiceNumber: string
  patientEmail?: string | null
  patientName: string
  onComplete?: () => void
}

interface ActionOption {
  id: 'email' | 'print' | 'download' | 'skip'
  icon: React.ElementType
  title: string
  description: string
  disabled?: boolean
  disabledReason?: string
}

export function InvoiceActionModal({
  open,
  onOpenChange,
  invoiceId,
  invoiceNumber,
  patientEmail,
  patientName,
  onComplete,
}: InvoiceActionModalProps) {
  const [selectedAction, setSelectedAction] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const actions: ActionOption[] = [
    {
      id: 'email',
      icon: Mail,
      title: 'Envoyer par email',
      description: patientEmail
        ? `Envoyer à ${patientEmail}`
        : 'Aucun email renseigné',
      disabled: !patientEmail,
      disabledReason: 'Le patient n\'a pas d\'adresse email',
    },
    {
      id: 'print',
      icon: Printer,
      title: 'Imprimer',
      description: 'Ouvrir le PDF pour impression',
    },
    {
      id: 'download',
      icon: Download,
      title: 'Télécharger',
      description: 'Télécharger le PDF sur votre appareil',
    },
    {
      id: 'skip',
      icon: X,
      title: 'Passer',
      description: 'Gérer la facture plus tard',
    },
  ]

  const handleAction = async () => {
    if (!selectedAction) return

    setIsLoading(true)

    try {
      switch (selectedAction) {
        case 'email':
          // Send invoice via email
          const emailResponse = await fetch('/api/emails/invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoiceId }),
          })

          if (!emailResponse.ok) {
            throw new Error('Échec de l\'envoi de l\'email')
          }

          toast({
            variant: 'success',
            title: 'Email envoyé',
            description: `La facture a été envoyée à ${patientEmail}`,
          })
          break

        case 'print':
          // Open PDF in new tab for printing
          window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')
          toast({
            title: 'PDF ouvert',
            description: 'Utilisez Ctrl/Cmd + P pour imprimer',
          })
          break

        case 'download':
          // Download PDF
          const pdfResponse = await fetch(`/api/invoices/${invoiceId}/pdf`)
          const pdfBlob = await pdfResponse.blob()
          const url = URL.createObjectURL(pdfBlob)
          const link = document.createElement('a')
          link.href = url
          link.download = `facture_${invoiceNumber}.pdf`
          document.body.appendChild(link)
          link.click()
          document.body.removeChild(link)
          URL.revokeObjectURL(url)

          toast({
            variant: 'success',
            title: 'Téléchargement terminé',
            description: `facture_${invoiceNumber}.pdf`,
          })
          break

        case 'skip':
          // Just close the modal
          break
      }

      setIsSuccess(true)
      setTimeout(() => {
        onOpenChange(false)
        onComplete?.()
        setIsSuccess(false)
        setSelectedAction(null)
      }, selectedAction === 'skip' ? 0 : 1500)
    } catch (error) {
      console.error('Error handling invoice action:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4 animate-fade-in">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-center">
              {selectedAction === 'email'
                ? 'Email envoyé avec succès !'
                : selectedAction === 'print'
                ? 'PDF prêt pour impression'
                : selectedAction === 'download'
                ? 'Téléchargement terminé !'
                : 'Consultation enregistrée'}
            </h3>
            <p className="text-sm text-muted-foreground text-center mt-1">
              Redirection en cours...
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/25">
              <FileText className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-xl">Facture créée</DialogTitle>
              <DialogDescription className="text-sm">
                Facture {invoiceNumber} pour {patientName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Que souhaitez-vous faire avec cette facture ?
          </p>

          <div className="grid gap-3">
            {actions.map((action) => (
              <button
                key={action.id}
                type="button"
                disabled={action.disabled || isLoading}
                onClick={() => setSelectedAction(action.id)}
                className={`
                  relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left
                  ${
                    selectedAction === action.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border/50 hover:border-primary/50 hover:bg-muted/50'
                  }
                  ${action.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div
                  className={`
                    flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                    ${
                      selectedAction === action.id
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }
                  `}
                >
                  <action.icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{action.title}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {action.disabled ? action.disabledReason : action.description}
                  </p>
                </div>
                {selectedAction === action.id && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              onComplete?.()
            }}
            disabled={isLoading}
          >
            Annuler
          </Button>
          <Button
            onClick={handleAction}
            disabled={!selectedAction || isLoading}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                Confirmer
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
