import { describe, expect, it } from 'vitest'
import { flatten, nextPos, prevPos } from './sequence'
import type { SessionPlan } from './types'

const pair: SessionPlan = {
  id: 'p', date: '2026-10-20', dayType: 'pull', mode: 'normal', location: 'gym', minutesTarget: 10, estSeconds: 0,
  blocks: [{ kind: 'strength', exercises: [
    { exerciseId: 'a', sets: 2, reps: [5, 8], restSeconds: 60, pairWith: 'b' },
    { exerciseId: 'b', sets: 2, reps: [5, 8], restSeconds: 60, pairWith: 'a' },
  ] }],
}

describe('flatten', () => {
  it('alternates a pair A1 B1 A2 B2', () => {
    expect(flatten(pair).map((i) => `${i.pe.exerciseId}${i.setIndex + 1}`)).toEqual(['a1', 'b1', 'a2', 'b2'])
  })
})

describe('nextPos', () => {
  it('skips positions whose key is skipped', () => {
    const items = flatten(pair)
    expect(nextPos(items, 0, [items[0].key])).toBe(1)
    expect(nextPos(items, 0, ['0-0', '0-1'])).toBe(items.length)
  })
})

describe('prevPos', () => {
  it('pops the trail and returns the previous position', () => {
    expect(prevPos([0, 1, 3], 4)).toEqual([3, [0, 1]])
  })

  it('stays on the current position with an empty trail', () => {
    expect(prevPos([], 2)).toEqual([2, []])
  })
})
