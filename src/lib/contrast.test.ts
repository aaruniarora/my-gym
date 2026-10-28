/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src', 'app.css'), 'utf8')
const light = css.slice(css.indexOf(':root'), css.indexOf('@media (prefers-color-scheme: dark)'))
const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf('* {'))

const tokens = (block: string) => Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [m[1], m[2]]))

function luminance(hex: string) {
  let h = hex.slice(1)
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function ratio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const kinds = ['warmup', 'skill', 'strength', 'core', 'cooldown', 'mint', 'test']

describe.each([['light', tokens(light)], ['dark', tokens(dark)]] as const)('contrast (%s)', (_name, t) => {
  it('has the tokens it checks', () => {
    for (const k of ['bg', 'accent', 'accent-text', 'period', 'fg', 'chart-2', 'mode-normal', 'mode-push', 'mode-tired']) expect(t[k], k).toBeDefined()
  })

  it('accent-text on accent is at least 4.5', () => {
    expect(ratio(t['accent-text'], t.accent)).toBeGreaterThanOrEqual(4.5)
  })

  it('accent on bg is at least 4.5 (links)', () => {
    expect(ratio(t.accent, t.bg)).toBeGreaterThanOrEqual(4.5)
  })

  it('fg on period is at least 4.5', () => {
    expect(ratio(t.fg, t.period)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(kinds)('block %s: fg on its bg is at least 4.5 and fg on page bg is at least 3', (k) => {
    expect(ratio(t[`block-${k}-fg`], t[`block-${k}-bg`])).toBeGreaterThanOrEqual(4.5)
    expect(ratio(t[`block-${k}-fg`], t.bg)).toBeGreaterThanOrEqual(3)
  })

  it.each(['plum', 'maroon'])('%s on bg, card and accent-soft is at least 4.5', (k) => {
    for (const b of ['bg', 'card', 'accent-soft']) expect(ratio(t[k], t[b]), b).toBeGreaterThanOrEqual(4.5)
  })

  it('chart-2 on bg is at least 3', () => {
    expect(ratio(t['chart-2'], t.bg)).toBeGreaterThanOrEqual(3)
  })

  it.each(['normal', 'push', 'tired'])('accent on mode-%s tint is at least 3', (m) => {
    expect(ratio(t.accent, t[`mode-${m}`])).toBeGreaterThanOrEqual(3)
  })
})
