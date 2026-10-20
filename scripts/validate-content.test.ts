import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateContent } from './validate-content'

const fixture = (name: string) => validateContent(join(import.meta.dirname, '__fixtures__', name)).errors

describe('validateContent', () => {
  it('passes on the real content', () => {
    const { errors, summary } = validateContent(join(import.meta.dirname, '..'))
    expect(errors).toEqual([])
    expect(summary.exercises).toBeGreaterThan(0)
  })

  it('flags a dangling alternates.home id', () => {
    const errors = fixture('dangling-alternate')
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('unknown exercise id ghost-move')
  })

  it('flags a duplicate exercise id across files', () => {
    expect(fixture('duplicate-id')).toContainEqual(expect.stringContaining('duplicate exercise id: dead-bug'))
  })

  it('flags an unknown exdb id', () => {
    expect(fixture('unknown-exdb')).toContainEqual(expect.stringContaining('not in exdb catalog: Not_In_Catalog'))
  })

  it('flags a 12-character youtube videoId', () => {
    expect(fixture('long-video-id')).toContainEqual(expect.stringContaining('videoId'))
  })

  it('flags 5 cues', () => {
    expect(fixture('five-cues')).toContainEqual(expect.stringContaining('cues'))
  })

  it('flags homeOk with non-home equipment', () => {
    expect(fixture('home-ok-dumbbell')).toContainEqual(expect.stringContaining('homeOk is true but equipment includes dumbbell'))
  })

  it('flags a tree step target that differs from the exercise progression target', () => {
    expect(fixture('tree-target-mismatch')).toContainEqual(expect.stringContaining('differs from exercise progression target'))
  })

  it('flags a step gate with an unknown test id', () => {
    expect(fixture('gate-unknown-test')).toContainEqual(expect.stringContaining('gate: unknown test id nope'))
  })

  it('flags a niggle-mobility id that itself loads the area', () => {
    expect(fixture('niggle-itself-loads')).toContainEqual(expect.stringContaining('itself loads'))
  })

  it('flags a niggle-mobility id that is not mobility or stretch', () => {
    expect(fixture('niggle-core-type')).toContainEqual(expect.stringContaining('must be type mobility or stretch'))
  })
})
