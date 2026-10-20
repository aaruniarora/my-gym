import type { DoseDefaults, Exercise, MilestoneTest, SkillTree } from '../../content/schema'
import conditioningWarmup from '../../content/exercises/conditioning-warmup.json'
import core from '../../content/exercises/core.json'
import flexibilityMobility from '../../content/exercises/flexibility-mobility.json'
import handstandHspuPlanche from '../../content/exercises/handstand-hspu-planche.json'
import legs from '../../content/exercises/legs.json'
import leversMuscleup from '../../content/exercises/levers-muscleup.json'
import pull from '../../content/exercises/pull.json'
import push from '../../content/exercises/push.json'
import skillTreesJson from '../../content/skill-trees.json'
import testBattery from '../../content/test-battery.json'
import doseDefaultsJson from '../../content/dose-defaults.json'
import niggleMobilityJson from '../../content/niggle-mobility.json'
import conditioningFormatsJson from '../../content/conditioning-formats.json'
import exdbCatalog from '../../content/media/exdb-catalog.json'
import type { NiggleArea } from '../lib/types'

export type Dose = Omit<DoseDefaults[keyof DoseDefaults], 'note'>
export type ConditioningFormat = { id: string; name: string; description: string; params: Record<string, unknown>; sourcesSeen?: string[] }

export const exercises = [conditioningWarmup, core, flexibilityMobility, handstandHspuPlanche, legs, leversMuscleup, pull, push].flat() as unknown as Exercise[]
export const exerciseById: Record<string, Exercise> = Object.fromEntries(exercises.map((e) => [e.id, e]))
export const skillTrees = skillTreesJson as unknown as SkillTree[]
export const tests = testBattery as unknown as MilestoneTest[]
export const doseDefaults = doseDefaultsJson as unknown as DoseDefaults
export const conditioningFormats = conditioningFormatsJson as unknown as ConditioningFormat[]

// entries may be plain ids or {id, allowLoaded} objects
export const niggleMobility = Object.fromEntries(
  Object.entries(niggleMobilityJson).map(([area, list]) => [area, (list as (string | { id: string })[]).map((x) => (typeof x === 'string' ? x : x.id))]),
) as Record<NiggleArea, string[]>

export function effectiveDose(ex: Exercise): Dose {
  const { note, ...defaults } = doseDefaults[ex.type]
  return { ...defaults, ...ex.dose }
}

export const EXDB_IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'
const exdbImagesById = new Map((exdbCatalog as { id: string; images: string[] }[]).map((e) => [e.id, e.images]))

export function exdbImages(ex: Exercise): string[] {
  if (ex.media.kind !== 'exdb') return []
  return (exdbImagesById.get(ex.media.exdbId) ?? []).map((path) => EXDB_IMAGE_BASE + path)
}
