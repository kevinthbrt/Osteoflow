'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AuthLayout from '@/components/AuthLayout'
import { supabase } from '@/lib/supabase'
import { fetchProfilePayload } from '@/lib/profile-client'
import CourseCreationWizard from '../components/CourseCreationWizard'
import QuizComponent from '../components/QuizComponent'
import QuizManager from '../components/QuizManager'
import type { Quiz } from '../types/quiz'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  Clock3,
  GraduationCap,
  Layers,
  ChevronDown,
  ChevronRight,
  PlayCircle,
  Plus,
  FileDown,
  Search,
  Shield,
  Sparkles,
  Video,
  X,
  Loader2,
  ClipboardCheck,
  Lock,
  Trophy,
  Trash2,
  Pencil,
  Tag
} from 'lucide-react'
import FreeContentGate from '@/components/FreeContentGate'
import FreeUserBanner from '@/components/FreeUserBanner'

type Subpart = {
  id: string
  title: string
  vimeo_url?: string
  description_html?: string
  pdf_url?: string
  pdf_name?: string
  order_index?: number
  completed?: boolean
  quiz?: Quiz
  quiz_passed?: boolean
}

type Chapter = {
  id: string
  title: string
  order_index?: number
  subparts: Subpart[]
}

type Subject = {
  id: string
  name: string
  color: string
  order_index: number
}

type Formation = {
  id: string
  title: string
  description?: string
  is_private?: boolean
  photo_url?: string
  is_free_access?: boolean
  is_featured_osteoflow?: boolean
  subject_id?: string | null
  chapters: Chapter[]
}

type Profile = {
  id: string
  role: string
  full_name?: string
}

const canAccessFormation = (role: string | undefined, isPrivate?: boolean, isFreeAccess?: boolean) => {
  if (!role) return false
  if (isPrivate) return role === 'admin'
  // Free users can access courses marked as free access
  if (isFreeAccess && role === 'free') return true
  return ['premium', 'admin'].includes(role)
}

const getVimeoEmbedUrl = (url: string) => {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('player.vimeo.com')) return url

    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const videoId = pathParts[pathParts.length - 1]
    return videoId ? `https://player.vimeo.com/video/${videoId}` : url
  } catch (error) {
    console.warn('URL Vimeo invalide, utilisation directe', error)
    return url
  }
}

