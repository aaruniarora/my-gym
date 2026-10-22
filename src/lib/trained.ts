import { exerciseById } from '../content'
import type { SessionPlan, SessionRecord, SetLog } from './types'

export type DayStatus = 'completed' | 'partial' | 'started' | 'none'

const rank: DayStatus[] = ['none', 'started', 'partial', 'completed']

// local yyyy-mm-dd
export const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parseISO = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))

export function plannedSets(plan: SessionPlan): number {
  // per-side work logs one row per side
  const perSide = (id: string) => ['time_per_side', 'reps_per_side'].includes(exerciseById[id]?.mode ?? '')
  return plan.blocks.reduce((n, b) => n + b.exercises.reduce((m, e) => m + e.sets * (perSide(e.exerciseId) ? 2 : 1), 0), 0)
}

export function loggedWorkSeconds(logs: SetLog[]): number {
  return logs.reduce((n, l) => n + (l.seconds ?? 0) + (l.reps ?? 0) * 3, 0)
}

export function countsAsTrained(session: SessionRecord, logs: SetLog[]): DayStatus {
  const bar = logs.length > 0 && (logs.length >= 0.5 * plannedSets(session.plan) || loggedWorkSeconds(logs) >= 600)
  if (!bar) return 'started'
  return session.completed ? 'completed' : 'partial'
}

export function dayStatus(sessions: SessionRecord[], logsBySession: Record<string, SetLog[]>, dateISO: string): DayStatus {
  let best: DayStatus = 'none'
  for (const s of sessions) {
    if (localISO(new Date(s.startedAt)) !== dateISO) continue
    const st = countsAsTrained(s, logsBySession[s.plan.id] ?? [])
    if (rank.indexOf(st) > rank.indexOf(best)) best = st
  }
  return best
}

export function weekCount(sessions: SessionRecord[], logsBySession: Record<string, SetLog[]>, weekStartISO: string): number {
  const start = parseISO(weekStartISO)
  let n = 0
  for (let i = 0; i < 7; i++) {
    const st = dayStatus(sessions, logsBySession, localISO(addDays(start, i)))
    if (st === 'completed' || st === 'partial') n++
  }
  return n
}

export function streakWeeks(sessions: SessionRecord[], logsBySession: Record<string, SetLog[]>, weeklyTarget: number, today: Date): number {
  let week = mondayOf(today)
  if (weekCount(sessions, logsBySession, localISO(week)) < weeklyTarget) week = addDays(week, -7)
  // stop once past the earliest session so the loop always ends
  const earliest = sessions.reduce((m, s) => Math.min(m, Date.parse(s.startedAt)), Infinity)
  let n = 0
  while (week.getTime() + 7 * 86400000 > earliest && weekCount(sessions, logsBySession, localISO(week)) >= weeklyTarget) {
    n++
    week = addDays(week, -7)
  }
  return n
}

export function monthGrid(year: number, month0: number): (string | null)[][] {
  const first = new Date(year, month0, 1)
  const days = new Date(year, month0 + 1, 0).getDate()
  const cells: (string | null)[] = Array((first.getDay() + 6) % 7).fill(null)
  for (let d = 1; d <= days; d++) cells.push(localISO(new Date(year, month0, d)))
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
