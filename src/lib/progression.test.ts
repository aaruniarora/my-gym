import { describe, expect, it } from 'vitest'
import { skillTrees } from '../content'
import { abilityStep, applyPain, applySession, applyTooHard, currentStep, withinAbility } from './progression'
import type { DayMode, SessionPlan, SetLog, SkillProgress } from './types'

const now = new Date('2026-10-20T08:00:00Z')
const WEEK = 7 * 24 * 3600 * 1000
const tree = (id: string) => skillTrees.find((t) => t.id === id)!

const plan = (stepIndex: number, exerciseId: string): SessionPlan => ({
  id: 'p', date: '2026-10-20', dayType: 'pull', mode: 'normal', location: 'gym', minutesTarget: 30, estSeconds: 0,
  blocks: [{ kind: 'strength', exercises: [{ exerciseId, sets: 3, seconds: 60, restSeconds: 60, treeId: 'pull-up', stepIndex }] }],
})
const holds = (seconds: number, mode: DayMode = 'normal'): SetLog[] =>
  [0, 1, 2].map((i) => ({ id: `l${i}`, sessionId: 'p', exerciseId: 'dead-hang', setIndex: i, seconds, repsLeft: 1, mode, at: now.toISOString() }))
const start: SkillProgress[] = [{ treeId: 'pull-up', stepIndex: 0, hits: 0, misses: 0 }]

describe('currentStep', () => {
  it('starts the handstand tree unlocked at step 0', () => {
    const cs = currentStep([], tree('handstand'), now)
    expect(cs.stepIndex).toBe(0)
    expect(cs.locked).toBe(false)
  })

  it('starts the dragon-flag tree unlocked at step 0 and gates the tuck negative on hanging-leg-raise-max', () => {
    const cs = currentStep([], tree('dragon-flag'), now)
    expect(cs.stepIndex).toBe(0)
    expect(cs.locked).toBe(false)
    const gated = tree('dragon-flag').steps[2]
    expect(gated.exerciseId).toBe('dragon-flag-tuck-negative')
    expect(gated.gate?.requirements).toMatchObject([{ testId: 'hanging-leg-raise-max', min: 10 }])
  })
})

describe('gates from bests', () => {
  it('unlocks the dragon-flag tuck negative when hanging-leg-raise best reaches 10', () => {
    const progress: SkillProgress[] = [{ treeId: 'dragon-flag', stepIndex: 2, hits: 0, misses: 0 }]
    expect(currentStep(progress, tree('dragon-flag'), now, { 'hanging-leg-raise': 9 }).locked).toBe(true)
    expect(currentStep(progress, tree('dragon-flag'), now, { 'hanging-leg-raise': 10 }).locked).toBe(false)
  })

  const kickUps = (): SetLog[] => [0, 1, 2].map((i) => ({ id: `k${i}`, sessionId: 'p', exerciseId: 'handstand-kick-up', setIndex: i, seconds: 60, reps: 60, repsLeft: 1, mode: 'normal', at: now.toISOString() }))
  const kickPlan: SessionPlan = { ...plan(4, 'handstand-kick-up'), blocks: [{ kind: 'skill', exercises: [{ exerciseId: 'handstand-kick-up', sets: 3, seconds: 60, restSeconds: 60, treeId: 'handstand', stepIndex: 4 }] }] }
  const hs: SkillProgress[] = [{ treeId: 'handstand', stepIndex: 4, hits: 0, misses: 0 }]
  const twice = (bests: Record<string, number>) => {
    const first = applySession(hs, kickPlan, kickUps(), now, bests)
    return applySession(first.progress, kickPlan, kickUps(), now, bests)
  }

  it('moves up two hitting sessions later when bests open the next step', () => {
    const res = twice({ 'chest-to-wall-handstand-hold': 60 })
    expect(res.progress[0].stepIndex).toBe(5)
    expect(res.events.join()).toContain('moved up')
  })

  it('stays on the step and reports it locked without bests', () => {
    const res = twice({})
    expect(res.progress[0].stepIndex).toBe(4)
    expect(res.events.join()).toContain('next step locked')
  })
})

