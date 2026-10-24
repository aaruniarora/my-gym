import { describe, expect, it } from 'vitest'
import { countsAsTrained, dayStatus, loggedWorkSeconds, monthGrid, periodDays, periodInfo, plannedSets, streakWeeks, weekCount } from './trained'
import type { Checkin, HealthDaily, SessionRecord, SetLog } from './types'

// 2 exercises x 3 sets = 6 planned sets
const planFor = (id: string) => ({
  id, date: id, dayType: 'pull' as const, mode: 'normal' as const, location: 'gym' as const, minutesTarget: 30, estSeconds: 0,
  blocks: [{ kind: 'strength' as const, exercises: [
    { exerciseId: 'a', sets: 3, reps: [6, 8] as [number, number], restSeconds: 60 },
    { exerciseId: 'b', sets: 3, seconds: 60, restSeconds: 60 },
  ] }],
})
const session = (id: string, completed: boolean, date = id): SessionRecord =>
  ({ plan: planFor(id), startedAt: `${date}T12:00:00`, completed })
const repLogs = (n: number, reps = 8): SetLog[] =>
  Array.from({ length: n }, (_, i) => ({ id: `r${i}`, sessionId: 's', exerciseId: 'a', setIndex: i, reps, repsLeft: 1, mode: 'normal', at: '' }))
const timedLogs = (n: number, seconds: number): SetLog[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, sessionId: 's', exerciseId: 'b', setIndex: i, seconds, repsLeft: 1, mode: 'normal', at: '' }))

describe('countsAsTrained', () => {
  const s = (completed: boolean) => session('2026-10-20', completed)

  it('completes with half the planned sets logged', () => {
    expect(countsAsTrained(s(true), repLogs(3))).toBe('completed')
  })

  it('completes with 600 s or more of timed work', () => {
    expect(countsAsTrained(s(true), timedLogs(6, 120))).toBe('completed')
  })

  it('is partial when aborted after most sets', () => {
    expect(countsAsTrained(s(false), repLogs(4))).toBe('partial')
  })

  it('is only started when aborted after one set', () => {
    expect(countsAsTrained(s(false), repLogs(1))).toBe('started')
  })

  it('is only started when finished with one set and 30 s', () => {
    expect(countsAsTrained(s(true), timedLogs(1, 30))).toBe('started')
  })

  it('is only started with no logs', () => {
    expect(countsAsTrained(s(true), [])).toBe('started')
    expect(countsAsTrained(s(false), [])).toBe('started')
  })
})

describe('plannedSets and loggedWorkSeconds', () => {
  it('sums sets across exercises', () => {
    expect(plannedSets(planFor('p'))).toBe(6)
  })

  it('adds seconds for timed sets and 3 s per rep for rep sets', () => {
    expect(loggedWorkSeconds([...timedLogs(2, 45), ...repLogs(2, 10)])).toBe(90 + 60)
  })
})

describe('dayStatus', () => {
  it('takes the best status when two sessions share a day', () => {
    const sessions = [session('a', false, '2026-10-20'), session('b', false, '2026-10-20')]
    expect(dayStatus(sessions, { a: repLogs(4), b: repLogs(1) }, '2026-10-20')).toBe('partial')
  })

  it('is none on a day without sessions', () => {
    expect(dayStatus([session('a', true, '2026-10-20')], { a: repLogs(3) }, '2026-10-21')).toBe('none')
  })
})

// qualifying = completed with 3 of 6 sets logged
const days = (dates: string[]) => ({
  sessions: dates.map((d) => session(d, true)),
  logs: Object.fromEntries(dates.map((d) => [d, repLogs(3)])),
})

describe('weekCount', () => {
  it('counts qualifying days and ignores started-only days', () => {
    const q = days(['2026-10-12', '2026-10-14', '2026-10-16'])
    const sessions = [...q.sessions, session('2026-10-18', false)]
    const logs = { ...q.logs, '2026-10-18': repLogs(1) }
    expect(weekCount(sessions, logs, '2026-10-12')).toBe(3)
  })

  it('does not extend a streak when the week is under the target', () => {
    const q = days(['2026-10-12', '2026-10-14', '2026-10-16'])
    expect(streakWeeks(q.sessions, q.logs, 4, new Date(2026, 9, 22, 12))).toBe(0)
  })
})

