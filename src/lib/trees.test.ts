import { describe, expect, it } from 'vitest'
import { exerciseById, skillTrees, tests } from '../content'

const tree = (id: string) => skillTrees.find((t) => t.id === id)!
const stepIds = (id: string) => tree(id).steps.map((s) => s.exerciseId)

describe('skill tree content', () => {
  it('starts the splits, hspu and push-up trees on the right steps', () => {
    expect(tree('front-split').perSide).toBe(true)
    expect(stepIds('front-split')[0]).toBe('low-lunge')
    expect(stepIds('middle-split')[0]).toBe('butterfly-stretch')
    expect(stepIds('hspu').slice(0, 2)).toEqual(['pike-push-up-negative', 'pike-push-up'])
    expect(stepIds('push-up')[0]).toBe('wall-push-up')
  })

  it('gates step 0 only on muscle-up and back-lever', () => {
    expect(skillTrees.filter((t) => t.steps[0].gate).map((t) => t.id).sort()).toEqual(['back-lever', 'muscle-up'])
  })

  it('only stretch and mobility exercises log cm', () => {
    for (const ex of Object.values(exerciseById)) if (ex.loggable.cm) expect(['stretch', 'mobility'], ex.id).toContain(ex.type)
  })

  it('has a gateless balance tree of three single-leg-stance steps', () => {
    expect(stepIds('balance')).toEqual(['single-leg-stance', 'single-leg-stance-eyes-closed', 'single-leg-stance-toes'])
    for (const s of tree('balance').steps) expect(s.gate).toBeUndefined()
  })

  it('has the leg-raise, eyes-closed balance and jump-rope tests', () => {
    const t = (id: string) => tests.find((x) => x.id === id)!
    for (const id of ['active-front-leg-raise', 'active-side-leg-raise'].flatMap((b) => [`${b}-left`, `${b}-right`])) {
      expect(t(id), id).toMatchObject({ metric: 'cm_height', higherIsBetter: true })
    }
    for (const id of ['single-leg-balance-eyes-closed-left', 'single-leg-balance-eyes-closed-right', 'jump-rope-continuous']) {
      expect(t(id), id).toMatchObject({ metric: 'seconds' })
    }
  })

  it('loads the knee on every spring explosive exercise', () => {
    for (const ex of Object.values(exerciseById)) if (ex.flags?.includes('spring') && ex.flags.includes('explosive')) expect(ex.loads, ex.id).toContain('knee')
  })

  it('needs a jump rope and is not home-friendly for jump-rope', () => {
    expect(exerciseById['jump-rope'].equipment).toContain('jump_rope')
    expect(exerciseById['jump-rope'].homeOk).toBe(false)
  })
})