describe('entry-step gates', () => {
  it('locks muscle-up step 0 until pull-up-max reaches 8', () => {
    const locked = currentStep([], tree('muscle-up'), now, {})
    expect(locked.locked).toBe(true)
    expect(locked.gateMissing).toContain('pull-up-max >= 8')
    expect(currentStep([], tree('muscle-up'), now, { 'pull-up': 8 }).locked).toBe(false)
  })

  it.each([['back-lever', 0], ['front-lever', 1]])('locks %s step %i until pull-up-max reaches 3', (id, stepIndex) => {
    const progress: SkillProgress[] = [{ treeId: id, stepIndex, hits: 0, misses: 0 }]
    expect(currentStep(progress, tree(id), now).locked).toBe(true)
    expect(currentStep(progress, tree(id), now, { 'pull-up': 3 }).locked).toBe(false)
  })
})

describe('applyTooHard', () => {
  it('creates an entry at step 0 with one miss', () => {
    expect(applyTooHard([], 'pull-up', now)).toEqual([{ treeId: 'pull-up', stepIndex: 0, hits: 0, misses: 1 }])
  })

  it('drops the tree back for a week on the third tap and leaves other trees alone', () => {
    const other: SkillProgress = { treeId: 'handstand', stepIndex: 1, hits: 1, misses: 1 }
    let progress: SkillProgress[] = [other]
    for (let i = 0; i < 3; i++) progress = applyTooHard(progress, 'pull-up', now)
    expect(progress.find((p) => p.treeId === 'pull-up')).toMatchObject({ misses: 0, hits: 0, droppedUntil: new Date(now.getTime() + WEEK).toISOString() })
    expect(progress.find((p) => p.treeId === 'handstand')).toEqual(other)
  })
})

describe('applySession', () => {
  it('does not count a miss when the planned exercise was swapped mid-session', () => {
    const swapped: SkillProgress[] = [{ treeId: 'pull-up', stepIndex: 4, hits: 0, misses: 1 }]
    const logs: SetLog[] = [0, 1, 2].map((i) => ({ id: `s${i}`, sessionId: 'p', exerciseId: 'pull-up-negative', setIndex: i, reps: 1, repsLeft: 1, mode: 'normal', at: now.toISOString() }))
    const res = applySession(swapped, plan(4, 'band-assisted-pull-up'), logs, now)
    expect(res.progress).toEqual(swapped)
    expect(res.events).toEqual([])
  })

  it('counts a hit without moving up, then moves up on the second hit', () => {
    const first = applySession(start, plan(0, 'dead-hang'), holds(60), now)
    expect(first.progress[0]).toMatchObject({ stepIndex: 0, hits: 1 })
    expect(first.events).toEqual([])
    const second = applySession(first.progress, plan(0, 'dead-hang'), holds(60), now)
    expect(second.progress[0]).toMatchObject({ stepIndex: 1, hits: 0 })
    expect(second.events.join()).toContain('moved up')
  })

  it('ignores tired-mode logs', () => {
    const res = applySession(start, plan(0, 'dead-hang'), holds(5, 'tired'), now)
    expect(res.progress).toEqual(start)
    expect(res.events).toEqual([])
  })

  it('drops the tree back for a week after three missed sessions', () => {
    let progress = start
    let events: string[] = []
    for (let i = 0; i < 3; i++) ({ progress, events } = applySession(progress, plan(0, 'dead-hang'), holds(5), now))
    expect(progress[0].droppedUntil).toBe(new Date(now.getTime() + WEEK).toISOString())
    expect(events.join()).toContain('dropped')
  })

  it('leaves progress alone when the plan has no tree exercises', () => {
    const noTree: SessionPlan = { ...plan(0, 'dead-hang'), blocks: [{ kind: 'strength', exercises: [{ exerciseId: 'hollow-hold', sets: 3, seconds: 30, restSeconds: 60 }] }] }
    const res = applySession(start, noTree, holds(60), now)
    expect(res.progress).toEqual(start)
    expect(res.events).toEqual([])
  })
})

