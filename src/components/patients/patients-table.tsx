'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { MoreHorizontal, Edit, Trash2, Archive, Eye, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, formatPhone, calculateAge } from '@/lib/utils'
import { createClient } from '@/lib/db/client'
import { useToast } from '@/hooks/use-toast'
import type { Patient } from '@/types/database'

interface PatientsTableProps {
  patients: Patient[]
  currentPage: number
  totalPages: number
  totalCount: number
}

export function PatientsTable({ patients, currentPage, totalPages, totalCount }: PatientsTableProps) {
  const [deletePatient, setDeletePatient] = useState<Patient | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const db = createClient()

  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams)
    if (page > 1) {
      params.set('page', String(page))
    } else {
      params.delete('page')
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleArchive = async (patient: Patient) => {
    const { error } = await db
      .from('patients')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', patient.id)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible d\'archiver le patient',
      })
      return
    }

    toast({
      title: 'Patient archivé',
      description: `${patient.first_name} ${patient.last_name} a été archivé`,
    })
    router.refresh()
  }

  const handleDelete = async () => {
    if (!deletePatient) return

    const { error } = await db
      .from('patients')
      .delete()
      .eq('id', deletePatient.id)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de supprimer le patient',
      })
      return
    }

    toast({
      title: 'Patient supprimé',
      description: `${deletePatient.first_name} ${deletePatient.last_name} a été supprimé`,
    })
    setDeletePatient(null)
    router.refresh()
  }

  if (patients.length === 0 && currentPage === 1) {
    return (
      <div className="text-center py-10 border rounded-lg bg-muted/50">
        <p className="text-muted-foreground">Aucun patient trouvé</p>
        <Button asChild className="mt-4">
          <Link href="/patients/new">Créer votre premier patient</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Profession</TableHead>
              <TableHead>Dernière mise à jour</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {patients.map((patient) => (
              <TableRow key={patient.id}>
                <TableCell>
                  <Link
                    href={`/patients/${patient.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Badge variant={patient.gender === 'M' ? 'default' : 'secondary'}>
                      {patient.gender === 'M' ? 'H' : 'F'}
                    </Badge>
                    <span className="font-medium">
                      {patient.last_name} {patient.first_name}
                    </span>
                    {patient.archived_at && (
                      <Badge variant="outline" className="ml-2">Archivé</Badge>
                    )}
                  </Link>
                </TableCell>
                <TableCell>{formatPhone(patient.phone)}</TableCell>
                <TableCell>{calculateAge(patient.birth_date)} ans</TableCell>
                <TableCell>{patient.profession || '-'}</TableCell>
                <TableCell>{formatDate(patient.updated_at)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/patients/${patient.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Voir
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/patients/${patient.id}/edit`}>
                          <Edit className="mr-2 h-4 w-4" />
                          Modifier
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/patients/${patient.id}/consultation/new`}>
                          <Calendar className="mr-2 h-4 w-4" />
                          Nouvelle consultation
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {!patient.archived_at && (
                        <DropdownMenuItem onClick={() => handleArchive(patient)}>
                          <Archive className="mr-2 h-4 w-4" />
                          Archiver
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => setDeletePatient(patient)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">
            {totalCount} patient{totalCount > 1 ? 's' : ''} au total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Précédent
            </Button>
            <span className="text-sm text-muted-foreground px-2">
              Page {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              Suivant
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deletePatient} onOpenChange={() => setDeletePatient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le patient{' '}
              <strong>
                {deletePatient?.first_name} {deletePatient?.last_name}
              </strong>
              ? Cette action est irréversible et supprimera également toutes les
              consultations et factures associées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
