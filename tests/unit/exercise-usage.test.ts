/**
 * L'indicateur d'utilisation ne voit que les bilans importés : il doit dire
 * clairement « en attente » plutôt que « n'utilise pas » quand il ne sait pas.
 */
import { describe, it, expect } from 'vitest'
import { computeUsage } from '@/lib/exercises/usage'

const program = { status: 'active' as const, start_date: '2026-10-01', link_sent_at: null }
const week = (week: number, done: number) => ({ week, done, morning: 3, maxPain: 4 })

describe('indicateur d’utilisation', () => {
  it('distingue lien non envoyé, attente et arrêt', () => {
    expect(computeUsage(program, null, '2026-10-10').level).toBe('not_sent')
    expect(computeUsage({ ...program, link_sent_at: '2026-10-02T10:00:00Z' }, null, '2026-10-10').level).toBe('waiting')
    expect(computeUsage({ ...program, status: 'ended' }, null, '2026-10-10').level).toBe('ended')
  })

  it('classe selon les séances des deux dernières semaines', () => {
    const at = '2026-10-15T10:00:00Z'
    expect(computeUsage(program, { created_at: at, weeks: [week(0, 3), week(1, 2)] }, '2026-10-15', 3).level).toBe('active')
    expect(computeUsage(program, { created_at: at, weeks: [week(0, 1), week(1, 1)] }, '2026-10-15', 3).level).toBe('low')
    expect(computeUsage(program, { created_at: at, weeks: [week(0, 0), week(1, 0)] }, '2026-10-15', 3).level).toBe('inactive')
  })

  it('repère un patient qui a décroché grâce au détail jour par jour', () => {
    const report = { v: 1 as const, id: 'x', s: '2026-10-01', at: '2026-10-28', n: 3, days: [{ o: 2, m: 3, x: true, p: 3 }, { o: 5, m: 3, x: true, p: 3 }] }
    const u = computeUsage(program, { created_at: '2026-10-28T10:00:00Z', weeks: [week(0, 2)], report }, '2026-10-28')
    expect(u.level).toBe('inactive')
    expect(u.detail).toContain('6 octobre')
  })

  it('signale un bilan ancien', () => {
    const u = computeUsage(program, { created_at: '2026-09-01T10:00:00Z', weeks: [week(0, 3)] }, '2026-10-15')
    expect(u.detail).toContain('il y a 44 jours')
  })
})
