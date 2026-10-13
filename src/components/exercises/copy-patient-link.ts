import type { useToast } from '@/hooks/use-toast'

type Toast = ReturnType<typeof useToast>['toast']

/** Copie le lien de l'appli patient, à envoyer par SMS ou message. */
export async function copyPatientLink(prescriptionId: string, toast: Toast) {
  try {
    const res = await fetch(`/api/exercise-prescriptions/${prescriptionId}/patient-link?copie=1`)
    const data = await res.json()
    if (!res.ok || !data.url) {
      toast({ title: data.error || 'Impossible de créer le lien', variant: 'destructive' })
      return
    }
    await navigator.clipboard.writeText(data.url)
    toast({ title: 'Lien copié', description: 'Envoyez-le au patient par SMS ou message : il ouvre son programme sur son téléphone.' })
  } catch {
    toast({ title: 'Impossible de copier le lien', variant: 'destructive' })
  }
}
