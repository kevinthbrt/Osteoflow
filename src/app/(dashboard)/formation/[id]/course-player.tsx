'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Lock,
  GraduationCap,
  Loader2,
  Trophy,
  Target,
  RotateCcw,
  AlertCircle,
  Sparkles,
  CheckSquare,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/* ── Types ── */
type QuizAnswer = {
  id: string
  answer_text: string
  is_correct: boolean
  order_index: number
}

type QuizQuestion = {
  id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'multiple_answer'
  points: number
  order_index: number
  explanation?: string
  answers: QuizAnswer[]
}

type Quiz = {
  id: string
  title: string
  description?: string
  passing_score: number
  quiz_passed: boolean
  questions: QuizQuestion[]
}

type Subpart = {
  id: string
  title: string
  order_index: number
  vimeo_url?: string
  description_html?: string
  completed: boolean
  quiz?: Quiz | null
}

type Chapter = {
  id: string
  title: string
  order_index: number
  subparts: Subpart[]
}

type Formation = {
  id: string
  title: string
  description?: string
  photo_url?: string
  total: number
  completed: number
  chapters: Chapter[]
}

/* ── Helpers ── */
function getVimeoEmbedUrl(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('player.vimeo.com')) return url
    const parts = parsed.pathname.split('/').filter(Boolean)
    const videoId = parts[parts.length - 1]
    return videoId ? `https://player.vimeo.com/video/${videoId}` : url
  } catch {
    return url
  }
}

function computeAccessible(formation: Formation): Set<string> {
  const accessible = new Set<string>()
  const allSubs: Subpart[] = formation.chapters.flatMap((c) => c.subparts)
  for (let i = 0; i < allSubs.length; i++) {
    if (i === 0) {
      accessible.add(allSubs[i].id)
    } else {
      const prev = allSubs[i - 1]
      const prevOk = accessible.has(prev.id)
      const quizOk = !prev.quiz || prev.quiz.quiz_passed
      if (prevOk && quizOk) accessible.add(allSubs[i].id)
    }
  }
  return accessible
}

