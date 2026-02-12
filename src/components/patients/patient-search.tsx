'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Search } from 'lucide-react'
import { useDebouncedCallback } from '@/hooks/use-debounced-callback'

export function PatientSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleSearch = useDebouncedCallback((term: string) => {
    const params = new URLSearchParams(searchParams)
    if (term) {
      params.set('q', term)
    } else {
      params.delete('q')
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }, 300)

  const handleArchivedChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams)
    if (checked) {
      params.set('archived', 'true')
    } else {
      params.delete('archived')
    }
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
      <div className="relative flex-1 w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, prénom, téléphone..."
          defaultValue={searchParams.get('q') ?? ''}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="archived"
          defaultChecked={searchParams.get('archived') === 'true'}
          onCheckedChange={handleArchivedChange}
        />
        <Label htmlFor="archived" className="text-sm cursor-pointer">
          Afficher les patients archivés
        </Label>
      </div>
    </div>
  )
}
