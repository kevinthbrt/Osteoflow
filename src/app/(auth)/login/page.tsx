'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/db/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Plus, User, Lock, Eye, EyeOff } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface PractitionerItem {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  practice_name: string | null
  has_password: boolean
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [practitioners, setPractitioners] = useState<PractitionerItem[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedPractitioner, setSelectedPractitioner] = useState<PractitionerItem | null>(null)
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const db = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await db
        .from('practitioners')
        .select('id, user_id, first_name, last_name, email, practice_name, password_hash')
        .order('last_name')
      if (data) {
        const mapped = (data as any[]).map((p: any) => ({
          ...p,
          has_password: !!p.password_hash,
          password_hash: undefined,
        }))
        setPractitioners(mapped)
        if (mapped.length === 0) {
          setShowCreateForm(true)
        }
      }
    }
    load()
  }, [db])

  const handleSelectPractitioner = async (practitioner: PractitionerItem) => {
    if (practitioner.has_password) {
      setSelectedPractitioner(practitioner)
      setLoginPassword('')
      return
    }
    await doLogin(practitioner, '')
  }

  const doLogin = async (practitioner: PractitionerItem, pwd: string) => {
    setIsLoading(true)
    try {
      const result = await db.auth.signInWithPassword({
        email: practitioner.email,
        password: pwd,
      })

      if (result.error) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: result.error.message || 'Mot de passe incorrect',
        })
        setIsLoading(false)
        return
      }

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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPractitioner) return
    await doLogin(selectedPractitioner, loginPassword)
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

    if (password && password.length < 4) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 4 caractères',
      })
      return
    }

    setIsLoading(true)
    try {
      const userId = crypto.randomUUID()
      const now = new Date().toISOString()

      const { error } = await db.from('practitioners').insert({
        user_id: userId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        created_at: now,
        updated_at: now,
      })

      if (error) throw error

      // Set password via API if provided
      if (password) {
        await fetch('/api/auth/login', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password }),
        })
      }

      // Auto-login
      await db.auth.signInWithPassword({
        email: email.trim(),
        password: password || '',
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
              : selectedPractitioner
              ? `Entrez le mot de passe pour ${selectedPractitioner.first_name}`
              : 'Sélectionnez votre profil pour continuer'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedPractitioner ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm">
                    {getInitials(selectedPractitioner.first_name, selectedPractitioner.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {selectedPractitioner.first_name} {selectedPractitioner.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedPractitioner.practice_name || selectedPractitioner.email}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login_password">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login_password"
                    type={showLoginPassword ? 'text' : 'password'}
                    placeholder="Votre mot de passe"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 pr-10"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedPractitioner(null)}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Retour
                </Button>
                <Button type="submit" disabled={isLoading || !loginPassword} className="flex-1">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Se connecter
                </Button>
              </div>
            </form>
          ) : !showCreateForm ? (
            <div className="space-y-4">
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
                    {p.has_password && <Lock className="h-4 w-4 text-muted-foreground" />}
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  </button>
                ))}
              </div>

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
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe (optionnel)</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="4 caractères minimum"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Protège l&apos;accès au profil au démarrage
                </p>
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
