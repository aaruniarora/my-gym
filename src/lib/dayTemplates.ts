import type { DayType } from './types'

// entries are exercise ids or `tree:<treeId>` (resolved to the current step)
export type DayTemplate = {
  strengthPairs: [string, string][]
  skills: string[]
  secondary: string[]
  core: string[]
  conditioning: string[]
  // cool-down stretches
  flexibility: string[]
  // folds the splits trees into the cool-down
  splits: boolean
  // movement day only
  balance?: string[]
  spring?: string[]
}

export const SPLITS_BLOCK = ['tree:front-split', 'tree:middle-split', 'tree:pike-pancake']
// cool-down picks by stretch area; tree refs only on splits days
export const COOLDOWN_AREAS: Record<string, string[]> = {
  hamstrings: ['tree:front-split', 'seated-pike'],
  hip_flexors: ['tree:front-split', 'couch-stretch'],
  adductors: ['tree:middle-split', 'pancake-passive'],
  back_shoulders: ['tree:bridge', 'lat-stretch', 'thoracic-extension'],
}
// cool-down with flexibility unticked
export const GENERAL_COOLDOWN = ['standing-hamstring-stretch', 'couch-stretch', 'lat-stretch']
export const WARMUP_POOL = ['leg-swing', 'hip-circle', 'cat-cow', 'worlds-greatest-stretch']
export const FOOT_POOL = ['short-foot', 'toe-yoga', 'tibialis-raise', 'calf-raise']
export const FULL_BODY_SKILLS = ['handstand', 'l-sit', 'bridge']

const none = { secondary: [], core: [], conditioning: ['burpee', 'mountain-climber', 'skipping'], splits: false }

export const dayTemplates: Record<Exclude<DayType, 'test'>, DayTemplate> = {
  pull: {
    ...none,
    strengthPairs: [['tree:pull-up', 'tree:push-up'], ['trx-row', 'tree:dip']],
    skills: ['handstand', 'l-sit'],
    secondary: ['band-face-pull', 'iyt-raise'],
    core: ['hanging-knee-raise', 'hollow-hold'],
    flexibility: ['lat-stretch', 'standing-hamstring-stretch', 'couch-stretch'],
  },
  push: {
    ...none,
    strengthPairs: [['tree:push-up', 'tree:pull-up'], ['tree:dip', 'band-row']],
    skills: ['handstand', 'hspu'],
    secondary: ['tree:hspu', 'lateral-raise'],
    core: ['hollow-hold', 'side-plank'],
    flexibility: ['thoracic-extension', 'couch-stretch', 'pigeon-stretch'],
  },
  legs: {
    ...none,
    strengthPairs: [['tree:pistol', 'hip-thrust'], ['split-squat', 'nordic-negative']],
    skills: ['bridge', 'l-sit'],
    secondary: ['kettlebell-rdl', 'calf-raise'],
    core: ['dead-bug'],
    flexibility: ['frog-stretch', 'ninety-ninety'],
    splits: true,
  },
  skill_core: {
    ...none,
    strengthPairs: [['tree:bridge', 'hollow-hold'], ['tree:dragon-flag', 'arch-hold']],
    skills: ['handstand', 'l-sit'],
    core: ['hanging-leg-raise', 'v-up'],
    conditioning: ['burpee', 'mountain-climber', 'kettlebell-swing'],
    flexibility: ['seated-pike', 'pigeon-stretch', 'lat-stretch'],
  },
  // skills are picked from FULL_BODY_SKILLS at build time
  full_body: {
    ...none,
    strengthPairs: [['tree:push-up', 'tree:pull-up'], ['tree:pistol', 'hollow-hold']],
    skills: [],
    flexibility: ['standing-hamstring-stretch', 'couch-stretch', 'frog-stretch', 'lat-stretch'],
  },
  light: {
    ...none,
    strengthPairs: [],
    skills: ['handstand'],
    conditioning: ['skipping'],
    flexibility: ['frog-stretch', 'ninety-ninety'],
    splits: true,
  },
  // secondary (stabilisers) and the active-flex drills are picked at build time; jump-rope becomes pogo-hop at home
  movement: {
    ...none,
    strengthPairs: [],
    skills: [],
    conditioning: [],
    flexibility: ['frog-stretch', 'ninety-ninety'],
    balance: ['tree:balance', 'hip-airplane', 'knee-chamber-hold', 'single-leg-rdl'],
    spring: ['jump-rope', 'low-hop-soft-landing', 'calf-raise', 'tibialis-raise'],
  },
}
