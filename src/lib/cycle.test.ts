import { describe, expect, it } from 'vitest'
import { cycleLengths, detectPattern, performanceByCycleDay, periodStarts, redFlag, symptomaticDays } from './cycle'
import type { Checkin, HealthDaily, SetLog } from './types'

const iso = (n: number) => new Date(Date.UTC(2026, 0, 1 + n)).toISOString().slice(0, 10)
const startsAt = (lengths: number[]) => lengths.reduce((s, l) => [...s, s.at(-1)! + l], [0]).map(iso)
const flow = (date: string): HealthDaily => ({ date, source: 'manual', periodFlow: 'medium' })
// 4 cycles of 28 days, a rep set every day; dipOn(cycle, day) lowers it
const repLogs = (dipOn: (cycle: number, day: number) => boolean): SetLog[] =>
  Array.from({ length: 112 }, (_, n) => ({
    id: `l${n}`, sessionId: 's', exerciseId: 'push-up', setIndex: 0, reps: dipOn(Math.floor(n / 28), (n % 28) + 1) ? 7 : 10, repsLeft: 1, mode: 'normal', at: `${iso(n)}T12:00:00`,
  }))
const starts = startsAt([28, 28, 28])

describe('periodStarts and cycleLengths', () => {
  it('finds 4 starts in 4 cycles of 28 days with several flow days each', () => {
    const health = starts.flatMap((s, i) => [0, 1, 2].map((d) => flow(iso(i * 28 + d))))
    expect(periodStarts(health)).toEqual(starts)
    expect(cycleLengths(periodStarts(health))).toEqual([28, 28, 28])
  })

  it('ignores rows without flow', () => {
    expect(periodStarts([{ date: iso(0), source: 'manual', periodFlow: 'none' }, flow(iso(5))])).toEqual([iso(5)])
  })
})

describe('detectPattern', () => {
  it('finds days 1 and 2 when reps dip 20% or more in each of the last 3 cycles', () => {
    const p = detectPattern([], [], repLogs((_, day) => day <= 2), starts)
    expect(p?.days).toEqual([1, 2])
    expect(p?.reason).toMatch(/-\d+% reps/)
    expect(p?.reason).toContain('day')
    expect(p?.reason).toContain('1, 2')
  })

  it('is null when only 2 of the last 3 cycles dip', () => {
    expect(detectPattern([], [], repLogs((cycle, day) => day <= 2 && cycle < 2), starts)).toBeNull()
  })

  it('is null with fewer than 3 completed cycles', () => {
    expect(detectPattern([], [], repLogs((_, day) => day <= 2), starts.slice(0, 3))).toBeNull()
  })
})

describe('symptomaticDays', () => {
  const crampsOn = (cycles: number[]): HealthDaily[] => cycles.map((c) => ({ date: iso(c * 28 + 2), source: 'manual', cramps: 2 }))

  it('includes a day with cramps of 2 or more in all 3 cycles', () => {
    expect(symptomaticDays(crampsOn([0, 1, 2]), [], [], starts)).toEqual([3])
  })

  it('also reads cramps from check-ins', () => {
    const checkins: Checkin[] = [0, 1, 2].map((c) => ({ date: iso(c * 28 + 2), cramps: 3 }))
    expect(symptomaticDays([], checkins, [], starts)).toEqual([3])
  })

  it('leaves out a day that is symptomatic in only 2 cycles', () => {
    expect(symptomaticDays(crampsOn([0, 1]), [], [], starts)).toEqual([])
  })
})

describe('redFlag', () => {
  const day = (n: number) => new Date(2026, 0, 1 + n)

  it('is null for regular cycles with a recent start', () => {
    expect(redFlag(starts, day(84 + 5))).toBeNull()
  })

  it('flags no period for 45+ days', () => {
    expect(redFlag(starts, day(84 + 50))).toBe('No period logged for 45+ days, worth checking with a doctor.')
  })

  it('flags irregular cycles when the last three lengths spread more than 10 days', () => {
    expect(redFlag(startsAt([22, 35, 25]), day(82 + 5))).toContain('irregular')
  })

  it('is null without 3 normal cycles', () => {
    expect(redFlag(startsAt([28, 28]), day(200))).toBeNull()
  })
})

describe('performanceByCycleDay', () => {
  const checkins: Checkin[] = Array.from({ length: 112 }, (_, n) => ({ date: iso(n), energy: n % 28 === 0 ? 2 : 4 }))
  const rows = performanceByCycleDay([], checkins, repLogs((_, d) => d === 1), starts)

  it('returns one row per cycle day', () => {
    expect(rows.map((r) => r.day)).toEqual(Array.from({ length: 28 }, (_, i) => i + 1))
  })

  it('gives reps and energy as signed percent against the mean', () => {
    expect(rows[0].reps).toBeLessThan(0)
    expect(rows[0].energy).toBeLessThan(0)
    expect(rows[4].reps).toBeGreaterThanOrEqual(0)
    expect(rows[4].energy).toBeGreaterThan(0)
  })
})
