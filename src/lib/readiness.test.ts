import { describe, expect, it } from 'vitest'
import { prefillCheckin, suggestMode } from './readiness'
import type { Settings } from './types'

const settings = {} as Settings

describe('suggestMode', () => {
  it('suggests tired on low energy and names it', () => {
    const r = suggestMode({ checkin: { date: '2026-10-20', energy: 2 }, settings })
    expect(r.mode).toBe('tired')
    expect(r.reason).toContain('energy')
  })

  it('suggests tired on low sleep quality', () => {
    expect(suggestMode({ checkin: { date: '2026-10-20', sleepQuality: 2 }, settings }).mode).toBe('tired')
  })

  it('suggests tired on low Garmin readiness', () => {
    expect(suggestMode({ health: { date: '2026-10-20', source: 'garmin', readiness: 25 }, settings }).mode).toBe('tired')
  })

  it('suggests tired on low body battery', () => {
    expect(suggestMode({ health: { date: '2026-10-20', source: 'garmin', bodyBattery: 25 }, settings }).mode).toBe('tired')
  })

  it('suggests nothing when energy, sleep and readiness are fine', () => {
    const r = suggestMode({ checkin: { date: '2026-10-20', energy: 4, sleepQuality: 4 }, health: { date: '2026-10-20', source: 'garmin', readiness: 70 }, settings })
    expect(r).toEqual({ mode: null, reason: '' })
  })

  it('suggests nothing without check-in or health data', () => {
    expect(suggestMode({ settings }).mode).toBeNull()
  })
})

describe('prefillCheckin', () => {
  it.each([[55, 2], [70, 3], [80, 4], [90, 5]])('maps sleep score %i to sleep quality %i', (score, quality) => {
    expect(prefillCheckin({ date: '2026-10-20', source: 'garmin', sleepScore: score }).sleepQuality).toBe(quality)
  })

  it('includes period flow and cramps only with cycle tracking', () => {
    const health = { date: '2026-10-20', source: 'manual' as const, periodFlow: 'light' as const, cramps: 2 }
    expect(prefillCheckin(health, true)).toEqual({ periodFlow: 'light', cramps: 2 })
    expect(prefillCheckin(health)).toEqual({})
  })

  it('is empty without a health row', () => {
    expect(prefillCheckin(undefined, true)).toEqual({})
  })
})
