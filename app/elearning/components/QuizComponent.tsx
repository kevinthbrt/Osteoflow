'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Award,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Trophy,
  Target
} from 'lucide-react'
import type { Quiz, QuizAnswer, QuizQuestion } from '../types/quiz'

type QuizAttempt = {
  id: string
  score: number
  passed: boolean
  completed_at: string
}

interface QuizComponentProps {
  quiz: Quiz
  subpartId: string
  userId: string
  onQuizPassed: () => void
  onClose: () => void
}

export default function QuizComponent({ quiz, subpartId, userId, onQuizPassed, onClose }: QuizComponentProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<Record<string, string[]>>({})
  const [showResults, setShowResults] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [score, setScore] = useState(0)
  const [showExplanation, setShowExplanation] = useState<string | null>(null)
  const [lastAttempt, setLastAttempt] = useState<QuizAttempt | null>(null)

  const currentQuestion = quiz.questions[currentQuestionIndex]
  const totalQuestions = quiz.questions.length
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100

  useEffect(() => {
    checkLastAttempt()
  }, [])

  const checkLastAttempt = async () => {
    try {
      const { data: attempts, error } = await supabase
        .from('elearning_quiz_attempts')
        .select('*')
        .eq('quiz_id', quiz.id)
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Error checking quiz attempts:', error)
        return
      }

      if (attempts && attempts.length > 0) {
        setLastAttempt(attempts[0] as QuizAttempt)
      }
    } catch (error) {
      console.error('Error checking quiz attempts:', error)
    }
  }

  const handleAnswerSelection = (answerId: string) => {
    if (!currentQuestion?.id) return
    const questionId = currentQuestion.id

    if (currentQuestion.question_type === 'multiple_answer') {
      setUserAnswers((prev) => {
        const current = prev[questionId] || []
        const isSelected = current.includes(answerId)
        return {
          ...prev,
          [questionId]: isSelected
            ? current.filter((id) => id !== answerId)
            : [...current, answerId]
        }
      })
    } else {
      setUserAnswers((prev) => ({
        ...prev,
        [questionId]: [answerId]
      }))
    }
  }

  const isAnswerSelected = (answerId: string) => {
    if (!currentQuestion?.id) return false
    const questionId = currentQuestion.id
    return (userAnswers[questionId] || []).includes(answerId)
  }

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
      setShowExplanation(null)
    } else {
      calculateResults()
    }
  }

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
      setShowExplanation(null)
    }
  }

  const isQuestionAnswered = (questionId: string) => {
    return (userAnswers[questionId] || []).length > 0
  }

  const calculateResults = async () => {
    let correctCount = 0

    quiz.questions.forEach((question) => {
      if (!question.id) return

      const userAnswer = userAnswers[question.id] || []
      const correctAnswers = question.answers
        .filter((a) => a.is_correct)
        .map((a) => a.id)
        .filter((id): id is string => id !== undefined)

      const isCorrect =
        userAnswer.length === correctAnswers.length &&
        userAnswer.every((id) => correctAnswers.includes(id))

      if (isCorrect) correctCount++
    })

    const finalScore = Math.round((correctCount / totalQuestions) * 100)
    const passed = finalScore >= quiz.passing_score

    setScore(finalScore)
    setShowResults(true)
    setQuizCompleted(true)

    try {
      const { error } = await supabase
        .from('elearning_quiz_attempts')
        .insert({
          quiz_id: quiz.id,
          user_id: userId,
          score: finalScore,
          total_questions: totalQuestions,
          correct_answers: correctCount,
          passed,
          answers_data: userAnswers,
          completed_at: new Date().toISOString()
        })

      if (error) {
        console.error('Error saving quiz attempt:', error)
        return
      }

      if (passed) {
        onQuizPassed()
      }
    } catch (error) {
      console.error('Error saving quiz attempt:', error)
    }
  }

  const handleRetry = () => {
    setCurrentQuestionIndex(0)
    setUserAnswers({})
    setShowResults(false)
    setQuizCompleted(false)
    setScore(0)
    setShowExplanation(null)
  }

  const getAnswerStatus = (answer: QuizAnswer) => {
    if (!showResults || !currentQuestion?.id) return null

    const questionId = currentQuestion.id
    const userAnswer = userAnswers[questionId] || []
    const isSelected = answer.id ? userAnswer.includes(answer.id) : false

    if (answer.is_correct) {
      return 'correct'
    } else if (isSelected && !answer.is_correct) {
      return 'incorrect'
    }

    return null
  }

  if (lastAttempt && lastAttempt.passed && !quizCompleted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8">
          <div className="text-center space-y-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 mb-4">
              <Trophy className="h-10 w-10 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Quiz déjà validé !</h3>
              <p className="text-gray-600">
                Vous avez déjà réussi ce quiz avec un score de <span className="font-bold text-emerald-600">{lastAttempt.score}%</span>
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition">
                Fermer
              </button>
              <button onClick={() => setLastAttempt(null)} className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Refaire
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (showResults) {
    const passed = score >= quiz.passing_score
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-8">
          <div className="text-center space-y-6">
            <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${
              passed ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-orange-400 to-orange-600'
            } mb-4 animate-in zoom-in duration-500`}>
              {passed ? <Trophy className="h-12 w-12 text-white" /> : <Target className="h-12 w-12 text-white" />}
            </div>
            <div>
              <h3 className="text-3xl font-bold text-gray-900 mb-2">{passed ? 'Félicitations !' : 'Pas tout à fait...'}</h3>
              <p className="text-lg text-gray-600">
                {passed ? 'Vous avez réussi le quiz avec succès !' : `Il vous faut ${quiz.passing_score}% pour valider ce quiz.`}
              </p>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">Votre score</span>
                <span className={`text-4xl font-bold ${passed ? 'text-emerald-600' : 'text-orange-600'}`}>{score}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-1000 ${passed ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' : 'bg-gradient-to-r from-orange-500 to-orange-600'}`} style={{ width: `${score}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{Math.round((score / 100) * totalQuestions)} / {totalQuestions} questions correctes</span>
                <span className="text-gray-600">Requis: {quiz.passing_score}%</span>
              </div>
            </div>
            <div className="flex gap-3">
              {!passed && (
                <button onClick={handleRetry} className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition flex items-center justify-center gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Réessayer
                </button>
              )}
              <button onClick={onClose} className={`flex-1 px-6 py-3 ${passed ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' : 'bg-gray-100 text-gray-700'} rounded-xl font-semibold hover:opacity-90 transition`}>
                {passed ? 'Continuer' : 'Fermer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 rounded-t-3xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-blue-100">
              <Sparkles className="h-5 w-5" />
              <span className="font-semibold">Quiz</span>
            </div>
            <button onClick={onClose} className="text-white hover:text-blue-100 transition" aria-label="Fermer">
              <XCircle className="h-6 w-6" />
            </button>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">{quiz.title}</h2>
          {quiz.description && <p className="text-blue-100 text-sm">{quiz.description}</p>}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm text-blue-100">
              <span>Question {currentQuestionIndex + 1} sur {totalQuestions}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-blue-400/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white font-bold text-sm shrink-0">
                {currentQuestionIndex + 1}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 flex-1">{currentQuestion.question_text}</h3>
            </div>
            {currentQuestion.question_type === 'multiple_answer' && (
              <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4" />
                <span>Plusieurs réponses possibles</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {currentQuestion.answers
              .sort((a, b) => a.order_index - b.order_index)
              .map((answer) => {
                if (!answer.id) return null
                const answerId = answer.id
                const isSelected = isAnswerSelected(answerId)
                const status = getAnswerStatus(answer)
                return (
                  <button
                    key={answerId}
                    onClick={() => !showResults && handleAnswerSelection(answerId)}
                    disabled={showResults}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                      status === 'correct' ? 'border-emerald-500 bg-emerald-50'
                      : status === 'incorrect' ? 'border-red-500 bg-red-50'
                      : isSelected ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        status === 'correct' ? 'border-emerald-500 bg-emerald-500'
                        : status === 'incorrect' ? 'border-red-500 bg-red-500'
                        : isSelected ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                      }`}>
                        {(isSelected || status) && (
                          status === 'correct' ? <CheckCircle2 className="h-4 w-4 text-white" />
                          : status === 'incorrect' ? <XCircle className="h-4 w-4 text-white" />
                          : <div className="w-2 h-2 rounded-full bg-white" />
                        )}
                      </div>
                      <span className={`font-medium ${
                        status === 'correct' ? 'text-emerald-900'
                        : status === 'incorrect' ? 'text-red-900'
                        : isSelected ? 'text-blue-900'
                        : 'text-gray-700'
                      }`}>{answer.answer_text}</span>
                    </div>
                  </button>
                )
              })}
          </div>

          {showExplanation && currentQuestion.explanation && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">Explication</h4>
                  <p className="text-blue-800 text-sm">{currentQuestion.explanation}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button onClick={handlePrevious} disabled={currentQuestionIndex === 0} className="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed">
              Précédent
            </button>
            <div className="flex gap-2">
              {currentQuestion.explanation && currentQuestion.id && (
                <button onClick={() => setShowExplanation(showExplanation ? null : currentQuestion.id!)} className="px-4 py-2 rounded-lg font-medium text-blue-600 hover:bg-blue-50 transition">
                  {showExplanation ? 'Masquer' : 'Voir'} l'explication
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!currentQuestion.id || !isQuestionAnswered(currentQuestion.id)}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {currentQuestionIndex === totalQuestions - 1 ? 'Terminer' : 'Suivant'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