describe('streakWeeks', () => {
  const today = new Date(2026, 9, 22, 12) // Thursday
  const three = ['2026-09-28', '2026-09-30', '2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']

  it('counts the last full weeks when this week has not hit the target yet', () => {
    const { sessions, logs } = days(three)
    expect(streakWeeks(sessions, logs, 2, today)).toBe(3)
  })

  it('is 0 when last week missed the target', () => {
    const { sessions, logs } = days(three.slice(0, 4))
    expect(streakWeeks(sessions, logs, 2, today)).toBe(0)
  })

  it('includes the current week once it is at target', () => {
    const { sessions, logs } = days([...three, '2026-10-19', '2026-10-20'])
    expect(streakWeeks(sessions, logs, 2, today)).toBe(4)
  })
})

describe('monthGrid', () => {
  const grid = monthGrid(2026, 9)

  it('starts on Monday so Thursday 1 October sits in column 4', () => {
    expect(grid[0].slice(0, 3)).toEqual([null, null, null])
    expect(grid[0][3]).toBe('2026-10-01')
  })

  it('ends with 31 October followed by nulls', () => {
    const last = grid[grid.length - 1]
    expect(last[5]).toBe('2026-10-31')
    expect(last[6]).toBeNull()
  })

  it('has 7 entries in every row', () => {
    expect(grid.every((row) => row.length === 7)).toBe(true)
  })
})

const hd = (date: string, extra: Partial<HealthDaily> = {}): HealthDaily => ({ date, source: 'garmin', ...extra })
const ci = (date: string, extra: Partial<Checkin> = {}): Checkin => ({ date, ...extra })

describe('periodDays', () => {
  it('includes dates with flow from health and from check-ins', () => {
    const days = periodDays([hd('2026-10-01', { periodFlow: 'medium' })], [ci('2026-10-02', { periodFlow: 'heavy' })])
    expect([...days].sort()).toEqual(['2026-10-01', '2026-10-02'])
  })

  it('a check-in of none clears a health light day', () => {
    expect(periodDays([hd('2026-10-01', { periodFlow: 'light' })], [ci('2026-10-01', { periodFlow: 'none' })]).size).toBe(0)
  })

  it('a check-in without flow keeps the health flow', () => {
    expect(periodDays([hd('2026-10-01', { periodFlow: 'light' })], [ci('2026-10-01', { energy: 3 })]).has('2026-10-01')).toBe(true)
  })

  it('none-only data gives an empty set', () => {
    expect(periodDays([hd('2026-10-01', { periodFlow: 'none' })], [ci('2026-10-02', { periodFlow: 'none' })]).size).toBe(0)
  })

  it('is empty for empty arrays, which is what History passes when cycleTracking is off', () => {
    expect(periodDays([], []).size).toBe(0)
  })
})

describe('periodInfo', () => {
  it('prefers check-in flow and cramps over health', () => {
    const info = periodInfo('2026-10-01', [hd('2026-10-01', { periodFlow: 'light', cramps: 1 })], [ci('2026-10-01', { periodFlow: 'heavy', cramps: 3 })])
    expect(info).toEqual({ flow: 'heavy', cramps: 3 })
  })

  it('falls back to health for fields the check-in lacks', () => {
    expect(periodInfo('2026-10-01', [hd('2026-10-01', { periodFlow: 'light', cramps: 1 })], [ci('2026-10-01', { cramps: 2 })])).toEqual({ flow: 'light', cramps: 2 })
  })

  it('returns null when neither has period data for the date', () => {
    expect(periodInfo('2026-10-01', [hd('2026-10-02', { periodFlow: 'light' })], [ci('2026-10-01', { energy: 3 })])).toBeNull()
    expect(periodInfo('2026-10-01', [], [])).toBeNull()
  })
})
