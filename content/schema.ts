import { z } from 'zod'

export const exerciseTypes = ['skill_hold', 'main_strength', 'accessory', 'core', 'conditioning', 'mobility', 'stretch'] as const
export const patterns = ['pull', 'push', 'legs', 'core', 'handstand', 'flexibility', 'conditioning', 'warmup'] as const
export const modes = ['reps', 'time', 'time_per_side', 'reps_per_side'] as const
export const equipment = ['pull_up_bar', 'dip_station', 'trx', 'band', 'door_anchor', 'dumbbell', 'kettlebell', 'slam_ball', 'box', 'bench', 'wall', 'floor', 'none'] as const
export const homeEquipment = ['band', 'door_anchor', 'wall', 'floor', 'none'] as const
export const niggleAreas = ['wrist', 'shoulder', 'elbow', 'knee', 'lower_back'] as const
export const stretchAreas = ['hamstrings', 'hip_flexors', 'adductors', 'back_shoulders', 'wrists', 'other'] as const
export const phases = ['warmup', 'main', 'cooldown'] as const
export const flags = ['pnf', 'explosive', 'straight_arm', 'hand_balancing', 'needs_wrist_prep'] as const
export const setups = ['trx_angle', 'box_height', 'incline_height', 'foot_elevation'] as const
export const coaches = ['FitnessFAQs', 'Calisthenicmovement', 'Antranik', 'GMB Fitness', 'Bodyweight Warrior', 'Hybrid Calisthenics', 'Stretch Therapy'] as const
export const treeKinds = ['strength', 'straight_arm', 'balance', 'flexibility', 'core'] as const
export const metrics = ['reps', 'seconds', 'cm_from_floor', 'pass_fail'] as const

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case')
const ids = z.array(id)
const count = z.number().int().nonnegative()
const range = z.tuple([count, count])
const target = z.strictObject({ sets: count, reps: count.optional(), seconds: count.optional(), cmFromFloor: z.number().optional() })

const dose = z.strictObject({
  sets: range,
  reps: range.optional(),
  seconds: range.optional(),
  restSeconds: count,
  progressionTarget: target.optional(),
})
const defaultDose = dose.extend({ note: z.string().optional() })

export const DoseDefaultsSchema = z.strictObject({
  skill_hold: defaultDose,
  main_strength: defaultDose,
  accessory: defaultDose,
  core: defaultDose,
  conditioning: defaultDose,
  mobility: defaultDose,
  stretch: defaultDose,
})

export const ExerciseSchema = z.strictObject({
  id,
  name: z.string().min(1),
  aliases: z.array(z.string()).optional(),
  type: z.enum(exerciseTypes),
  pattern: z.enum(patterns),
  mode: z.enum(modes),
  equipment: z.array(z.enum(equipment)).min(1),
  homeOk: z.boolean(),
  loads: z.array(z.enum(niggleAreas)),
  stretchAreas: z.array(z.enum(stretchAreas)).optional(),
  phases: z.array(z.enum(phases)).min(1),
  flags: z.array(z.enum(flags)).optional(),
  dose: dose.partial().optional(),
  loggable: z.strictObject({ weight: z.boolean(), band: z.boolean(), setup: z.enum(setups).nullable() }),
  technique: z.strictObject({
    setup: z.string().min(1),
    cues: z.array(z.string()).min(3).max(4),
    mistakes: z.array(z.string()).min(2),
    stopIf: z.array(z.string()).min(1),
  }),
  regression: id.optional(),
  progression: id.optional(),
  alternates: z.strictObject({ home: ids, niggle: z.record(z.enum(niggleAreas), ids), general: ids.optional() }),
  media: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('exdb'), exdbId: z.string().min(1) }),
    z.strictObject({
      kind: z.literal('youtube'),
      // null until the user curates a real video; never invent one
      videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'must be an 11-char YouTube id or null').nullable(),
      searchHint: z.string().min(1),
      preferredChannels: z.array(z.enum(coaches)).min(1),
    }),
  ]),
  sources: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

export const SkillTreeSchema = z.strictObject({
  id,
  name: z.string().min(1),
  kind: z.enum(treeKinds),
  // true: at most one step per 4-week block
  straightArm: z.boolean(),
  steps: z.array(z.strictObject({
    exerciseId: id,
    target,
    checkSet: target.optional(),
    // the step stays locked until every requirement is met
    gate: z.strictObject({
      description: z.string().min(1),
      requirements: z.array(z.strictObject({ testId: id, metric: z.enum(metrics), min: z.number() })).min(1),
    }).optional(),
  })).min(1),
  maintenance: z.strictObject({ setsPerWeek: count }),
})

export const TestBatterySchema = z.strictObject({
  id,
  name: z.string().min(1),
  exerciseId: id.optional(),
  metric: z.enum(metrics),
  protocol: z.string().min(1),
  scheduledWeeks: z.array(count.min(1)).min(1),
  higherIsBetter: z.boolean(),
})

// allowLoaded: user-confirmed pain-free even though the exercise loads this area
const mobilityBlock = z.array(z.union([id, z.strictObject({ id, allowLoaded: z.literal(true) })])).min(1).max(5)
export const NiggleMobilitySchema = z.strictObject({
  wrist: mobilityBlock,
  shoulder: mobilityBlock,
  elbow: mobilityBlock,
  knee: mobilityBlock,
  lower_back: mobilityBlock,
})

export type Exercise = z.infer<typeof ExerciseSchema>
export type SkillTree = z.infer<typeof SkillTreeSchema>
export type MilestoneTest = z.infer<typeof TestBatterySchema>
export type DoseDefaults = z.infer<typeof DoseDefaultsSchema>
export type NiggleMobility = z.infer<typeof NiggleMobilitySchema>
