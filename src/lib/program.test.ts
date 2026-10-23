import { describe, expect, it } from 'vitest'
import { tests } from '../content'
import { applyTestResults, blockOf, deloadFactor, isTestWeek, nextTestWeek, proposeFocus, quarterWeek, testAllowed } from './program'
import type { MilestoneResult, Settings } from './types'

const start = '2026-08-03'
const day = (n: number) => new Date(2026, 7, 3 + n)
const settings: Settings = { weeklyTarget: 4, countdownSeconds: 10, voice: true, beeps: true, voiceRate: 1, sidePause: true, bands: [], neverShow: [], favourites: [], niggles: [], bests: {}, headphoneControls: false, lastDraft: { minutes: 30, location: 'gym', mode: 'normal' }, placed: true }
const test = (id: string) => tests.find((t) => t.id === id)!
const allowed = (id: string, bests: Record<string, number>, over: Partial<Settings> = {}, location: 'gym' | 'home' = 'gym') => testAllowed(test(id), { ...settings, bests, ...over }, [], location)
const result = (testId: string, value: number): MilestoneResult => ({ id: `${testId}-${value}`, testId, value, week: 1, date: '2026-08-03' })

describe('quarter weeks', () => {
  it('counts weeks from the start date without clamping', () => {
    expect(quarterWeek(start, day(0))).toBe(1)
    expect(quarterWeek(start, day(6))).toBe(1)
    expect(quarterWeek(start, day(7))).toBe(2)
    expect(quarterWeek(start, day(77))).toBe(12)
    expect(quarterWeek(start, day(120))).toBe(18)
  })

  it('names the blocks', () => {
    for (const w of [1, 2, 3, 4]) expect(blockOf(w)).toBe('Foundations')
    for (const w of [5, 6, 7, 8]) expect(blockOf(w)).toBe('Build')
    for (const w of [9, 10, 11]) expect(blockOf(w)).toBe('Intensify')
    expect(blockOf(12)).toBe('Deload')
    expect(blockOf(13)).toBe('Over')
  })

  it('finds the next test week', () => {
    expect(nextTestWeek(2)).toBe(4)
    expect(nextTestWeek(4)).toBe(4)
    expect(nextTestWeek(9)).toBe(12)
    expect(nextTestWeek(12)).toBe(12)
    expect(nextTestWeek(13)).toBeNull()
  })

  it('knows test weeks and the deload factor', () => {
    expect([1, 2, 4, 8, 11, 12].map(isTestWeek)).toEqual([true, false, true, true, false, true])
    expect(deloadFactor(12)).toBe(0.6)
    expect(deloadFactor(11)).toBe(1)
    expect(isTestWeek(13)).toBe(false)
    expect(deloadFactor(13)).toBe(1)
  })
})

describe('applyTestResults', () => {
  it('keeps the max for higher-is-better tests', () => {
    expect(applyTestResults({}, [result('pull-up-max', 5), result('pull-up-max', 3)], tests)).toEqual({ 'pull-up': 5 })
  })

  it('keeps the min for lower-is-better tests, keyed by test id for sided tests', () => {
    expect(applyTestResults({}, [result('front-split-left', 20), result('front-split-left', 15)], tests)).toEqual({ 'front-split-left': 15 })
  })

  it('keeps the left and right leg raise separate', () => {
    const out = applyTestResults({}, [result('active-front-leg-raise-left', 90), result('active-front-leg-raise-right', 80)], tests)
    expect(out).toEqual({ 'active-front-leg-raise-left': 90, 'active-front-leg-raise-right': 80 })
  })

  it('merges into existing bests', () => {
    expect(applyTestResults({ 'pull-up': 9 }, [result('pull-up-max', 5)], tests)).toEqual({ 'pull-up': 9 })
  })
})

describe('proposeFocus', () => {
  it('puts a newly unlocked tree first and returns at most 4 unique ids', () => {
    const focus = proposeFocus([], { 'pull-up': 9 }, [])
    expect(focus[0]).toBe('muscle-up')
    expect(focus.length).toBeLessThanOrEqual(4)
    expect(new Set(focus).size).toBe(focus.length)
  })
})

describe('testAllowed', () => {
  it('needs the pull-up best for the tuck front lever hold', () => {
    expect(allowed('tuck-front-lever-hold', {})).toBe(false)
    expect(allowed('tuck-front-lever-hold', { 'pull-up': 3 })).toBe(true)
  })

  it('needs the skin-the-cat gate for the german hang hold', () => {
    expect(allowed('german-hang-hold', { 'pull-up': 2 })).toBe(false)
    expect(allowed('german-hang-hold', { 'pull-up': 3 })).toBe(true)
  })

  it('needs a pull-up best of 8 for the archer pull-up', () => {
    expect(allowed('archer-pull-up-max', { 'pull-up': 2 })).toBe(false)
    expect(allowed('archer-pull-up-max', { 'pull-up': 8 })).toBe(true)
  })

  it('drops flexibility tests when flexibility is unticked', () => {
    expect(allowed('front-split-left', {})).toBe(true)
    expect(allowed('front-split-left', {}, { focus: { strength: true, mobility: true, flexibility: false } })).toBe(false)
  })

  it('drops tests of exercises that are not home-friendly at home', () => {
    expect(allowed('dip-max', {})).toBe(true)
    expect(allowed('dip-max', {}, {}, 'home')).toBe(false)
  })
})
