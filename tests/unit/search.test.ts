import { describe, it, expect } from 'vitest'
import { splitSearchTokens, parseDateSearchToken, buildSearchOrFilters } from '@/lib/utils/search'

describe('parseDateSearchToken', () => {
  it('parses a JJ/MM/AAAA token into the ISO fragment', () => {
    expect(parseDateSearchToken('12/06/1980')).toBe('1980-06-12')
  })

  it('pads single-digit day and month', () => {
    expect(parseDateSearchToken('5/6/1980')).toBe('1980-06-05')
  })

  it('rejects an invalid month or day', () => {
    expect(parseDateSearchToken('12/13/1980')).toBeNull()
    expect(parseDateSearchToken('32/01/1980')).toBeNull()
  })

  it('rejects tokens without slashes, e.g. a plain phone-like digit string', () => {
    expect(parseDateSearchToken('0612345678')).toBeNull()
    expect(parseDateSearchToken('12061980')).toBeNull()
  })

  it('rejects a dash-separated or partial date', () => {
    expect(parseDateSearchToken('12-06-1980')).toBeNull()
    expect(parseDateSearchToken('12/06')).toBeNull()
  })
})

describe('buildSearchOrFilters with dateColumn', () => {
  it('adds a birth_date clause only for a token that looks like a date', () => {
    const filters = buildSearchOrFilters(
      'martin 12/06/1980',
      ['first_name', 'last_name', 'phone'],
      'birth_date'
    )
    expect(filters).toEqual([
      'first_name.ilike.%martin%,last_name.ilike.%martin%,phone.ilike.%martin%',
      'first_name.ilike.%12/06/1980%,last_name.ilike.%12/06/1980%,phone.ilike.%12/06/1980%,birth_date.like.%1980-06-12%',
    ])
  })

  it('never adds a birth_date clause for a plain phone-number token', () => {
    const filters = buildSearchOrFilters('0612345678', ['phone'], 'birth_date')
    expect(filters).toEqual(['phone.ilike.%0612345678%'])
  })

  it('is unaffected when dateColumn is omitted (existing callers)', () => {
    const filters = buildSearchOrFilters('martin', ['first_name', 'last_name'])
    expect(filters).toEqual(['first_name.ilike.%martin%,last_name.ilike.%martin%'])
  })
})

describe('splitSearchTokens', () => {
  it('keeps slashes in a date token intact', () => {
    expect(splitSearchTokens('12/06/1980')).toEqual(['12/06/1980'])
  })
})
