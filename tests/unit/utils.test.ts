import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatCurrency,
  formatPhone,
  calculateAge,
  generateInvoiceNumber,
  getInitials,
  cn,
} from '@/lib/utils'

describe('formatDate', () => {
  it('should format date in French format', () => {
    const date = new Date('2024-03-15')
    const result = formatDate(date)
    expect(result).toMatch(/15\/03\/2024/)
  })

  it('should handle string input', () => {
    const result = formatDate('2024-03-15')
    expect(result).toMatch(/15\/03\/2024/)
  })
})

describe('formatDateTime', () => {
  it('should format date and time in French format', () => {
    const date = new Date('2024-03-15T14:30:00')
    const result = formatDateTime(date)
    expect(result).toContain('15/03/2024')
    expect(result).toMatch(/14[h:]30/)
  })
})

describe('formatCurrency', () => {
  it('should format amount in EUR', () => {
    expect(formatCurrency(60)).toMatch(/60.*€/)
    expect(formatCurrency(1234.56)).toMatch(/1.*234.*€/)
  })

  it('should handle zero', () => {
    expect(formatCurrency(0)).toMatch(/0.*€/)
  })
})

describe('formatPhone', () => {
  it('should format French phone number', () => {
    expect(formatPhone('0612345678')).toBe('06 12 34 56 78')
  })

  it('should return original if not 10 digits', () => {
    expect(formatPhone('123')).toBe('123')
    expect(formatPhone('+33612345678')).toBe('+33612345678')
  })

  it('should handle already formatted number', () => {
    expect(formatPhone('06 12 34 56 78')).toBe('06 12 34 56 78')
  })
})

describe('calculateAge', () => {
  it('should calculate age correctly', () => {
    const today = new Date()
    const birthDate = new Date(today.getFullYear() - 30, today.getMonth(), today.getDate())
    expect(calculateAge(birthDate)).toBe(30)
  })

  it('should handle birthday not yet passed this year', () => {
    const today = new Date()
    const birthDate = new Date(today.getFullYear() - 30, today.getMonth() + 1, today.getDate())
    expect(calculateAge(birthDate)).toBe(29)
  })

  it('should handle string input', () => {
    const today = new Date()
    const birthDate = `${today.getFullYear() - 25}-01-01`
    const age = calculateAge(birthDate)
    expect(age).toBeGreaterThanOrEqual(24)
    expect(age).toBeLessThanOrEqual(25)
  })
})

describe('generateInvoiceNumber', () => {
  it('should generate invoice number with prefix and date', () => {
    const date = new Date('2024-03-15')
    const result = generateInvoiceNumber('FACT', 1, date)
    expect(result).toBe('FACT-240315-001')
  })

  it('should pad number with zeros', () => {
    const date = new Date('2024-03-15')
    expect(generateInvoiceNumber('FACT', 1, date)).toContain('-001')
    expect(generateInvoiceNumber('FACT', 42, date)).toContain('-042')
    expect(generateInvoiceNumber('FACT', 123, date)).toContain('-123')
  })

  it('should use custom prefix', () => {
    const date = new Date('2024-03-15')
    const result = generateInvoiceNumber('INV', 1, date)
    expect(result).toStartWith('INV-')
  })
})

describe('getInitials', () => {
  it('should return initials from first and last name', () => {
    expect(getInitials('Jean', 'Dupont')).toBe('JD')
    expect(getInitials('marie', 'martin')).toBe('MM')
  })

  it('should handle single character names', () => {
    expect(getInitials('J', 'D')).toBe('JD')
  })
})

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz')
  })

  it('should merge Tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })
})