/* ── Quiz component ── */
function QuizModal({
  quiz,
  practitionerEmail,
  onPassed,
  onClose,
}: {
  quiz: Quiz
  practitionerEmail: string
  onPassed: () => void
  onClose: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [phase, setPhase] = useState<'quiz' | 'results'>('quiz')
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const question = quiz.questions[idx]
  const total = quiz.questions.length

  const toggleAnswer = (qId: string, aId: string) => {
    setAnswers((prev) => {
      const cur = prev[qId] || []
      if (question.question_type === 'multiple_answer') {
        return { ...prev, [qId]: cur.includes(aId) ? cur.filter((x) => x !== aId) : [...cur, aId] }
      }
      return { ...prev, [qId]: [aId] }
    })
  }

  const isSelected = (aId: string) => (answers[question?.id] || []).includes(aId)
  const isAnswered = (q: QuizQuestion) => (answers[q.id] || []).length > 0

  const submit = async () => {
    let correct = 0
    for (const q of quiz.questions) {
      const userAns = answers[q.id] || []
      const correctIds = q.answers.filter((a) => a.is_correct).map((a) => a.id)
      if (userAns.length === correctIds.length && userAns.every((id) => correctIds.includes(id))) {
        correct++
      }
    }
    const finalScore = Math.round((correct / total) * 100)
    const passed = finalScore >= quiz.passing_score
    setScore(finalScore)
    setCorrectCount(correct)
    setPhase('results')
    setSubmitting(true)
    try {
      await fetch('/api/osteoupgrade-submit-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: practitionerEmail,
          quiz_id: quiz.id,
          score: finalScore,
          total_questions: total,
          correct_answers: correct,
          passed,
          answers_data: answers,
        }),
      })
      if (passed) onPassed()
    } catch {
      // best-effort
    } finally {
      setSubmitting(false)
    }
  }

  const passed = score >= quiz.passing_score

  if (phase === 'results') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-background rounded-3xl shadow-2xl max-w-lg w-full p-8 text-center space-y-6">
          <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full ${passed ? 'bg-emerald-500' : 'bg-amber-500'}`}>
            {passed ? <Trophy className="h-10 w-10 text-white" /> : <Target className="h-10 w-10 text-white" />}
          </div>
          <div>
            <h3 className="text-2xl font-bold mb-1">{passed ? 'Félicitations !' : 'Pas tout à fait...'}</h3>
            <p className="text-muted-foreground">
              {passed ? 'Vous avez réussi le quiz !' : `Score requis : ${quiz.passing_score}%`}
            </p>
          </div>
          <div className="rounded-2xl border border-border/40 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Votre score</span>
              <span className={`text-3xl font-bold ${passed ? 'text-emerald-600' : 'text-amber-600'}`}>{score}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${passed ? 'bg-emerald-500' : 'bg-amber-500'}`}
                style={{ width: `${score}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">{correctCount} / {total} questions correctes — Requis : {quiz.passing_score}%</p>
          </div>
          <div className="flex gap-3">
            {!passed && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setPhase('quiz'); setIdx(0); setAnswers({}); setScore(0) }}
              >
                <RotateCcw className="h-4 w-4 mr-1.5" /> Réessayer
              </Button>
            )}
            <Button className={`flex-1 ${passed ? 'bg-emerald-600 hover:bg-emerald-700' : ''}`} onClick={onClose} disabled={submitting}>
              {passed ? 'Continuer' : 'Fermer'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-500 to-indigo-600 px-6 py-5 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white/80 text-sm font-medium">
              <Sparkles className="h-4 w-4" /> Quiz
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white transition">
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="text-xl font-bold text-white">{quiz.title}</h2>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-white/70">
              <span>Question {idx + 1} / {total}</span>
              <span>{Math.round(((idx + 1) / total) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${((idx + 1) / total) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-muted/40 rounded-2xl p-5">
            <div className="flex gap-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-violet-500 text-white text-xs font-bold flex-shrink-0">{idx + 1}</span>
              <p className="font-semibold text-base leading-snug">{question.question_text}</p>
            </div>
            {question.question_type === 'multiple_answer' && (
              <div className="flex items-center gap-1.5 text-xs text-violet-600 mt-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg px-3 py-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> Plusieurs réponses possibles
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {question.answers.sort((a, b) => a.order_index - b.order_index).map((ans) => (
              <button
                key={ans.id}
                onClick={() => toggleAnswer(question.id, ans.id)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected(ans.id)
                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                    : 'border-border bg-background hover:border-violet-300 hover:bg-accent/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected(ans.id) ? 'border-violet-500 bg-violet-500' : 'border-muted-foreground/40'
                  }`}>
                    {isSelected(ans.id) && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span className={`text-sm font-medium ${isSelected(ans.id) ? 'text-violet-900 dark:text-violet-100' : ''}`}>
                    {ans.answer_text}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-border/40 flex justify-between">
          <Button variant="ghost" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>Précédent</Button>
          {idx < total - 1 ? (
            <Button
              disabled={!isAnswered(question)}
              onClick={() => setIdx((i) => i + 1)}
            >
              Suivant <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              disabled={!isAnswered(question) || submitting}
              onClick={submit}
              className="bg-violet-600 hover:bg-violet-700"
            >
              Terminer
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main player ── */
export function CoursePlayer({
  formationId,
  practitionerEmail,
}: {
  formationId: string
  practitionerEmail: string
}) {
  const router = useRouter()
  const [formation, setFormation] = useState<Formation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selectedSubpartId, setSelectedSubpartId] = useState<string>('')
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({})
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null)
  const [marking, setMarking] = useState(false)

  const loadFormation = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ formation_id: formationId, email: practitionerEmail })
      const res = await fetch(`/api/osteoupgrade-course-full?${params}`, { cache: 'no-store' })
      if (!res.ok) { setError(true); return }
      const data: Formation = await res.json()
      setFormation(data)

      // Auto-select first incomplete subpart
      const allSubs = data.chapters.flatMap((c) => c.subparts)
      const target = allSubs.find((s) => !s.completed) || allSubs[0]
      if (target) {
        setSelectedSubpartId(target.id)
        const parentChapter = data.chapters.find((c) => c.subparts.some((s) => s.id === target.id))
        const initial: Record<string, boolean> = {}
        data.chapters.forEach((c) => { initial[c.id] = c.id === parentChapter?.id })
        setExpandedChapters(initial)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [formationId, practitionerEmail])

  useEffect(() => { loadFormation() }, [loadFormation])

  const accessible = formation ? computeAccessible(formation) : new Set<string>()
  const allSubparts = formation?.chapters.flatMap((c) => c.subparts) ?? []
  const selectedSubpart = allSubparts.find((s) => s.id === selectedSubpartId) ?? null

  const pct = formation && formation.total > 0
    ? Math.round((formation.completed / formation.total) * 100)
    : 0

  const handleToggleComplete = async () => {
    if (!selectedSubpart || marking) return
    const willComplete = !selectedSubpart.completed
    setMarking(true)
    try {
      await fetch('/api/osteoupgrade-mark-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: practitionerEmail, subpart_id: selectedSubpart.id, completed: willComplete }),
      })
      // Optimistic update
      setFormation((prev) => {
        if (!prev) return prev
        const delta = willComplete ? 1 : -1
        return {
          ...prev,
          completed: Math.max(0, Math.min(prev.total, prev.completed + delta)),
          chapters: prev.chapters.map((c) => ({
            ...c,
            subparts: c.subparts.map((s) =>
              s.id === selectedSubpart.id ? { ...s, completed: willComplete } : s
            ),
          })),
        }
      })
    } catch {
      // best-effort
    } finally {
      setMarking(false)
    }
  }

  const handleQuizPassed = () => {
    if (!activeQuiz || !selectedSubpart) return
    // Mark quiz as passed in local state, auto-mark subpart complete
    setFormation((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        chapters: prev.chapters.map((c) => ({
          ...c,
          subparts: c.subparts.map((s) => {
            if (s.id === selectedSubpart.id) {
              return {
                ...s,
                completed: true,
                quiz: s.quiz ? { ...s.quiz, quiz_passed: true } : s.quiz,
              }
            }
            return s
          }),
        })),
        completed: prev.completed + (selectedSubpart.completed ? 0 : 1),
      }
    })
    // Also write mark-complete
    fetch('/api/osteoupgrade-mark-complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: practitionerEmail, subpart_id: selectedSubpart.id, completed: true }),
    }).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
      </div>
    )
  }

  if (error || !formation) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4 text-center">
        <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Impossible de charger la formation.</p>
        <Button variant="outline" onClick={loadFormation}>Réessayer</Button>
      </div>
    )
  }

  return (
    <>
      {activeQuiz && (
        <QuizModal
          quiz={activeQuiz}
          practitionerEmail={practitionerEmail}
          onPassed={() => { handleQuizPassed(); setActiveQuiz(null) }}
          onClose={() => setActiveQuiz(null)}
        />
      )}

      <div className="flex gap-0 -mx-4 -my-6 lg:-mx-8 lg:-my-6 h-[calc(100vh-4rem)] overflow-hidden">

        {/* ── Left sidebar ── */}
        <div className="w-72 flex-shrink-0 border-r border-border/40 bg-card flex flex-col overflow-hidden">
          {/* Back + formation title */}
          <div className="flex-shrink-0 px-4 pt-4 pb-3 border-b border-border/40 space-y-3">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Retour
            </button>
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <GraduationCap className="h-4 w-4 text-white" />
              </div>
              <p className="text-sm font-semibold leading-tight line-clamp-3">{formation.title}</p>
            </div>
            {/* Progress bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{formation.completed}/{formation.total} modules</span>
                <span className={`font-semibold ${pct === 100 ? 'text-emerald-600' : 'text-violet-600'}`}>{pct}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-violet-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Chapter / subpart list */}
          <div className="flex-1 overflow-y-auto py-2">
            {formation.chapters.map((chapter) => {
              const chapterDone = chapter.subparts.filter((s) => s.completed).length
              const isExpanded = expandedChapters[chapter.id] ?? false
              return (
                <div key={chapter.id}>
                  <button
                    onClick={() => setExpandedChapters((prev) => ({ ...prev, [chapter.id]: !prev[chapter.id] }))}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-accent/40 transition-colors"
                  >
                    {isExpanded
                      ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                    <span className="text-xs font-semibold flex-1 leading-snug">{chapter.title}</span>
                    <span className="text-xs text-muted-foreground tabular-nums flex-shrink-0">
                      {chapterDone}/{chapter.subparts.length}
                    </span>
                  </button>

                  {isExpanded && chapter.subparts.map((sub) => {
                    const isAccessible = accessible.has(sub.id)
                    const isSelected = sub.id === selectedSubpartId
                    return (
                      <button
                        key={sub.id}
                        disabled={!isAccessible}
                        onClick={() => isAccessible && setSelectedSubpartId(sub.id)}
                        className={`w-full flex items-center gap-2.5 pl-8 pr-3 py-2 text-left transition-colors text-xs ${
                          isSelected
                            ? 'bg-violet-500/10 text-violet-700 dark:text-violet-300 font-medium'
                            : isAccessible
                            ? 'hover:bg-accent/40 text-foreground'
                            : 'text-muted-foreground/50 cursor-not-allowed'
                        }`}
                      >
                        {sub.completed
                          ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                          : isAccessible
                          ? <Circle className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
                          : <Lock className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />}
                        <span className="leading-snug line-clamp-2">{sub.title}</span>
                        {sub.quiz && !sub.quiz.quiz_passed && isAccessible && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex-shrink-0 font-medium">
                            Quiz
                          </span>
                        )}
                        {sub.quiz?.quiz_passed && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex-shrink-0 font-medium">
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Right content ── */}
        <div className="flex-1 overflow-y-auto">
          {selectedSubpart ? (
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
              {/* Title + actions */}
              <div className="flex items-start justify-between gap-4">
                <h1 className="text-xl font-bold leading-snug flex-1">{selectedSubpart.title}</h1>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedSubpart.quiz && !selectedSubpart.quiz.quiz_passed && accessible.has(selectedSubpart.id) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveQuiz(selectedSubpart.quiz!)}
                      className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                      Faire le quiz
                    </Button>
                  )}
                  {selectedSubpart.quiz?.quiz_passed && (
                    <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1.5">
                      <Trophy className="h-3.5 w-3.5" /> Quiz validé
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant={selectedSubpart.completed ? 'outline' : 'default'}
                    onClick={handleToggleComplete}
                    disabled={marking}
                    className={selectedSubpart.completed ? '' : 'bg-emerald-600 hover:bg-emerald-700'}
                  >
                    {marking
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : selectedSubpart.completed
                      ? <><CheckSquare className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> Terminé</>
                      : <><CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Marquer comme terminé</>}
                  </Button>
                </div>
              </div>

              {/* Video player */}
              {selectedSubpart.vimeo_url && (
                <div className="aspect-video w-full rounded-xl overflow-hidden bg-black shadow-lg">
                  <iframe
                    src={getVimeoEmbedUrl(selectedSubpart.vimeo_url)}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}

              {/* Description */}
              {selectedSubpart.description_html && (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-border/40 bg-card p-5"
                  dangerouslySetInnerHTML={{ __html: selectedSubpart.description_html }}
                />
              )}

              {/* Quiz locked notice */}
              {selectedSubpart.quiz && !selectedSubpart.quiz.quiz_passed && accessible.has(selectedSubpart.id) && !selectedSubpart.completed && (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-4">
                  <Sparkles className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Quiz requis pour débloquer la suite</p>
                    <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
                      Score minimum : {selectedSubpart.quiz.passing_score}%
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="ml-auto bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={() => setActiveQuiz(selectedSubpart.quiz!)}
                  >
                    Commencer le quiz
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
              <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm">Sélectionnez un module dans le menu à gauche.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