describe('withinAbility and abilityStep', () => {
  const atBand: SkillProgress[] = [{ treeId: 'pull-up', stepIndex: 4, hits: 0, misses: 0 }]
  const weak = { 'pull-up': 2 }

  it('allows steps at or below the current one', () => {
    expect(withinAbility('band-assisted-pull-up', atBand, weak, now)).toBe(true)
    expect(withinAbility('dead-hang', atBand, weak, now)).toBe(true)
  })

  it('blocks steps above the current one', () => {
    expect(withinAbility('pull-up', atBand, weak, now)).toBe(false)
  })

  it('blocks a step whose gate is unmet', () => {
    expect(withinAbility('high-pull-up', atBand, weak, now)).toBe(false)
  })

  it('allows a step once its gate is met', () => {
    expect(withinAbility('high-pull-up', atBand, { 'pull-up': 8 }, now)).toBe(true)
  })

  it('allows exercises outside every tree', () => {
    expect(withinAbility('band-face-pull', atBand, weak, now)).toBe(true)
  })

  it('returns the highest allowed step in the first tree for an out-of-ability exercise', () => {
    expect(abilityStep('pull-up', atBand, weak, now)).toBe('band-assisted-pull-up')
  })

  it('returns undefined when the exercise is within ability, in no tree, or fully locked', () => {
    expect(abilityStep('dead-hang', atBand, weak, now)).toBeUndefined()
    expect(abilityStep('band-face-pull', atBand, weak, now)).toBeUndefined()
    expect(abilityStep('high-pull-up', atBand, weak, now)).toBeUndefined()
  })
})

describe('applyPain', () => {
  it('drops only the named tree for a week', () => {
    const progress: SkillProgress[] = [...start, { treeId: 'handstand', stepIndex: 1, hits: 1, misses: 0 }]
    const res = applyPain(progress, 'pull-up', now)
    expect(res[0].droppedUntil).toBe(new Date(now.getTime() + WEEK).toISOString())
    expect(res[1].droppedUntil).toBeUndefined()
  })
})

describe('per-side progression', () => {
  const sided: SkillProgress[] = [{ treeId: 'front-split', side: 'left', stepIndex: 3, hits: 0, misses: 0 }, { treeId: 'front-split', side: 'right', stepIndex: 4, hits: 0, misses: 0 }]
  const sidedPlan = (stepIndex: number): SessionPlan => {
    const exerciseId = tree('front-split').steps[stepIndex].exerciseId
    return { ...plan(stepIndex, exerciseId), blocks: [{ kind: 'cooldown', exercises: [{ exerciseId, sets: 3, seconds: 60, restSeconds: 8, treeId: 'front-split', stepIndex }] }] }
  }
  const sideLogs = (exerciseId: string, side: 'left' | 'right', n: number, extra: Partial<SetLog>): SetLog[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${side}${i}`, sessionId: 'p', exerciseId, setIndex: i, side, repsLeft: 1, mode: 'normal', at: now.toISOString(), ...extra }))
  const entry = (p: SkillProgress[], side: 'left' | 'right') => p.find((x) => x.treeId === 'front-split' && x.side === side)!

  it('reads each side from its own entry', () => {
    expect(currentStep(sided, tree('front-split'), now, {}, 'left').stepIndex).toBe(3)
    expect(currentStep(sided, tree('front-split'), now, {}, 'right').stepIndex).toBe(4)
  })

  it('moves only the logged side up after two hitting sessions', () => {
    const step = tree('front-split').steps[3]
    const logs = sideLogs(step.exerciseId, 'left', step.target.sets, { seconds: step.target.seconds })
    const first = applySession(sided, sidedPlan(3), logs, now)
    const second = applySession(first.progress, sidedPlan(3), logs, now)
    expect(entry(second.progress, 'left')).toMatchObject({ stepIndex: 4, hits: 0 })
    expect(entry(second.progress, 'right')).toEqual(entry(sided, 'right'))
  })

  describe('cm target', () => {
    const atCm: SkillProgress[] = [{ treeId: 'front-split', side: 'left', stepIndex: 4, hits: 0, misses: 0 }, { treeId: 'front-split', side: 'right', stepIndex: 4, hits: 0, misses: 0 }]

    it('hits when cm is at or under the target and misses when over, per side', () => {
      const logs = [...sideLogs('front-split-passive', 'left', 3, { cmFromFloor: 18 }), ...sideLogs('front-split-passive', 'right', 3, { cmFromFloor: 25 })]
      const res = applySession(atCm, sidedPlan(4), logs, now)
      expect(entry(res.progress, 'left')).toMatchObject({ hits: 1, misses: 0 })
      expect(entry(res.progress, 'right')).toMatchObject({ hits: 0, misses: 1 })
    })

    it('changes nothing when no set has a cm entry', () => {
      const logs = [...sideLogs('front-split-passive', 'left', 3, { seconds: 60 }), ...sideLogs('front-split-passive', 'right', 3, { seconds: 60 })]
      const res = applySession(atCm, sidedPlan(4), logs, now)
      expect(res.progress).toEqual(atCm)
      expect(res.events).toEqual([])
    })
  })
})
