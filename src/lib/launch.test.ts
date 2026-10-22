import { describe, expect, it } from 'vitest'
import { afterSignIn, launchScreen } from './launch'

const base = { canSync: true, hasSession: false, offlineChoice: false, placed: false }

describe('launchScreen', () => {
  it.each([true, false])('asks to sign in when sync is on with no session or offline choice (placed %s)', (placed) => {
    expect(launchScreen({ ...base, placed })).toBe('signin')
  })

  it('goes to placement with a session and not placed', () => {
    expect(launchScreen({ ...base, hasSession: true })).toBe('placement')
  })

  it('goes to today with a session and placed', () => {
    expect(launchScreen({ ...base, hasSession: true, placed: true })).toBe('today')
  })

  it('goes to today when sync is off and placed', () => {
    expect(launchScreen({ ...base, canSync: false, placed: true })).toBe('today')
  })

  it('goes to placement when offline was chosen and not placed', () => {
    expect(launchScreen({ ...base, offlineChoice: true })).toBe('placement')
  })
})

describe('afterSignIn', () => {
  it('skips placement once placed is pulled as true', () => {
    expect(afterSignIn(true)).toBe('today')
    expect(afterSignIn(false)).toBe('placement')
  })
})
