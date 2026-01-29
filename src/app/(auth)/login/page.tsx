'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface PractitionerItem {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  practice_name: string | null
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [practitioners, setPractitioners] = useState<PractitionerItem[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    // Load existing practitioners
    async function load() {
      const { data } = await supabase
        .from('practitioners')
        .select('id, user_id, first_name, last_name, email, practice_name')
        .order('last_name')
      if (data) {
        setPractitioners(data)
        if (data.length === 0) {
          setShowCreateForm(true)
        }
      }
    }
    load()
  }, [supabase])

  const handleSelectPractitioner = async (practitioner: PractitionerItem) => {
    setIsLoading(true)
    try {
      // Sign in using the practitioner's email (password is ignored in desktop mode)
      await supabase.auth.signInWithPassword({
        email: practitioner.email,
        password: 'local',
      })

      toast({
        variant: 'success',
        title: 'Bienvenue',
        description: `Connecté en tant que ${practitioner.first_name} ${practitioner.last_name}`,
      })

      router.push('/patients')
      router.refresh()
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de se connecter',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreatePractitioner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Tous les champs sont requis',
      })
      return
    }

    setIsLoading(true)
    try {
      // Create practitioner with a new user_id
      const userId = crypto.randomUUID()
      const now = new Date().toISOString()

      const { error } = await supabase.from('practitioners').insert({
        user_id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        created_at: now,
        updated_at: now,
      })

      if (error) throw error

      // Auto-login
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: 'local',
      })

      toast({
        variant: 'success',
        title: 'Profil créé',
        description: `Bienvenue, ${firstName} ${lastName} !`,
      })

      router.push('/patients')
      router.refresh()
    } catch (error) {
      console.error('Error creating practitioner:', error)
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de créer le profil',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getInitials = (first: string, last: string) => {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <svg
                className="w-8 h-8 text-primary-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Osteoflow</CardTitle>
          <CardDescription>
            {showCreateForm
              ? 'Créez votre profil praticien'
              : 'Sélectionnez votre profil pour continuer'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showCreateForm ? (
            <div className="space-y-4">
              {/* Practitioner list */}
              <div className="space-y-2">
                {practitioners.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelectPractitioner(p)}
                    disabled={isLoading}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm">
                        {getInitials(p.first_name, p.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {p.first_name} {p.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p.practice_name || p.email}
                      </p>
                    </div>
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  </button>
                ))}
              </div>

              {/* Add new practitioner button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowCreateForm(true)}
                disabled={isLoading}
              >
                <Plus className="mr-2 h-4 w-4" />
                Ajouter un praticien
              </Button>
            </div>
          ) : (
            <form onSubmit={handleCreatePractitioner} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">Prénom *</Label>
                  <Input
                    id="first_name"
                    placeholder="Jean"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Nom *</Label>
                  <Input
                    id="last_name"
                    placeholder="Dupont"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="praticien@exemple.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div className="flex gap-2">
                {practitioners.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Retour
                  </Button>
                )}
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <User className="mr-2 h-4 w-4" />
                  Créer et continuer
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
