import { describe, expect, it } from 'vitest'
import { skillTrees } from '../content'
import type { MilestoneResult, SetLog } from './types'
import { cmSeries, personalRecords, testMarkers, treeStairs, weekKey, weeklySeries } from './weekly'

// 2026-10-05, 10-12 and 10-19 are Mondays
const W1 = '2026-10-05'
const W2 = '2026-10-12'
const W3 = '2026-10-19'
let n = 0
const log = (exerciseId: string, at: string, extra: Partial<SetLog> = {}): SetLog => ({ id: `l${n++}`, sessionId: 's', exerciseId, setIndex: 0, repsLeft: 1, mode: 'normal', at, ...extra })

describe('weekKey', () => {
  it('gives the Monday for a Wednesday and the following Sunday', () => {
    expect(weekKey('2026-10-07')).toBe(W1)
    expect(weekKey('2026-10-11')).toBe(W1)
    expect(weekKey('2026-10-12')).toBe(W2)
  })
})

describe('weeklySeries', () => {
  const bands = [
    { id: 'black', colour: 'black', label: 'Black', order: 3 },
    { id: 'yellow', colour: 'yellow', label: 'Yellow', order: 1 },
    { id: 'red', colour: 'red', label: 'Red', order: 2 },
  ]
  const logs = [
    log('pull-up', '2026-10-06T10:00:00', { reps: 5, weightKg: 5 }),
    log('pull-up', '2026-10-08T10:00:00', { reps: 8, weightKg: 10 }),
    log('pull-up', '2026-10-13T10:00:00', { reps: 6 }),
    log('pull-up', '2026-10-20T10:00:00', { reps: 7, bandIds: ['red'] }),
    log('pull-up', '2026-10-21T10:00:00', { reps: 4, bandIds: ['yellow'] }),
    log('dip', '2026-10-06T10:00:00', { reps: 20 }),
  ]

  it('gives best set, total and max kg per week for one exercise', () => {
    const s = weeklySeries(logs, 'pull-up', bands)
    expect(s.map((p) => p.week)).toEqual([W1, W2, W3])
    expect(s[0]).toMatchObject({ bestSet: 8, total: 13, maxKg: 10 })
    expect(s[1]).toMatchObject({ bestSet: 6, total: 6 })
    expect(s[1].maxKg).toBeUndefined()
  })

  it('gives a higher band level for a lighter band', () => {
    const s = weeklySeries(logs, 'pull-up', bands)
    expect(s[1].bandLevel).toBeUndefined()
    // yellow (lightest, level 2) beats red (level 1) in the same week
    expect(s[2].bandLevel).toBe(2)
    expect(weeklySeries([logs[3]], 'pull-up', bands)[0].bandLevel).toBe(1)
  })

  it('sums seconds for hold exercises', () => {
    const s = weeklySeries([log('dead-hang', '2026-10-06T10:00:00', { seconds: 30 }), log('dead-hang', '2026-10-06T11:00:00', { seconds: 45 })], 'dead-hang', [])
    expect(s).toEqual([{ week: W1, bestSet: 45, total: 75 }])
  })
})

describe('treeStairs', () => {
  it('carries the step forward on weeks without that tree', () => {
    const tree = skillTrees.find((t) => t.id === 'pull-up')!
    const logs = [
      log('dead-hang', '2026-10-06T10:00:00'),
      log('scapular-pull', '2026-10-07T10:00:00'),
      log('full-push-up', '2026-10-13T10:00:00'),
      log('trx-row', '2026-10-20T10:00:00'),
    ]
    expect(treeStairs(logs, tree)).toEqual([{ week: W1, stepIndex: 1 }, { week: W2, stepIndex: 1 }, { week: W3, stepIndex: 2 }])
  })
})

describe('cmSeries', () => {
  it('takes the min cm per side per week', () => {
    const logs = [
      log('front-split-passive', '2026-10-06T10:00:00', { side: 'left', cmFromFloor: 20 }),
      log('front-split-passive', '2026-10-06T10:05:00', { side: 'left', cmFromFloor: 15 }),
      log('front-split-passive', '2026-10-06T10:10:00', { side: 'right', cmFromFloor: 30 }),
      log('front-split-passive', '2026-10-13T10:00:00', { side: 'left', cmFromFloor: 12 }),
    ]
    expect(cmSeries(logs, ['front-split-passive'])).toEqual([{ week: W1, left: 15, right: 30 }, { week: W2, left: 12 }])
  })
})

describe('testMarkers', () => {
  it('starts with the earliest result as the baseline', () => {
    const r = (date: string, value: number): MilestoneResult => ({ id: date, testId: 'pull-up-max', value, week: 1, date })
    const markers = testMarkers([r('2026-10-20', 7), r('2026-10-06', 4), { ...r('2026-10-06', 99), testId: 'dip-max' }], 'pull-up-max')
    expect(markers).toEqual([{ week: W1, value: 4 }, { week: W3, value: 7 }])
  })
})

describe('personalRecords', () => {
  it('picks the max reps, seconds and kg per exercise', () => {
    const logs = [
      log('pull-up', '2026-10-06T10:00:00', { reps: 5, weightKg: 5 }),
      log('pull-up', '2026-10-13T10:00:00', { reps: 8, weightKg: 10 }),
      log('dead-hang', '2026-10-06T10:00:00', { seconds: 30 }),
      log('dead-hang', '2026-10-13T10:00:00', { seconds: 45 }),
    ]
    expect(personalRecords(logs)).toEqual({ 'pull-up': { bestReps: 8, maxKg: 10 }, 'dead-hang': { bestSeconds: 45 } })
  })
})
