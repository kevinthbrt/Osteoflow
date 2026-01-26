import { PatientForm } from '@/components/patients/patient-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewPatientPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/patients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nouveau patient</h1>
          <p className="text-muted-foreground">
            Créez une nouvelle fiche patient
          </p>
        </div>
      </div>

      <PatientForm mode="create" />
    </div>
  )
}
