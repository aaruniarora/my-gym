import type { Checkin, HealthDaily, Settings } from './types'

// at or below these a tired day is suggested
export const LOW_ENERGY = 2
export const LOW_SLEEP_QUALITY = 2
export const LOW_READINESS = 30
export const LOW_BODY_BATTERY = 30

// mode null means no suggestion; nothing is suggested without check-in or Garmin data
export function suggestMode({ checkin, health }: { checkin?: Checkin; health?: HealthDaily; settings: Settings }): { mode: 'tired' | null; reason: string } {
  const reasons = [
    checkin?.energy !== undefined && checkin.energy <= LOW_ENERGY && `energy ${checkin.energy}/5`,
    checkin?.sleepQuality !== undefined && checkin.sleepQuality <= LOW_SLEEP_QUALITY && `sleep ${checkin.sleepQuality}/5`,
    health?.readiness !== undefined && health.readiness <= LOW_READINESS && `readiness ${health.readiness}`,
    health?.bodyBattery !== undefined && health.bodyBattery <= LOW_BODY_BATTERY && `body battery ${health.bodyBattery}`,
  ].filter((r) => !!r)
  return reasons.length ? { mode: 'tired', reason: reasons.join(', ') } : { mode: null, reason: '' }
}

// check-in defaults from today's health row; period fields only when cycle tracking is on
export function prefillCheckin(health?: HealthDaily, cycleTracking = false): Partial<Checkin> {
  const s = health?.sleepScore
  return {
    ...(s !== undefined && { sleepQuality: s < 60 ? 2 : s < 75 ? 3 : s < 85 ? 4 : 5 }),
    ...(cycleTracking && health?.periodFlow !== undefined && { periodFlow: health.periodFlow }),
    ...(cycleTracking && health?.cramps !== undefined && { cramps: health.cramps }),
  }
}
