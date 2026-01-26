import { describe, it, expect } from 'vitest'
import { patientSchema } from '@/lib/validations/patient'
import { consultationSchema } from '@/lib/validations/consultation'
import { loginSchema } from '@/lib/validations/auth'

describe('patientSchema', () => {
  const validPatient = {
    gender: 'M' as const,
    first_name: 'Jean',
    last_name: 'Dupont',
    birth_date: '1990-01-15',
    phone: '06 12 34 56 78',
    email: 'jean@example.com',
    profession: 'Ingénieur',
  }

  it('should validate a valid patient', () => {
    const result = patientSchema.safeParse(validPatient)
    expect(result.success).toBe(true)
  })

  it('should reject missing required fields', () => {
    const result = patientSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('should validate French phone numbers', () => {
    const validPhones = ['0612345678', '06 12 34 56 78', '+33612345678', '0033612345678']
    validPhones.forEach((phone) => {
      const result = patientSchema.safeParse({ ...validPatient, phone })
      expect(result.success).toBe(true)
    })
  })

  it('should reject invalid phone numbers', () => {
    const invalidPhones = ['123', '12345678901', 'abcdefghij']
    invalidPhones.forEach((phone) => {
      const result = patientSchema.safeParse({ ...validPatient, phone })
      expect(result.success).toBe(false)
    })
  })

  it('should reject future birth dates', () => {
    const future = new Date()
    future.setFullYear(future.getFullYear() + 1)
    const result = patientSchema.safeParse({
      ...validPatient,
      birth_date: future.toISOString().split('T')[0],
    })
    expect(result.success).toBe(false)
  })

  it('should validate gender enum', () => {
    expect(patientSchema.safeParse({ ...validPatient, gender: 'M' }).success).toBe(true)
    expect(patientSchema.safeParse({ ...validPatient, gender: 'F' }).success).toBe(true)
    expect(patientSchema.safeParse({ ...validPatient, gender: 'X' }).success).toBe(false)
  })

  it('should allow empty optional fields', () => {
    const minimalPatient = {
      gender: 'M' as const,
      first_name: 'Jean',
      last_name: 'Dupont',
      birth_date: '1990-01-15',
      phone: '06 12 34 56 78',
    }
    const result = patientSchema.safeParse(minimalPatient)
    expect(result.success).toBe(true)
  })
})

describe('consultationSchema', () => {
  const validConsultation = {
    patient_id: '123e4567-e89b-12d3-a456-426614174000',
    date_time: '2024-03-15T14:30',
    reason: 'Lombalgie',
    anamnesis: 'Douleur depuis 3 jours',
    examination: 'Test positif',
    advice: 'Repos recommandé',
    follow_up_7d: true,
  }

  it('should validate a valid consultation', () => {
    const result = consultationSchema.safeParse(validConsultation)
    expect(result.success).toBe(true)
  })

  it('should require patient_id and reason', () => {
    const result = consultationSchema.safeParse({
      date_time: '2024-03-15T14:30',
    })
    expect(result.success).toBe(false)
  })

  it('should validate UUID for patient_id', () => {
    const result = consultationSchema.safeParse({
      ...validConsultation,
      patient_id: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('should allow empty clinical fields', () => {
    const minimalConsultation = {
      patient_id: '123e4567-e89b-12d3-a456-426614174000',
      date_time: '2024-03-15T14:30',
      reason: 'Suivi',
    }
    const result = consultationSchema.safeParse(minimalConsultation)
    expect(result.success).toBe(true)
  })
})

describe('loginSchema', () => {
  it('should validate valid login credentials', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'Password123',
    })
    expect(result.success).toBe(true)
  })

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Password123',
    })
    expect(result.success).toBe(false)
  })

  it('should reject short password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '123',
    })
    expect(result.success).toBe(false)
  })

  it('should reject empty fields', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({}).success).toBe(false)
  })
})
