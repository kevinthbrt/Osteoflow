'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Plus,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle2,
  GripVertical,
  ClipboardCheck
} from 'lucide-react'
import type { Quiz, QuizAnswer, QuizQuestion } from '../types/quiz'

interface QuizManagerProps {
  subpartId: string
  subpartTitle: string
  existingQuiz?: Quiz
  onClose: () => void
  onSave: () => void
}

export default function QuizManager({ subpartId, subpartTitle, existingQuiz, onClose, onSave }: QuizManagerProps) {
  const [quiz, setQuiz] = useState<Quiz>({
    ...existingQuiz,
    subpart_id: subpartId,
    title: existingQuiz?.title || `Quiz - ${subpartTitle}`,
    description: existingQuiz?.description || '',
    passing_score: existingQuiz?.passing_score || 100,
    questions: existingQuiz?.questions || []
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addQuestion = () => {
    setQuiz({
      ...quiz,
      questions: [
        ...quiz.questions,
        {
          question_text: '',
          question_type: 'multiple_choice',
          points: 1,
          order_index: quiz.questions.length,
          explanation: '',
          answers: [
            { answer_text: '', is_correct: false, order_index: 0 },
            { answer_text: '', is_correct: false, order_index: 1 }
          ]
        }
      ]
    })
  }

  const removeQuestion = (index: number) => {
    setQuiz({ ...quiz, questions: quiz.questions.filter((_, i) => i !== index).map((q, i) => ({ ...q, order_index: i })) })
  }

  const updateQuestion = (index: number, updates: Partial<QuizQuestion>) => {
    setQuiz({ ...quiz, questions: quiz.questions.map((q, i) => (i === index ? { ...q, ...updates } : q)) })
  }

  const addAnswer = (questionIndex: number) => {
    const question = quiz.questions[questionIndex]
    updateQuestion(questionIndex, {
      answers: [...question.answers, { answer_text: '', is_correct: false, order_index: question.answers.length }]
    })
  }

  const removeAnswer = (questionIndex: number, answerIndex: number) => {
    const question = quiz.questions[questionIndex]
    updateQuestion(questionIndex, { answers: question.answers.filter((_, i) => i !== answerIndex).map((a, i) => ({ ...a, order_index: i })) })
  }

  const updateAnswer = (questionIndex: number, answerIndex: number, updates: Partial<QuizAnswer>) => {
    const question = quiz.questions[questionIndex]
    updateQuestion(questionIndex, { answers: question.answers.map((a, i) => (i === answerIndex ? { ...a, ...updates } : a)) })
  }

  const toggleCorrectAnswer = (questionIndex: number, answerIndex: number) => {
    const question = quiz.questions[questionIndex]
    if (question.question_type === 'multiple_choice' || question.question_type === 'true_false') {
      updateQuestion(questionIndex, { answers: question.answers.map((a, i) => ({ ...a, is_correct: i === answerIndex })) })
    } else {
      updateAnswer(questionIndex, answerIndex, { is_correct: !question.answers[answerIndex].is_correct })
    }
  }

  const validateQuiz = (): string | null => {
    if (!quiz.title.trim()) return 'Le titre du quiz est requis'
    if (quiz.questions.length === 0) return 'Le quiz doit contenir au moins une question'
    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i]
      if (!q.question_text.trim()) return `La question ${i + 1} doit avoir un texte`
      if (q.answers.length < 2) return `La question ${i + 1} doit avoir au moins 2 réponses`
      if (!q.answers.some((a) => a.is_correct)) return `La question ${i + 1} doit avoir au moins une réponse correcte`
      if (q.answers.some((a) => !a.answer_text.trim())) return `Toutes les réponses de la question ${i + 1} doivent avoir un texte`
    }
    return null
  }

  const handleSave = async () => {
    const validationError = validateQuiz()
    if (validationError) { setError(validationError); return }
    setSaving(true)
    setError(null)
    try {
      if (existingQuiz?.id) {
        await supabase.from('elearning_quizzes').update({ title: quiz.title, description: quiz.description, passing_score: quiz.passing_score }).eq('id', existingQuiz.id)
        await supabase.from('elearning_quiz_questions').delete().eq('quiz_id', existingQuiz.id)
        for (const question of quiz.questions) {
          const { data: questionData, error: questionError } = await supabase.from('elearning_quiz_questions')
            .insert({ quiz_id: existingQuiz.id, question_text: question.question_text, question_type: question.question_type, points: question.points, order_index: question.order_index, explanation: question.explanation })
            .select().single()
          if (questionError) throw questionError
          for (const answer of question.answers) {
            const { error: answerError } = await supabase.from('elearning_quiz_answers')
              .insert({ question_id: questionData.id, answer_text: answer.answer_text, is_correct: answer.is_correct, order_index: answer.order_index })
            if (answerError) throw answerError
          }
        }
      } else {
        const { data: quizData, error: quizError } = await supabase.from('elearning_quizzes')
          .insert({ subpart_id: quiz.subpart_id, title: quiz.title, description: quiz.description, passing_score: quiz.passing_score })
          .select().single()
        if (quizError) throw quizError
        for (const question of quiz.questions) {
          const { data: questionData, error: questionError } = await supabase.from('elearning_quiz_questions')
            .insert({ quiz_id: quizData.id, question_text: question.question_text, question_type: question.question_type, points: question.points, order_index: question.order_index, explanation: question.explanation })
            .select().single()
          if (questionError) throw questionError
          for (const answer of question.answers) {
            const { error: answerError } = await supabase.from('elearning_quiz_answers')
              .insert({ question_id: questionData.id, answer_text: answer.answer_text, is_correct: answer.is_correct, order_index: answer.order_index })
            if (answerError) throw answerError
          }
        }
      }
      onSave()
      onClose()
    } catch (err) {
      console.error('Error saving quiz:', err)
      setError('Erreur lors de la sauvegarde du quiz')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!existingQuiz?.id) return
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce quiz ? Cette action est irréversible.')) return
    setSaving(true)
    try {
      await supabase.from('elearning_quizzes').delete().eq('id', existingQuiz.id)
      onSave()
      onClose()
    } catch (err) {
      console.error('Error deleting quiz:', err)
      setError('Erreur lors de la suppression du quiz')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-5 rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-blue-100 mb-1">
                <ClipboardCheck className="h-5 w-5" />
                <span className="font-semibold">Gestion des quiz</span>
              </div>
              <h2 className="text-2xl font-bold text-white">{subpartTitle}</h2>
            </div>
            <button onClick={onClose} className="text-white hover:text-blue-100 transition" aria-label="Fermer">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900 mb-1">Erreur</h4>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Paramètres du quiz</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titre du quiz</label>
                <input type="text" value={quiz.title} onChange={(e) => setQuiz({ ...quiz, title: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Quiz de validation" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Score requis (%)</label>
                <input type="number" min="0" max="100" value={quiz.passing_score} onChange={(e) => setQuiz({ ...quiz, passing_score: parseInt(e.target.value) || 100 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description (optionnel)</label>
              <textarea value={quiz.description} onChange={(e) => setQuiz({ ...quiz, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Description du quiz..." />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Questions ({quiz.questions.length})</h3>
              <button onClick={addQuestion} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Ajouter une question
              </button>
            </div>

            {quiz.questions.map((question, qIdx) => (
              <div key={qIdx} className="bg-gray-50 rounded-xl p-5 space-y-4 border-2 border-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <span className="font-bold text-gray-900">Question {qIdx + 1}</span>
                  </div>
                  <button onClick={() => removeQuestion(qIdx)} className="text-red-600 hover:text-red-700 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Texte de la question</label>
                    <input type="text" value={question.question_text} onChange={(e) => updateQuestion(qIdx, { question_text: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Entrez votre question..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Type de question</label>
                      <select value={question.question_type} onChange={(e) => updateQuestion(qIdx, { question_type: e.target.value as any })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="multiple_choice">Choix unique</option>
                        <option value="multiple_answer">Choix multiples</option>
                        <option value="true_false">Vrai/Faux</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                      <input type="number" min="1" value={question.points} onChange={(e) => updateQuestion(qIdx, { points: parseInt(e.target.value) || 1 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Explication (optionnel)</label>
                    <textarea value={question.explanation} onChange={(e) => updateQuestion(qIdx, { explanation: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2} placeholder="Explication affichée après la réponse..." />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Réponses ({question.answers.length})</label>
                      <button onClick={() => addAnswer(qIdx)} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                        <Plus className="h-3 w-3" />
                        Ajouter
                      </button>
                    </div>
                    {question.answers.map((answer, aIdx) => (
                      <div key={aIdx} className="flex items-center gap-2">
                        <button onClick={() => toggleCorrectAnswer(qIdx, aIdx)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${answer.is_correct ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300 hover:border-blue-500'}`}>
                          {answer.is_correct && <CheckCircle2 className="h-4 w-4 text-white" />}
                        </button>
                        <input type="text" value={answer.answer_text} onChange={(e) => updateAnswer(qIdx, aIdx, { answer_text: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder={`Réponse ${aIdx + 1}`} />
                        {question.answers.length > 2 && (
                          <button onClick={() => removeAnswer(qIdx, aIdx)} className="text-red-600 hover:text-red-700 transition">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {quiz.questions.length === 0 && (
              <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                <ClipboardCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">Aucune question</p>
                <p className="text-sm text-gray-500 mb-4">Ajoutez des questions à votre quiz</p>
                <button onClick={addQuestion} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition">Ajouter la première question</button>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            {existingQuiz?.id && (
              <button onClick={handleDelete} disabled={saving} className="px-4 py-2 bg-red-50 text-red-700 border-2 border-red-200 rounded-lg font-semibold hover:bg-red-100 transition disabled:opacity-50">
                Supprimer le quiz
              </button>
            )}
            <div className="flex gap-3 ml-auto">
              <button onClick={onClose} disabled={saving} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50">Annuler</button>
              <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