export default function CoursPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [formations, setFormations] = useState<Formation[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all')
  const [showSubjectModal, setShowSubjectModal] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [subjectForm, setSubjectForm] = useState({ name: '', color: '#6366f1' })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFormationId, setSelectedFormationId] = useState<string>('')
  const subpartRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [loading, setLoading] = useState(true)
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({})
  const [selectedSubpartId, setSelectedSubpartId] = useState<string>('')
  const [showWizard, setShowWizard] = useState(false)
  const [formationToEdit, setFormationToEdit] = useState<Formation | null>(null)
  const [activeQuiz, setActiveQuiz] = useState<{ quiz: Quiz; subpartId: string } | null>(null)
  const [quizManager, setQuizManager] = useState<{ subpartId: string; subpartTitle: string; quiz?: Quiz } | null>(null)

  useEffect(() => {
    loadData()
    loadSubjects()
  }, [])

  const loadData = async () => {
    try {
      const payload = await fetchProfilePayload()

      if (!payload?.user) {
        router.push('/')
        return
      }

      const profileData = payload.profile

      setProfile(profileData as Profile)

      await loadFormationsFromSupabase(payload.user.id, (profileData as Profile | null)?.role)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSubjects = async () => {
    const { data } = await supabase
      .from('course_subjects')
      .select('id, name, color, order_index')
      .order('order_index', { ascending: true })
    setSubjects(data || [])
  }

  const handleSaveSubject = async () => {
    if (!subjectForm.name.trim()) return
    if (editingSubject) {
      await supabase
        .from('course_subjects')
        .update({ name: subjectForm.name, color: subjectForm.color, updated_at: new Date().toISOString() })
        .eq('id', editingSubject.id)
    } else {
      await supabase.from('course_subjects').insert({
        name: subjectForm.name,
        color: subjectForm.color,
        order_index: subjects.length
      })
    }
    await loadSubjects()
    setShowSubjectModal(false)
    setEditingSubject(null)
    setSubjectForm({ name: '', color: '#6366f1' })
  }

  const handleDeleteSubject = async (id: string) => {
    if (!confirm('Supprimer cette matière ? Les cours associés ne seront pas supprimés.')) return
    await supabase.from('course_subjects').delete().eq('id', id)
    await loadSubjects()
  }

  const handleAssignSubject = async (formationId: string, subjectId: string) => {
    const value = subjectId === '' ? null : subjectId
    await supabase.from('elearning_formations').update({ subject_id: value }).eq('id', formationId)
    setFormations(prev => prev.map(f => f.id === formationId ? { ...f, subject_id: value } : f))
  }

  const loadFormationsFromSupabase = async (userId: string, role?: string, preserveFormationId?: string) => {
    const roleToUse = role ?? profile?.role

    try {
      const { data, error } = await supabase
        .from('elearning_formations')
        .select(
          `id, title, description, is_private, photo_url, is_free_access, is_featured_osteoflow, subject_id,
          chapters:elearning_chapters(id, title, order_index,
            subparts:elearning_subparts(id, title, vimeo_url, description_html, pdf_url, pdf_name, order_index,
              progress:elearning_subpart_progress(user_id, completed_at),
              quiz:elearning_quizzes(id, title, description, passing_score,
                questions:elearning_quiz_questions(id, question_text, question_type, points, order_index, explanation,
                  answers:elearning_quiz_answers(id, answer_text, is_correct, order_index)
                )
              )
            )
          )`
        )
        .order('title', { ascending: true })

      if (error) throw error

      if (data) {
        // Fetch quiz attempts for the user
        const { data: quizAttempts } = await supabase
          .from('elearning_quiz_attempts')
          .select('quiz_id, passed')
          .eq('user_id', userId)
          .eq('passed', true)

        const passedQuizIds = new Set((quizAttempts || []).map((a: any) => a.quiz_id))

        const parsed: Formation[] = data.map((formation: any) => ({
          id: formation.id,
          title: formation.title,
          description: formation.description,
          is_private: formation.is_private,
          photo_url: formation.photo_url,
          is_free_access: formation.is_free_access,
          is_featured_osteoflow: formation.is_featured_osteoflow,
          subject_id: formation.subject_id,
          chapters:
            formation.chapters?.map((chapter: any) => ({
              id: chapter.id,
              title: chapter.title,
              order_index: chapter.order_index,
              subparts:
                chapter.subparts?.map((sub: any) => {
                  const quizData = sub.quiz && sub.quiz.length > 0 ? sub.quiz[0] : null
                  const quiz = quizData ? {
                    id: quizData.id,
                    title: quizData.title,
                    description: quizData.description,
                    passing_score: quizData.passing_score,
                    questions: (quizData.questions || []).map((q: any) => ({
                      id: q.id,
                      question_text: q.question_text,
                      question_type: q.question_type,
                      points: q.points,
                      order_index: q.order_index,
                      explanation: q.explanation,
                      answers: (q.answers || []).map((a: any) => ({
                        id: a.id,
                        answer_text: a.answer_text,
                        is_correct: a.is_correct,
                        order_index: a.order_index
                      }))
                    }))
                  } : undefined

                  return {
                    id: sub.id,
                    title: sub.title,
                    vimeo_url: sub.vimeo_url,
                    description_html: sub.description_html,
                    pdf_url: sub.pdf_url,
                    pdf_name: sub.pdf_name,
                    order_index: sub.order_index,
                    completed: (sub.progress || []).some((p: any) => p.user_id === userId),
                    quiz,
                    quiz_passed: quiz ? passedQuizIds.has(quiz.id) : true
                  }
                }).sort((a: Subpart, b: Subpart) => (a.order_index ?? 0) - (b.order_index ?? 0)) || []
            })).sort((a: Chapter, b: Chapter) => (a.order_index ?? 0) - (b.order_index ?? 0)) || []
        }))

        // Show all non-private formations (private = admin only); access control is handled in UI via blur
        const accessible = parsed.filter((formation) =>
          !formation.is_private || roleToUse === 'admin'
        )

        setFormations(accessible)
        // Only preserve the selected formation if explicitly provided (e.g., after a refresh)
        if (preserveFormationId && accessible.some((f) => f.id === preserveFormationId)) {
          setSelectedFormationId(preserveFormationId)
        }
        // Don't auto-select a formation - let the user choose
      }
    } catch (error) {
      console.error('Erreur de chargement des formations', error)
      setFormations([])
      setSelectedFormationId('')
    }
  }

  const isPremium = profile?.role === 'premium' || profile?.role === 'admin'
  const isAdmin = profile?.role === 'admin'

  const selectedFormation = useMemo(
    () => formations.find((f) => f.id === selectedFormationId),
    [formations, selectedFormationId]
  )

  const filteredFormations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return formations
    return formations.filter((formation) => {
      const haystack = `${formation.title} ${formation.description ?? ''}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [formations, searchTerm])

  const displayedFormations = useMemo(() => {
    if (selectedSubjectId === 'all') return filteredFormations
    if (selectedSubjectId === 'none') return filteredFormations.filter(f => !f.subject_id)
    return filteredFormations.filter(f => f.subject_id === selectedSubjectId)
  }, [filteredFormations, selectedSubjectId])

  useEffect(() => {
    if (!selectedFormation) return

    const flatSubparts = selectedFormation.chapters.flatMap((chapter) => chapter.subparts)
    const nextSubpart =
      flatSubparts.find((subpart) => !subpart.completed) || flatSubparts[0]

    const initialChapters: Record<string, boolean> = {}

    selectedFormation.chapters.forEach((chapter) => {
      initialChapters[chapter.id] = false
    })

    if (nextSubpart) {
      setSelectedSubpartId(nextSubpart.id)
      const parentChapter = selectedFormation.chapters.find((chapter) =>
        chapter.subparts.some((sub) => sub.id === nextSubpart.id)
      )
      if (parentChapter) {
        initialChapters[parentChapter.id] = true
      }
    }

    setExpandedChapters(initialChapters)
  }, [selectedFormationId])

  const computeProgress = (formation?: Formation) => {
    if (!formation) return { total: 0, done: 0, percent: 0 }
    const total = formation.chapters.reduce((acc, chapter) => acc + chapter.subparts.length, 0)
    const done = formation.chapters.reduce(
      (acc, chapter) => acc + chapter.subparts.filter((s) => s.completed).length,
      0
    )
    return { total, done, percent: total ? Math.round((done / total) * 100) : 0 }
  }

  const progress = useMemo(() => computeProgress(selectedFormation), [selectedFormation])

  const downloadPdf = async (url: string, name?: string) => {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const objUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objUrl
      a.download = name || 'ressource.pdf'
      a.click()
      URL.revokeObjectURL(objUrl)
    } catch {
      window.open(url, '_blank')
    }
  }

  const handleDeleteFormation = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette formation ? Cette action est irréversible.')) {
      return
    }

    try {
      await supabase.from('elearning_formations').delete().eq('id', id)
      setFormations((prev) => prev.filter((formation) => formation.id !== id))
      if (selectedFormationId === id) {
        setSelectedFormationId('')
      }
    } catch (error) {
      console.error('Impossible de supprimer la formation', error)
      alert('Erreur lors de la suppression de la formation')
    }
  }

  const toggleChapterExpansion = (chapterId: string) => {
    setExpandedChapters((prev) => ({ ...prev, [chapterId]: !prev[chapterId] }))
  }

  const toggleCompletion = async (subpartId: string, completed: boolean) => {
    if (!profile) return

    try {
      if (completed) {
        await supabase.from('elearning_subpart_progress').upsert({
          subpart_id: subpartId,
          user_id: profile.id,
          completed_at: new Date().toISOString()
        })
      } else {
        await supabase
          .from('elearning_subpart_progress')
          .delete()
          .eq('subpart_id', subpartId)
          .eq('user_id', profile.id)
      }
    } catch (error) {
      console.error('Impossible de mettre à jour le suivi', error)
    }

    setFormations((prev) =>
      prev.map((formation) => ({
        ...formation,
        chapters: formation.chapters.map((chapter) => ({
          ...chapter,
          subparts: chapter.subparts.map((sub) =>
            sub.id === subpartId ? { ...sub, completed } : sub
          )
        }))
      }))
    )
  }

  const handleQuizPassed = async () => {
    if (!profile || !activeQuiz) return
    // Auto-mark the subpart as completed when quiz is passed
    await toggleCompletion(activeQuiz.subpartId, true)
    await loadFormationsFromSupabase(profile.id, profile.role, selectedFormationId)
  }

  // Compute a Set of accessible subpart IDs for the entire formation, propagating locks correctly:
  // a subpart is accessible only if its previous subpart is also accessible AND has no unpassed quiz.
  const computeAccessibleSubparts = (formation: Formation): Set<string> => {
    const accessible = new Set<string>()
    const allSubparts: Subpart[] = formation.chapters.flatMap((ch) => ch.subparts)
    for (let i = 0; i < allSubparts.length; i++) {
      if (i === 0) {
        accessible.add(allSubparts[i].id)
      } else {
        const prev = allSubparts[i - 1]
        const prevAccessible = accessible.has(prev.id)
        const prevQuizPassed = !prev.quiz || prev.quiz_passed === true
        if (prevAccessible && prevQuizPassed) {
          accessible.add(allSubparts[i].id)
        }
      }
    }
    return accessible
  }

  const isSubpartAccessible = (formation: Formation, chapter: Chapter, subpartIndex: number) => {
    const accessible = computeAccessibleSubparts(formation)
    const subpart = chapter.subparts[subpartIndex]
    if (!subpart) return false
    return accessible.has(subpart.id)
  }

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-12 w-12 text-slate-400 animate-spin" />
        </div>
      </AuthLayout>
    )
  }

  const isFree = profile?.role === 'free'

  return (
    <AuthLayout>
      {/* Modals — outside the full-bleed wrapper */}
      {showWizard && (
        <CourseCreationWizard
          onClose={() => {
            setShowWizard(false)
            setFormationToEdit(null)
          }}
          onSuccess={() => {
            setShowWizard(false)
            setFormationToEdit(null)
            loadData()
          }}
          existingFormation={formationToEdit || undefined}
        />
      )}

      {activeQuiz && profile && (
        <QuizComponent
          quiz={activeQuiz.quiz}
          subpartId={activeQuiz.subpartId}
          userId={profile.id}
          onQuizPassed={handleQuizPassed}
          onClose={() => setActiveQuiz(null)}
        />
      )}

      {quizManager && (
        <QuizManager
          subpartId={quizManager.subpartId}
          subpartTitle={quizManager.subpartTitle}
          existingQuiz={quizManager.quiz}
          onClose={() => setQuizManager(null)}
          onSave={() => {
            setQuizManager(null)
            loadData()
          }}
        />
      )}

      {showSubjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white/85 backdrop-blur-2xl border border-white/70 shadow-2xl ring-1 ring-inset ring-white/60 rounded-3xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/40">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Tag className="h-5 w-5 text-sky-500" />
                Gérer les matières
              </h2>
              <button
                onClick={() => { setShowSubjectModal(false); setEditingSubject(null); setSubjectForm({ name: '', color: '#6366f1' }) }}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* Existing subjects */}
              {subjects.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matières existantes</p>
                  {subjects.map(subject => (
                    <div key={subject.id} className="flex items-center gap-3 p-3 rounded-xl border border-white/60 bg-white/70 backdrop-blur-sm">
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                      <span className="flex-1 text-sm font-medium text-slate-800">{subject.name}</span>
                      <button
                        onClick={() => {
                          setEditingSubject(subject)
                          setSubjectForm({ name: subject.name, color: subject.color })
                        }}
                        className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-sky-600 transition"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSubject(subject.id)}
                        className="p-1.5 rounded-lg hover:bg-white text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Create / Edit form */}
              <div className="space-y-3 border-t border-white/40 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {editingSubject ? 'Modifier la matière' : 'Nouvelle matière'}
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={subjectForm.name}
                    onChange={e => setSubjectForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nom de la matière"
                    className="flex-1 bg-white/70 backdrop-blur-sm border border-blue-200/60 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-sky-300 focus:border-sky-400 outline-none"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500">Couleur</label>
                    <input
                      type="color"
                      value={subjectForm.color}
                      onChange={e => setSubjectForm(prev => ({ ...prev, color: e.target.value }))}
                      className="w-10 h-9 rounded-lg border border-blue-200/60 cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  {editingSubject && (
                    <button
                      onClick={() => { setEditingSubject(null); setSubjectForm({ name: '', color: '#6366f1' }) }}
                      className="px-4 py-2 rounded-xl bg-white/70 backdrop-blur-sm border border-blue-200/60 text-sm text-slate-700 hover:bg-white/90 transition"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    onClick={handleSaveSubject}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/90 backdrop-blur-sm border border-sky-400/30 text-white font-semibold hover:bg-sky-600/90 shadow-sm transition-all text-sm"
                  >
                    {editingSubject ? 'Mettre à jour' : 'Créer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-bleed wrapper */}
      <div className="min-h-screen -m-6 md:-m-8">
        {/* Dark header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-6 md:px-10 pt-8 pb-6">
          {/* Blobs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/4 left-0 w-64 h-64 bg-indigo-400/15 rounded-full blur-3xl pointer-events-none" />
          {/* Glow lines */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-300/50 to-transparent" />

          {/* Glass panel */}
          <div className="relative bg-white/[0.09] backdrop-blur-xl border border-white/20 ring-1 ring-inset ring-white/15 rounded-3xl shadow-[0_12px_40px_rgba(0,8,30,0.65),inset_0_1px_0_rgba(255,255,255,0.12)] p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              {/* Label */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm px-3 py-1.5 mb-4 border border-white/20">
                <GraduationCap className="h-3.5 w-3.5 text-sky-300" />
                <span className="text-xs font-semibold text-sky-300">E-Learning</span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-white via-sky-100 to-blue-200">
                Formations vidéo
              </h1>

              <p className="text-base md:text-lg text-blue-300/70 mb-4 max-w-2xl">
                Développez vos compétences avec nos parcours de formation structurés. Vidéos, exercices et suivi de progression inclus.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-300/70">Accès :</span>
                  <span className={`px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-2 ${
                    isAdmin
                      ? 'bg-gradient-to-r from-purple-500 to-purple-600'
                      : 'bg-gradient-to-r from-sky-500 to-blue-600'
                  }`}>
                    {isAdmin ? <Shield className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                    {isAdmin ? 'Mode Administration' : 'Premium'}
                  </span>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowWizard(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/90 backdrop-blur-sm border border-sky-400/30 text-white font-semibold hover:bg-sky-600/90 shadow-sm transition-all text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Ajouter une formation
                </button>
                <button
                  onClick={() => setShowSubjectModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/90 backdrop-blur-sm border border-sky-400/30 text-white font-semibold hover:bg-sky-600/90 shadow-sm transition-all text-sm"
                >
                  <Tag className="h-4 w-4" />
                  Gérer les matières
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Light body */}
        <div className="relative bg-gradient-to-br from-blue-100/90 via-sky-50 to-indigo-50/80 px-6 md:px-10 pt-8 pb-10">
          {/* Blobs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-blue-400/25 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 left-0 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative space-y-6">
            {isFree && <FreeUserBanner />}

            {!selectedFormation && (
              <>
                <div className="mb-4">
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2 flex items-center gap-3">
                    <BookOpen className="h-7 w-7 text-sky-600" />
                    Mes formations
                  </h2>
                  <p className="text-slate-600">
                    Sélectionnez une formation pour commencer votre parcours d'apprentissage
                  </p>
                </div>

                <div className="relative max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Rechercher une formation"
                    className="w-full bg-white/70 backdrop-blur-sm border border-blue-200/60 rounded-lg py-2.5 pl-10 pr-4 text-sm text-slate-700 focus:ring-2 focus:ring-sky-300 focus:border-sky-400 outline-none"
                  />
                </div>

                {subjects.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      onClick={() => setSelectedSubjectId('all')}
                      className={`px-4 py-1.5 text-sm font-medium transition-all ${
                        selectedSubjectId === 'all'
                          ? 'bg-sky-500/90 backdrop-blur-sm border border-sky-400/30 text-white rounded-xl shadow-sm'
                          : 'bg-white/70 backdrop-blur-sm border border-white/60 text-slate-600 hover:bg-white/90 rounded-xl'
                      }`}
                    >
                      Toutes
                    </button>
                    {subjects.map(subject => (
                      <button
                        key={subject.id}
                        onClick={() => setSelectedSubjectId(subject.id)}
                        className={`px-4 py-1.5 text-sm font-medium transition-all rounded-xl ${
                          selectedSubjectId === subject.id
                            ? 'text-white shadow-sm backdrop-blur-sm'
                            : 'bg-white/70 backdrop-blur-sm border border-white/60 text-slate-600 hover:bg-white/90'
                        }`}
                        style={
                          selectedSubjectId === subject.id
                            ? { backgroundColor: subject.color, borderColor: subject.color + '80', border: '1px solid' }
                            : { borderColor: subject.color + '60', color: subject.color }
                        }
                      >
                        {subject.name}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className={selectedFormation ? "hidden" : "grid gap-5 md:grid-cols-2 lg:grid-cols-3"}>
              {displayedFormations.map((formation) => {
                const stats = computeProgress(formation)
                const isFormationLocked = isFree && !formation.is_free_access
                const formationSubject = subjects.find(s => s.id === formation.subject_id)
                return (
                  <FreeContentGate key={formation.id} isLocked={isFormationLocked}>
                  <div className={`group text-left bg-white/85 backdrop-blur-2xl border border-white/70 shadow-xl ring-1 ring-inset ring-white/60 rounded-2xl overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-0.5 w-full flex flex-col ${
                    selectedFormationId === formation.id
                      ? 'ring-2 ring-sky-400/60 shadow-sky-200/50'
                      : ''
                  }`}>
                  <button
                    onClick={() => {
                      if (!isFormationLocked) setSelectedFormationId(formation.id)
                    }}
                    className="text-left w-full flex-1 flex flex-col"
                  >
                    <div className="bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white">
                        <Sparkles className="h-5 w-5" />
                        <span className="font-bold text-base line-clamp-2 leading-snug">{formation.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {formationSubject && (
                          <span
                            className="px-2 py-1 rounded-full text-[10px] font-semibold uppercase backdrop-blur-sm"
                            style={{ backgroundColor: formationSubject.color + '33', color: '#fff', border: `1px solid ${formationSubject.color}99` }}
                          >
                            {formationSubject.name}
                          </span>
                        )}
                        {formation.is_private && (
                          <span className="px-2 py-1 rounded-full text-[10px] bg-white/20 text-white font-semibold uppercase backdrop-blur-sm">
                            Privé
                          </span>
                        )}
                      </div>
                    </div>

                    {formation.photo_url && (
                      <div className="w-full h-48 overflow-hidden bg-gray-100">
                        <img
                          src={formation.photo_url}
                          alt={`Illustration de ${formation.title}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-5 flex flex-col flex-1 gap-4">
                      {formation.description ? (
                        <div
                          className="text-sm text-gray-700 prose prose-sm max-w-none line-clamp-4 overflow-hidden"
                          dangerouslySetInnerHTML={{ __html: formation.description }}
                        />
                      ) : (
                        <p className="text-sm text-gray-500">Description à venir.</p>
                      )}

                      <div className="mt-auto space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Layers className="h-4 w-4 text-sky-600" />
                          <span>{formation.chapters.length} chapitres</span>
                        </div>
                        <div className="text-sm font-semibold text-gray-700">
                          {stats.done}/{stats.total} terminées
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-sky-500 to-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${stats.percent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500">{stats.percent}% complété</span>
                          {stats.percent === 100 && (
                            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Terminé
                            </span>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  </button>
                  {isAdmin && (
                    <div className="px-4 pb-3 border-t border-white/50 pt-3">
                      <label className="text-xs text-slate-500 font-medium block mb-1">Matière</label>
                      <select
                        value={formation.subject_id ?? ''}
                        onChange={e => handleAssignSubject(formation.id, e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-full text-xs bg-white/70 backdrop-blur-sm border border-blue-200/60 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400"
                      >
                        <option value="">— Aucune matière —</option>
                        {subjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  </div>
                  </FreeContentGate>
                )
              })}
            </div>

            {!selectedFormation && formations.length === 0 && (
              <div className="bg-white/85 backdrop-blur-2xl border border-white/70 shadow-xl ring-1 ring-inset ring-white/60 rounded-2xl p-12 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sky-100 to-indigo-100 mb-4">
                  <BookOpen className="h-8 w-8 text-sky-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune formation disponible</h3>
                <p className="text-gray-600 text-sm">Les formations apparaîtront ici une fois ajoutées.</p>
              </div>
            )}

            {!selectedFormation && formations.length > 0 && displayedFormations.length === 0 && (
              <div className="bg-white/85 backdrop-blur-2xl border border-white/70 shadow-xl ring-1 ring-inset ring-white/60 rounded-2xl p-6 text-center text-sm text-slate-600">
                Aucune formation ne correspond à votre recherche.
              </div>
            )}

            {selectedFormation && (
              <div className="space-y-6">
                {/* Back to list button */}
                <button
                  onClick={() => setSelectedFormationId('')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/70 backdrop-blur-sm border border-blue-200/60 text-slate-700 hover:bg-white/90 transition-all font-medium shadow-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour aux formations
                </button>

                <div className="bg-white/85 backdrop-blur-2xl border border-white/70 shadow-xl ring-1 ring-inset ring-white/60 rounded-2xl p-6 space-y-6">
                  {/* Formation Header */}
                  <div className="bg-gradient-to-br from-sky-50/80 via-blue-50/80 to-indigo-50/80 rounded-2xl p-6 border border-sky-100/60">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 text-sky-700 font-semibold">
                        <Sparkles className="h-5 w-5" />
                        <span>Formation</span>
                      </div>
                      <h2 className="text-3xl font-bold text-blue-900">{selectedFormation.title}</h2>
                      {selectedFormation.is_private && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs bg-white text-blue-800 border border-blue-200 font-semibold uppercase">
                          Privé
                        </span>
                      )}
                      {selectedFormation.description && (
                        <div
                          className="text-gray-700 text-sm prose prose-sm max-w-none mt-3"
                          dangerouslySetInnerHTML={{ __html: selectedFormation.description }}
                        />
                      )}
                    </div>
                    <div className="flex flex-col gap-3 items-end min-w-[220px]">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>
                          {progress.done}/{progress.total} terminées
                        </span>
                      </div>
                      <div className="w-full h-3 bg-white/80 rounded-full border border-sky-200/60 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-500 to-indigo-600"
                          style={{ width: `${progress.percent}%` }}
                          aria-label={`Progression ${progress.percent}%`}
                        />
                      </div>
                      <span className="text-xs text-gray-600 font-semibold">{progress.percent}%</span>
                      <div className="flex gap-2">
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => {
                                setFormationToEdit(selectedFormation)
                                setShowWizard(true)
                              }}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-sky-500/90 backdrop-blur-sm border border-sky-400/30 text-white font-semibold hover:bg-sky-600/90 shadow-sm transition-all text-sm"
                            >
                              <Plus className="h-4 w-4" />
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDeleteFormation(selectedFormation.id)}
                              className="px-3 py-2 text-sm font-semibold border border-red-200 text-red-700 rounded-xl hover:bg-red-50 transition-all"
                            >
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Two-column layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Left column: Table of Contents */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white/85 backdrop-blur-2xl border border-white/70 shadow-xl ring-1 ring-inset ring-white/60 rounded-2xl p-4 sticky top-4">
                      <div className="flex items-center gap-3 mb-4">
                        <BookOpen className="h-5 w-5 text-sky-600" />
                        <h3 className="text-lg font-bold text-slate-900">Table des matières</h3>
                      </div>

                      <div className="space-y-2">
                        {selectedFormation.chapters.map((chapter) => (
                          <div key={chapter.id} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => toggleChapterExpansion(chapter.id)}
                              className="w-full flex items-center justify-between text-left bg-white/70 backdrop-blur-sm rounded-lg px-3 py-2 hover:bg-white/90 transition-colors border border-white/60"
                            >
                              <div className="flex items-center gap-2">
                                <ChevronRight
                                  className={`h-4 w-4 shrink-0 text-sky-600 transition-transform ${
                                    expandedChapters[chapter.id] ? 'rotate-90' : ''
                                  }`}
                                />
                                <Layers className="h-4 w-4 shrink-0 text-sky-600" />
                                <span className="font-semibold text-gray-900 text-sm">{chapter.title}</span>
                              </div>
                              <span className="text-xs text-gray-500">{chapter.subparts.length}</span>
                            </button>

                            {expandedChapters[chapter.id] && (
                              <div className="ml-6 space-y-1">
                                {chapter.subparts.map((subpart, subpartIdx) => {
                                  const isAccessible = isSubpartAccessible(selectedFormation, chapter, subpartIdx)
                                  const isSelected = selectedSubpartId === subpart.id

                                  return (
                                    <button
                                      key={subpart.id}
                                      type="button"
                                      onClick={() => isAccessible && setSelectedSubpartId(subpart.id)}
                                      disabled={!isAccessible}
                                      className={`w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${
                                        isSelected
                                          ? 'bg-sky-100/80 border-2 border-sky-400/60'
                                          : isAccessible
                                          ? 'hover:bg-white/70 border border-transparent'
                                          : 'opacity-50 cursor-not-allowed border border-transparent'
                                      }`}
                                    >
                                      {!isAccessible ? (
                                        <Lock className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                      ) : (
                                        <Video className="h-4 w-4 text-sky-600 mt-0.5 shrink-0" />
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate">
                                          {subpart.title}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                          {subpart.completed && (
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                                              <CheckCircle2 className="h-3 w-3" />
                                            </span>
                                          )}
                                          {subpart.quiz && (
                                            <span className="inline-flex items-center gap-1 text-xs">
                                              {subpart.quiz_passed ? (
                                                <>
                                                  <Trophy className="h-3 w-3 text-emerald-600" />
                                                </>
                                              ) : (
                                                <>
                                                  <ClipboardCheck className="h-3 w-3 text-sky-600" />
                                                </>
                                              )}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right column: Content */}
                  <div className="lg:col-span-2">
                    {selectedSubpartId ? (
                      (() => {
                        const selectedSubpart = selectedFormation.chapters
                          .flatMap((ch) => ch.subparts)
                          .find((s) => s.id === selectedSubpartId)

                        if (!selectedSubpart) return null

                        const parentChapter = selectedFormation.chapters.find((ch) =>
                          ch.subparts.some((s) => s.id === selectedSubpartId)
                        )
                        const subpartIdx = parentChapter?.subparts.findIndex((s) => s.id === selectedSubpartId) ?? -1
                        const isAccessible = parentChapter && subpartIdx !== -1
                          ? isSubpartAccessible(selectedFormation, parentChapter, subpartIdx)
                          : false

                        return (
                          <div className="bg-white/85 backdrop-blur-2xl border border-white/70 shadow-xl ring-1 ring-inset ring-white/60 rounded-2xl overflow-hidden">
                            {/* Subpart Header */}
                            <div className="bg-gradient-to-r from-sky-500 to-indigo-600 px-6 py-4 text-white">
                              <div className="flex items-center gap-3 mb-2">
                                <Video className="h-5 w-5" />
                                <span className="text-sm font-semibold opacity-90">Contenu du module</span>
                              </div>
                              <h3 className="text-2xl font-bold">{selectedSubpart.title}</h3>
                            </div>

                            {!isAccessible ? (
                              <div className="p-8">
                                <div className="flex flex-col items-center justify-center gap-4 text-center bg-orange-50/80 rounded-xl p-8 border-2 border-orange-200/60">
                                  <Lock className="h-12 w-12 text-orange-500" />
                                  <div>
                                    <h4 className="text-lg font-bold text-orange-900 mb-2">
                                      Contenu verrouillé
                                    </h4>
                                    <p className="text-orange-700">
                                      Terminez le quiz précédent pour débloquer ce module
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-6 space-y-6">
                                {/* Description */}
                                {selectedSubpart.description_html && (
                                  <div
                                    className="prose prose-sm max-w-none text-gray-700"
                                    dangerouslySetInnerHTML={{ __html: selectedSubpart.description_html }}
                                  />
                                )}

                                {/* Video */}
                                {selectedSubpart.vimeo_url ? (
                                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-gray-200/60 bg-black aspect-video shadow-lg">
                                    <iframe
                                      src={getVimeoEmbedUrl(selectedSubpart.vimeo_url)}
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                      className="absolute inset-0 h-full w-full"
                                      title={`Vimeo - ${selectedSubpart.title}`}
                                    />
                                  </div>
                                ) : (!selectedSubpart.pdf_url && !selectedSubpart.description_html) ? (
                                  <div className="rounded-xl border-2 border-dashed border-gray-300/60 p-12 text-center bg-gray-50/60">
                                    <Video className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                                    <p className="text-gray-500">Vidéo à venir</p>
                                  </div>
                                ) : null}

                                {/* Downloadable PDF resource */}
                                {selectedSubpart.pdf_url && (
                                  <div className="rounded-xl border-2 border-sky-200/60 bg-sky-50/60 p-5">
                                    <div className="flex items-center gap-3 mb-3">
                                      <FileDown className="h-5 w-5 text-sky-600" />
                                      <h4 className="text-base font-bold text-sky-900">Ressources à télécharger</h4>
                                    </div>
                                    <button
                                      onClick={() => downloadPdf(selectedSubpart.pdf_url!, selectedSubpart.pdf_name)}
                                      className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-sky-500/90 backdrop-blur-sm text-white text-sm font-semibold border border-sky-400/30 hover:bg-sky-600/90 transition-all shadow-sm"
                                    >
                                      <FileDown className="h-5 w-5" />
                                      {selectedSubpart.pdf_name || 'Télécharger le PDF'}
                                    </button>
                                  </div>
                                )}

                                {/* Mark Complete Button */}
                                <div className="flex items-center justify-between pt-4 border-t border-white/50">
                                  <button
                                    onClick={() => toggleCompletion(selectedSubpart.id, !selectedSubpart.completed)}
                                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                                      selectedSubpart.completed
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                        : 'bg-sky-500/90 backdrop-blur-sm border-sky-400/30 text-white hover:bg-sky-600/90'
                                    }`}
                                  >
                                    <CheckSquare className="h-5 w-5" />
                                    {selectedSubpart.completed ? 'Marqué comme terminé' : 'Marquer comme terminé'}
                                  </button>

                                  {isAdmin && (
                                    <button
                                      onClick={() =>
                                        setQuizManager({
                                          subpartId: selectedSubpart.id,
                                          subpartTitle: selectedSubpart.title,
                                          quiz: selectedSubpart.quiz
                                        })
                                      }
                                      className="px-4 py-3 bg-white/70 backdrop-blur-sm border border-sky-200/60 text-sky-700 rounded-xl text-sm font-semibold hover:bg-white/90 transition-all flex items-center gap-2"
                                    >
                                      <ClipboardCheck className="h-4 w-4" />
                                      {selectedSubpart.quiz ? 'Modifier quiz' : 'Créer quiz'}
                                    </button>
                                  )}
                                </div>

                                {/* Quiz Section */}
                                {selectedSubpart.quiz && (
                                  <div className="bg-gradient-to-br from-sky-50/80 to-indigo-50/80 rounded-xl p-6 border border-sky-200/60">
                                    <div className="flex items-start gap-4">
                                      <div className="flex-shrink-0">
                                        <div className="w-12 h-12 rounded-full bg-sky-500 flex items-center justify-center">
                                          <ClipboardCheck className="h-6 w-6 text-white" />
                                        </div>
                                      </div>
                                      <div className="flex-1">
                                        <h4 className="text-lg font-bold text-blue-900 mb-2">
                                          {selectedSubpart.quiz.title}
                                        </h4>
                                        {selectedSubpart.quiz.description && (
                                          <p className="text-sm text-blue-700 mb-4">
                                            {selectedSubpart.quiz.description}
                                          </p>
                                        )}
                                        <div className="flex flex-wrap items-center gap-4 text-sm text-blue-700 mb-4">
                                          <span className="flex items-center gap-1">
                                            <ClipboardCheck className="h-4 w-4" />
                                            {selectedSubpart.quiz.questions.length} questions
                                          </span>
                                          <span>•</span>
                                          <span>Score requis : {selectedSubpart.quiz.passing_score}%</span>
                                          {selectedSubpart.quiz_passed && (
                                            <>
                                              <span>•</span>
                                              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                                                <Trophy className="h-4 w-4" />
                                                Validé
                                              </span>
                                            </>
                                          )}
                                        </div>
                                        <button
                                          onClick={() =>
                                            setActiveQuiz({
                                              quiz: selectedSubpart.quiz!,
                                              subpartId: selectedSubpart.id
                                            })
                                          }
                                          className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                                            selectedSubpart.quiz_passed
                                              ? 'bg-white/70 backdrop-blur-sm text-sky-600 border border-sky-300/60 hover:bg-white/90'
                                              : 'bg-sky-500/90 backdrop-blur-sm text-white border border-sky-400/30 hover:bg-sky-600/90 shadow-sm'
                                          }`}
                                        >
                                          {selectedSubpart.quiz_passed ? 'Refaire le quiz' : 'Commencer le quiz'}
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()
                    ) : (
                      <div className="bg-white/85 backdrop-blur-2xl border border-white/70 shadow-xl ring-1 ring-inset ring-white/60 rounded-2xl p-12 text-center">
                        <PlayCircle className="h-16 w-16 text-slate-400 mx-auto mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                          Sélectionnez un module
                        </h3>
                        <p className="text-slate-600">
                          Choisissez un module dans la table des matières pour commencer
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  )
}
