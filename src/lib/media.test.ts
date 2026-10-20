/// <reference types="node" />
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { EXDB_IMAGE_BASE, exdbImages, exercises } from '../content'

type Entry = { id: string; images: string[] }
const root = process.cwd()
const text = (path: string) => readFileSync(join(root, path), 'utf8')
const used: Entry[] = JSON.parse(text('content/media/exdb-used.json'))
const catalog: Entry[] = JSON.parse(text('content/media/exdb-catalog.json'))
const usedIds = used.map((e) => e.id)
const exdbExercises = exercises.filter((ex) => ex.media.kind === 'exdb')
const exdbIdsInUse = new Set(exdbExercises.map((ex) => (ex.media as { exdbId: string }).exdbId))

describe('exercise media', () => {
  it('resolves every exdb exercise to two images under the base path', () => {
    expect(exdbExercises.length).toBeGreaterThan(0)
    for (const ex of exdbExercises) {
      expect(usedIds, ex.id).toContain((ex.media as { exdbId: string }).exdbId)
      const images = exdbImages(ex)
      expect(images, ex.id).toHaveLength(2)
      expect(images[0], ex.id).toMatch(/\/0\.jpg$/)
      expect(images[1], ex.id).toMatch(/\/1\.jpg$/)
      for (const img of images) expect(img.startsWith(EXDB_IMAGE_BASE), img).toBe(true)
    }
  })

  it('has no stale exdb-used entries and matches the full catalog', () => {
    for (const e of used) {
      expect(exdbIdsInUse.has(e.id), e.id).toBe(true)
      expect(catalog.find((c) => c.id === e.id)?.images, e.id).toEqual(e.images)
    }
  })

  it('has non-empty 0.jpg and 1.jpg on disk for every used id', () => {
    for (const id of usedIds) {
      for (const file of ['0.jpg', '1.jpg']) {
        const path = join(root, 'public/media/exdb', id, file)
        expect(existsSync(path), path).toBe(true)
        expect(statSync(path).size, path).toBeGreaterThan(0)
      }
    }
  })
})

describe('deploy config', () => {
  it('configures vite for the /my-gym/ subpath as a standalone PWA', () => {
    const config = text('vite.config.ts')
    expect(config).toMatch(/base:\s*['"]\/my-gym\/['"]/)
    expect(config).toMatch(/start_url:\s*['"]\/my-gym\/['"]/)
    expect(config).toMatch(/scope:\s*['"]\/my-gym\/['"]/)
    expect(config).toMatch(/display:\s*['"]standalone['"]/)
    expect(config).toMatch(/navigateFallback:\s*['"]\/my-gym\/index\.html['"]/)
  })

  it('runs the checks then deploys to GitHub Pages', () => {
    const workflow = text('.github/workflows/deploy.yml')
    for (const step of ['npm run validate', 'npm run typecheck', 'npm test', 'npm run build']) expect(workflow).toContain(step)
    expect(workflow).toContain('actions/deploy-pages')
  })

  it('normalises line endings to lf', () => {
    expect(text('.gitattributes')).toContain('* text=auto eol=lf')
  })
})
