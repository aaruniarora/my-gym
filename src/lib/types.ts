// type-only so zod stays out of the app bundle
import type { equipment, niggleAreas } from '../../content/schema'

export type NiggleArea = (typeof niggleAreas)[number]
export type Equipment = (typeof equipment)[number]

export type Location = 'gym' | 'home'
export type DayMode = 'normal' | 'push' | 'tired'
export type DayType = 'pull' | 'push' | 'legs' | 'skill_core' | 'full_body' | 'light' | 'movement' | 'test'
export type BlockKind = 'warmup' | 'skill' | 'strength' | 'secondary' | 'core' | 'conditioning' | 'flexibility' | 'niggle_mobility' | 'cooldown' | 'balance' | 'spring' | 'test'

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
  // per-side trees: the side whose step was planned; the player holds it longer
  weakSide?: 'left' | 'right'
  // test sessions: the milestone test this item records
  testId?: string
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
  cmFromFloor?: number
  repsLeft: 0 | 1 | 2 | 3
  weightKg?: number
  bandIds?: string[]
  setup?: string
  note?: string
  mode: DayMode
  at: string
  updatedAt?: string
}

export type SessionRecord = {
  plan: SessionPlan
  startedAt: string
  endedAt?: string
  completed: boolean
  note?: string
  painEvents?: string[]
  tooHardEvents?: string[]
  updatedAt?: string
}

export type Band = { id: string; colour: string; label: string; order: number; resistanceKg?: number }

// per-side trees keep one entry per side
export type SkillProgress = { treeId: string; side?: 'left' | 'right'; stepIndex: number; hits: number; misses: number; droppedUntil?: string; checkPending?: boolean; updatedAt?: string }

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
  // exerciseId (or test id for the movement tests) -> best reps, seconds or cm
  bests: Record<string, number>
  headphoneControls: boolean
  lastDraft: { minutes: number; location: Location; mode: DayMode }
  placed: boolean
  // training parts to plan; at least one stays ticked. Optional for settings saved before it existed
  focus?: { strength: boolean; mobility: boolean; flexibility: boolean }
  // current quarter; focus is tree ids in priority order
  program?: { startDate: string; focus: string[] }
  // ticked equipment per location; absent in settings saved before it existed
  equipment?: { gym: Equipment[]; home: Equipment[] }
  // test weeks: tests spread over the week's sessions, or one test day (weekday as JS getDay(), 0 = Sunday)
  testMode?: { mode: 'spread' | 'day'; weekday: number }
  // opt-in; cycle features stay off unless ticked
  cycleTracking?: boolean
  updatedAt?: string
}

export type MilestoneResult = { id: string; testId: string; side?: 'left' | 'right'; value: number; week: number; date: string; updatedAt?: string }

export type PeriodFlow = 'none' | 'light' | 'medium' | 'heavy'

// one row per local date (yyyy-mm-dd); manual fields win over Garmin ones
export type HealthDaily = {
  date: string
  periodFlow?: PeriodFlow
  cramps?: number
  sleepHours?: number
  sleepScore?: number
  bodyBattery?: number
  readiness?: number
  restingHr?: number
  hrv?: number
  source: 'garmin' | 'manual'
  updatedAt?: string
}

export type Checkin = { date: string; energy?: number; sleepQuality?: number; periodFlow?: PeriodFlow; cramps?: number; notes?: string; updatedAt?: string }

export type Activity = { id: string; date: string; type: 'dance' | 'taekwondo' | 'run' | 'other'; minutes: number; intensity: 'easy' | 'moderate' | 'hard'; stretched: boolean; updatedAt?: string }

export type GarminStatus = { lastOk?: string; lastError?: string; lastAttempt?: string; updatedAt?: string }

// a local row waiting to be pushed; one entry per row, overwritten by newer saves
export type Outbox = { id: string; table: 'settings' | 'progress' | 'sessions' | 'set_logs' | 'milestone_tests' | 'health_daily' | 'checkins' | 'activities'; row: unknown; at: string }
