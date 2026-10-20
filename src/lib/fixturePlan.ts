import type { SessionPlan, Settings } from './types'

// hand-written demo plan until the builder is wired in (H4)
export const fixturePlan: SessionPlan = {
  id: 'fixture-pull',
  date: '2026-10-20',
  dayType: 'pull',
  mode: 'normal',
  location: 'gym',
  minutesTarget: 30,
  estSeconds: 1800,
  blocks: [
    { kind: 'warmup', exercises: [
      { exerciseId: 'leg-swing', sets: 1, reps: [10, 10], restSeconds: 0 },
      { exerciseId: 'wrist-prep', sets: 1, reps: [8, 10], restSeconds: 0 },
    ] },
    { kind: 'strength', exercises: [
      { exerciseId: 'band-assisted-pull-up', sets: 3, reps: [5, 8], restSeconds: 90, pairWith: 'incline-push-up' },
      { exerciseId: 'incline-push-up', sets: 3, reps: [6, 10], restSeconds: 90, pairWith: 'band-assisted-pull-up' },
    ] },
    { kind: 'skill', exercises: [{ exerciseId: 'chest-to-wall-handstand-hold', sets: 3, seconds: 20, restSeconds: 90 }] },
    { kind: 'core', exercises: [{ exerciseId: 'side-plank', sets: 2, seconds: 20, restSeconds: 10, interval: true }] },
    { kind: 'cooldown', exercises: [
      { exerciseId: 'standing-hamstring-stretch', sets: 1, seconds: 45, restSeconds: 0 },
      { exerciseId: 'couch-stretch', sets: 1, seconds: 45, restSeconds: 0 },
    ] },
  ],
}

export const fixtureSettings: Settings = {
  weeklyTarget: 4,
  countdownSeconds: 10,
  voice: true,
  beeps: true,
  voiceRate: 1,
  sidePause: true,
  bands: [
    { id: 'red', colour: 'red', label: 'Red (heavy)', order: 3 },
    { id: 'green', colour: 'green', label: 'Green', order: 2 },
    { id: 'purple', colour: 'purple', label: 'Purple (light)', order: 1 },
  ],
  neverShow: [],
  favourites: [],
  niggles: [],
  bests: {},
  headphoneControls: false,
  lastDraft: { minutes: 30, location: 'gym', mode: 'normal' },
  placed: true,
}
