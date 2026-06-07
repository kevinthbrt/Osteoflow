export interface RehabExercise {
  id: string
  name: string
  region: string
  type: string
  level: 1 | 2 | 3
  nerve_target: string | null
  description: string
  progression_regression: string | null
  is_active: boolean
  illustration_url: string | null
}

export interface ExercisePrescriptionItem {
  id: string
  prescription_id: string
  exercise_id: string
  exercise_name: string
  exercise_description: string
  exercise_region: string
  exercise_type: string
  exercise_level: number
  illustration_url: string | null
  nerve_target: string | null
  progression_regression: string | null
  sets: number | null
  reps: string | null
  hold_time: number | null
  rest_time: number | null
  frequency: string | null
  notes: string | null
  position: number
  created_at: string
}

export interface ExercisePrescription {
  id: string
  patient_id: string
  consultation_id: string | null
  title: string
  notes: string | null
  patient_intro: string | null
  vigilance_points: string | null
  weekly_routine: string | null
  clinical_notes: string | null
  created_at: string
  updated_at: string
  items?: ExercisePrescriptionItem[]
}

export interface ExercisePrescriptionItemDraft {
  exercise: RehabExercise
  sets: number | null
  reps: string
  hold_time: number | null
  rest_time: number | null
  frequency: string
  notes: string
  nerve_target: string
  progression_regression: string
}

export interface ExercisePrescriptionTemplate {
  id: string
  practitioner_id: string
  name: string
  notes: string | null
  created_at: string
  updated_at: string
  items?: ExercisePrescriptionItem[]
}
