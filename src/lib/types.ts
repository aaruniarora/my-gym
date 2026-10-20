// type-only so zod stays out of the app bundle
import type { niggleAreas } from '../../content/schema'

export type NiggleArea = (typeof niggleAreas)[number]

export type Location = 'gym' | 'home'
export type DayMode = 'normal' | 'push' | 'tired' | 'bare'
export type DayType = 'pull' | 'push' | 'legs' | 'skill_core' | 'full_body' | 'light'
export type BlockKind = 'warmup' | 'skill' | 'strength' | 'secondary' | 'core' | 'conditioning' | 'flexibility' | 'niggle_mobility' | 'cooldown'

export type PlannedExercise = {
  exerciseId: string
  sets: number
  reps?: [number, number]
  seconds?: number
  restSeconds: number
  pairWith?: string
  treeId?: string
  stepIndex?: number
  checkSet?: boolean
  // work/rest intervals: the player runs sets back to back and auto-logs them
  interval?: boolean
}

export type Block = { kind: BlockKind; exercises: PlannedExercise[] }

export type SessionPlan = {
  id: string
  date: string
  dayType: DayType
  mode: DayMode
  location: Location
  minutesTarget: number
  blocks: Block[]
  estSeconds: number
}

export type SetLog = {
  id: string
  sessionId: string
  exerciseId: string
  setIndex: number
  reps?: number
  seconds?: number
  side?: 'left' | 'right'
  repsLeft: 0 | 1 | 2 | 3
  weightKg?: number
  bandIds?: string[]
  setup?: string
  note?: string
  mode: DayMode
  at: string
}

export type SessionRecord = {
  plan: SessionPlan
  startedAt: string
  endedAt?: string
  completed: boolean
  note?: string
  painEvents?: string[]
  tooHardEvents?: string[]
}

export type Band = { id: string; colour: string; label: string; order: number; resistanceKg?: number }

export type SkillProgress = { treeId: string; stepIndex: number; hits: number; misses: number; droppedUntil?: string }

export type Niggle = { area: NiggleArea; startedAt: string; clearedAt?: string }

export type Settings = {
  weeklyTarget: number
  countdownSeconds: number
  voice: boolean
  beeps: boolean
  voiceRate: number
  sidePause: boolean
  bands: Band[]
  neverShow: string[]
  favourites: string[]
  niggles: Niggle[]
  // exerciseId -> best reps or seconds
  bests: Record<string, number>
  headphoneControls: boolean
  lastDraft: { minutes: number; location: Location; mode: DayMode }
  placed: boolean
}
