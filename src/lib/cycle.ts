import { localISO } from './trained'
import type { Checkin, HealthDaily, SetLog } from './types'

const DAY = 24 * 3600 * 1000
// flow after more than this many flow-free days starts a new cycle
export const MIN_GAP_DAYS = 10
export const PATTERN_CYCLES = 3
export const PATTERN_DAYS = 7
// a cycle day dips when reps are at least 10% below the mean or energy is this low
export const DIP_REPS = -0.1
export const DIP_ENERGY = 2
export const SYMPTOM_CRAMPS = 2
export const LATE_DAYS = 45
export const IRREGULAR_SPREAD = 10
export const NORMAL_LENGTH: [number, number] = [21, 35]

// calendar day numbers, so time zones and DST don't shift cycle days
const dayNum = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(y, m - 1, d) / DAY
}
const isoOf = (n: number) => new Date(n * DAY).toISOString().slice(0, 10)
const dateOf = (start: string, day: number) => isoOf(dayNum(start) + day - 1)
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function periodStarts(health: HealthDaily[]): string[] {
  const flow = health.filter((h) => h.periodFlow && h.periodFlow !== 'none').map((h) => dayNum(h.date)).sort((a, b) => a - b)
  return flow.filter((d, i) => i === 0 || d - flow[i - 1] > MIN_GAP_DAYS).map(isoOf)
}

export function cycleDayOf(date: string, starts: string[]): { cycle: number; day: number } | null {
  const i = starts.filter((s) => dayNum(s) <= dayNum(date)).length - 1
  return i < 0 ? null : { cycle: i + 1, day: dayNum(date) - dayNum(starts[i]) + 1 }
}

export const cycleLengths = (starts: string[]) => starts.slice(1).map((s, i) => dayNum(s) - dayNum(starts[i]))

// starts of the last 3 completed cycles, or null with fewer
const lastCycles = (starts: string[]) => (starts.length > PATTERN_CYCLES ? starts.slice(-PATTERN_CYCLES - 1, -1) : null)

// per local date: rep sets relative to each exercise's own mean (0 = average), and check-in energy
function daily(checkins: Checkin[], logs: SetLog[]) {
  const reps = logs.filter((l) => l.reps !== undefined)
  const mean = new Map<string, number>()
  for (const id of new Set(reps.map((l) => l.exerciseId))) mean.set(id, avg(reps.filter((l) => l.exerciseId === id).map((l) => l.reps!))!)
  const rel = new Map<string, number[]>()
  for (const l of reps) {
    const m = mean.get(l.exerciseId)!
    if (!m) continue
    const date = localISO(new Date(l.at))
    rel.set(date, [...(rel.get(date) ?? []), l.reps! / m - 1])
  }
  return {
    relOn: (date: string) => avg(rel.get(date) ?? []),
    energyOn: (date: string) => checkins.find((c) => c.date === date)?.energy ?? null,
    dates: [...new Set([...rel.keys(), ...checkins.filter((c) => c.energy !== undefined).map((c) => c.date)])],
  }
}

export function detectPattern(_health: HealthDaily[], checkins: Checkin[], logs: SetLog[], starts: string[]): { days: number[]; reason: string } | null {
  const recent = lastCycles(starts)
  if (!recent) return null
  const { relOn, energyOn } = daily(checkins, logs)
  const dip = (start: string, day: number) => {
    const [r, e] = [relOn(dateOf(start, day)), energyOn(dateOf(start, day))]
    return (r !== null && r <= DIP_REPS) || (e !== null && e <= DIP_ENERGY)
  }
  const days = Array.from({ length: PATTERN_DAYS }, (_, i) => i + 1).filter((day) => recent.every((s) => dip(s, day)))
  if (!days.length) return null
  const drops = days.flatMap((day) => recent.map((s) => relOn(dateOf(s, day)))).filter((r) => r !== null && r <= DIP_REPS) as number[]
  const what = drops.length ? `${Math.round(avg(drops)! * 100)}% reps` : 'low energy'
  return { days, reason: `last ${PATTERN_CYCLES} cycles: ${what} on day${days.length > 1 ? 's' : ''} ${days.join(', ')}` }
}

// pattern days plus days with cramps >= 2 in each of the last 3 cycles
export function symptomaticDays(health: HealthDaily[], checkins: Checkin[], logs: SetLog[], starts: string[]): number[] {
  const recent = lastCycles(starts)
  if (!recent) return []
  const cramps = (date: string) => Math.max(health.find((h) => h.date === date)?.cramps ?? -1, checkins.find((c) => c.date === date)?.cramps ?? -1)
  const crampDays = Array.from({ length: PATTERN_DAYS }, (_, i) => i + 1).filter((day) => recent.every((s) => cramps(dateOf(s, day)) >= SYMPTOM_CRAMPS))
  return [...new Set([...(detectPattern(health, checkins, logs, starts)?.days ?? []), ...crampDays])].sort((a, b) => a - b)
}

// never diagnoses; only points to a doctor once a regular baseline exists
export function redFlag(starts: string[], today: Date): string | null {
  const lengths = cycleLengths(starts)
  if (lengths.filter((l) => l >= NORMAL_LENGTH[0] && l <= NORMAL_LENGTH[1]).length < PATTERN_CYCLES) return null
  if (dayNum(localISO(today)) - dayNum(starts.at(-1)!) > LATE_DAYS) return 'No period logged for 45+ days, worth checking with a doctor.'
  const last = lengths.slice(-PATTERN_CYCLES)
  if (Math.max(...last) - Math.min(...last) > IRREGULAR_SPREAD) return 'Cycles look irregular lately, worth checking with a doctor.'
  return null
}

// reps and energy as signed % vs the user's mean (0 = average), per cycle day across all cycles
export function performanceByCycleDay(_health: HealthDaily[], checkins: Checkin[], logs: SetLog[], starts: string[]): { day: number; reps: number | null; energy: number | null }[] {
  const len = Math.max(28, ...cycleLengths(starts))
  const { relOn, energyOn, dates } = daily(checkins, logs)
  const reps: number[][] = Array.from({ length: len }, () => [])
  const energy: number[][] = Array.from({ length: len }, () => [])
  const meanEnergy = avg(dates.map(energyOn).filter((e) => e !== null))
  for (const date of dates) {
    const c = cycleDayOf(date, starts)
    if (!c || c.day > len) continue
    const [r, e] = [relOn(date), energyOn(date)]
    if (r !== null) reps[c.day - 1].push(r)
    if (e !== null) energy[c.day - 1].push(e)
  }
  return reps.map((r, i) => {
    const [mr, me] = [avg(r), avg(energy[i])]
    return { day: i + 1, reps: mr === null ? null : Math.round(mr * 100), energy: me === null || !meanEnergy ? null : Math.round((me / meanEnergy - 1) * 100) }
  })
}
