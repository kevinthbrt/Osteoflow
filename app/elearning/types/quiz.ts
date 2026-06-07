export type QuizAnswer = {
  id?: string
  answer_text: string
  is_correct: boolean
  order_index: number
}

export type QuizQuestion = {
  id?: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'multiple_answer'
  points: number
  order_index: number
  explanation?: string
  answers: QuizAnswer[]
}

export type Quiz = {
  id?: string
  subpart_id?: string
  title: string
  description?: string
  passing_score: number
  questions: QuizQuestion[]
}

export type QuizAttempt = {
  id: string
  quiz_id: string
  user_id: string
  score: number
  total_questions: number
  correct_answers: number
  passed: boolean
  answers_data: Record<string, string[]>
  started_at?: string
  completed_at?: string
}
