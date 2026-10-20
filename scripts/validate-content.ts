import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { z } from 'zod'
import { DoseDefaultsSchema, ExerciseSchema, NiggleMobilitySchema, SkillTreeSchema, TestBatterySchema, homeEquipment, type Exercise } from '../content/schema'
import { jsonSchemas } from './gen-schema'

export function validateContent(rootDir: string) {
  const content = join(rootDir, 'content')
  const errors: string[] = []
  const warnings: string[] = []

  function load(file: string) {
    try {
      return JSON.parse(readFileSync(join(content, file), 'utf8'))
    } catch (e) {
      errors.push(`${file}: ${(e as Error).message}`)
    }
  }

  function parseArray<T>(file: string, schema: z.ZodType<T>): T[] {
    const data = load(file)
    if (data === undefined) return []
    if (!Array.isArray(data)) {
      errors.push(`${file}: must be a JSON array`)
      return []
    }
    const items: T[] = []
    data.forEach((item, i) => {
      const result = schema.safeParse(item)
      if (result.success) items.push(result.data)
      else for (const issue of result.error.issues) errors.push(`${file}[${i}] ${item?.id ?? ''} ${issue.path.join('.')}: ${issue.message}`)
    })
    return items
  }

  const exerciseFiles = readdirSync(join(content, 'exercises')).filter((f) => f.endsWith('.json')).sort()
  const exercises = exerciseFiles.flatMap((f) => parseArray(`exercises/${f}`, ExerciseSchema))
  const trees = existsSync(join(content, 'skill-trees.json')) ? parseArray('skill-trees.json', SkillTreeSchema) : []
  const tests = existsSync(join(content, 'test-battery.json')) ? parseArray('test-battery.json', TestBatterySchema) : []

  const defaults = DoseDefaultsSchema.safeParse(load('dose-defaults.json'))
  if (!defaults.success) errors.push(`dose-defaults.json: ${defaults.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`)
  const catalog = new Set<string>((load('media/exdb-catalog.json') ?? []).map((e: { id: string }) => e.id))

  for (const [kind, list] of [['exercise', exercises], ['skill tree', trees], ['test', tests]] as const) {
    const seen = new Set<string>()
    for (const { id } of list) {
      if (seen.has(id)) errors.push(`duplicate ${kind} id: ${id}`)
      seen.add(id)
    }
  }

  const exerciseIds = new Set(exercises.map((e) => e.id))
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))
  const testById = new Map(tests.map((t) => [t.id, t]))
  const ref = (owner: string, field: string, id: string | undefined) => {
    if (id !== undefined && !exerciseIds.has(id)) errors.push(`${owner} ${field}: unknown exercise id ${id}`)
  }
  const home = new Set<string>(homeEquipment)
  const byType: Record<string, number> = {}
  const byPattern: Record<string, number> = {}
  let exdb = 0
  let youtube = 0
  let youtubeUncurated = 0
  const targetById = new Map<string, { sets: number; reps?: number; seconds?: number }>()

  for (const e of exercises) {
    byType[e.type] = (byType[e.type] ?? 0) + 1
    byPattern[e.pattern] = (byPattern[e.pattern] ?? 0) + 1

    ref(e.id, 'regression', e.regression)
    ref(e.id, 'progression', e.progression)
    for (const id of e.alternates.home) {
      ref(e.id, 'alternates.home', id)
      if (exerciseById.get(id)?.homeOk === false) errors.push(`${e.id} alternates.home: ${id} is not homeOk`)
    }
    for (const [area, list] of Object.entries(e.alternates.niggle)) for (const id of list ?? []) {
      ref(e.id, `alternates.niggle.${area}`, id)
      if (exerciseById.get(id)?.loads.includes(area as Exercise['loads'][number])) errors.push(`${e.id} alternates.niggle.${area}: ${id} itself loads ${area}`)
    }
    for (const id of e.alternates.general ?? []) ref(e.id, 'alternates.general', id)
    for (const area of e.loads) if (!e.alternates.niggle[area]?.length) errors.push(`${e.id}: loads ${area} so alternates.niggle.${area} needs at least one id`)

    const flags = e.flags ?? []
    if ((flags.includes('hand_balancing') || flags.includes('straight_arm')) && !flags.includes('needs_wrist_prep')) errors.push(`${e.id}: hand_balancing or straight_arm flag needs needs_wrist_prep`)
    if (flags.includes('pnf') && (e.phases.length !== 1 || e.phases[0] !== 'cooldown')) errors.push(`${e.id}: pnf flag needs phases exactly ["cooldown"]`)

    if (e.media.kind === 'exdb') {
      exdb++
      if (!catalog.has(e.media.exdbId)) errors.push(`${e.id} media.exdbId: not in exdb catalog: ${e.media.exdbId}`)
    } else {
      youtube++
      if (e.media.videoId === null) {
        youtubeUncurated++
        warnings.push(`${e.id}: youtube video not curated yet (search: ${e.media.searchHint})`)
      }
    }

    const notHome = e.equipment.filter((q) => !home.has(q))
    if (e.homeOk && notHome.length) errors.push(`${e.id}: homeOk is true but equipment includes ${notHome.join(', ')}`)
    if (!e.homeOk && !e.alternates.home.length) errors.push(`${e.id}: homeOk is false so alternates.home needs at least one id`)
    if (!e.homeOk && !notHome.length) warnings.push(`${e.id}: homeOk is false but all equipment is home equipment`)

    if (defaults.success) {
      const dose = { ...defaults.data[e.type], ...e.dose }
      if (e.mode.startsWith('time') && !dose.seconds) errors.push(`${e.id}: mode ${e.mode} needs dose.seconds (not in ${e.type} defaults)`)
      if (e.mode.startsWith('reps') && !dose.reps) errors.push(`${e.id}: mode ${e.mode} needs dose.reps (not in ${e.type} defaults)`)
      const timed = e.mode.startsWith('time')
      const target = dose.progressionTarget ?? (timed ? { sets: dose.sets[1], seconds: dose.seconds?.[1] } : { sets: dose.sets[1], reps: dose.reps?.[1] })
      if (!timed && target.seconds !== undefined) errors.push(`${e.id}: progressionTarget uses seconds but mode is reps`)
      if (timed && target.reps !== undefined) errors.push(`${e.id}: progressionTarget uses reps but mode is time`)
      const out = (v: number | undefined, r: [number, number] | undefined) => v !== undefined && r !== undefined && (v < r[0] || v > r[1])
      if (target.cmFromFloor === undefined && (out(target.sets, dose.sets) || out(target.reps, dose.reps) || out(target.seconds, dose.seconds))) errors.push(`${e.id}: progressionTarget ${JSON.stringify(target)} is outside the dose range`)
      targetById.set(e.id, target)
    }
  }

  for (const t of trees) {
    for (const { exerciseId, target, checkSet, gate } of t.steps) {
      ref(t.id, 'steps.exerciseId', exerciseId)
      const want = targetById.get(exerciseId)
      if (want && target.cmFromFloor === undefined && (target.sets !== want.sets || target.reps !== want.reps || target.seconds !== want.seconds)) errors.push(`${t.id} step ${exerciseId}: target ${JSON.stringify(target)} differs from exercise progression target ${JSON.stringify(want)}`)
      if (checkSet && (checkSet.sets > target.sets || (checkSet.reps ?? 0) > (target.reps ?? 0) || (checkSet.seconds ?? 0) > (target.seconds ?? 0))) errors.push(`${t.id} step ${exerciseId}: checkSet exceeds target`)
      for (const r of gate?.requirements ?? []) {
        const test = testById.get(r.testId)
        if (!test) errors.push(`${t.id} step ${exerciseId} gate: unknown test id ${r.testId}`)
        else if (test.metric !== r.metric) errors.push(`${t.id} step ${exerciseId} gate: metric ${r.metric} does not match test ${r.testId} metric ${test.metric}`)
      }
    }
  }
  for (const t of tests) ref(t.id, 'exerciseId', t.exerciseId)

  const niggleData = load('niggle-mobility.json')
  const niggleMobility = NiggleMobilitySchema.safeParse(niggleData)
  if (niggleData !== undefined && !niggleMobility.success) errors.push(`niggle-mobility.json: ${niggleMobility.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`)
  for (const [area, list] of Object.entries(niggleMobility.data ?? {})) for (const entry of list) {
    const { id, allowLoaded = false } = typeof entry === 'string' ? { id: entry } : entry
    const e = exerciseById.get(id)
    if (!e) errors.push(`niggle-mobility.${area}: unknown exercise id ${id}`)
    else {
      if (e.type !== 'mobility' && e.type !== 'stretch') errors.push(`niggle-mobility.${area}: ${id} must be type mobility or stretch`)
      if (!e.homeOk) errors.push(`niggle-mobility.${area}: ${id} is not homeOk`)
      if (!allowLoaded && e.loads.includes(area as Exercise['loads'][number])) errors.push(`niggle-mobility.${area}: ${id} itself loads ${area}`)
    }
  }

  for (const [file, schema] of Object.entries(jsonSchemas)) {
    const committed = load(`schema/${file}`)
    if (committed !== undefined && JSON.stringify(committed) !== JSON.stringify(schema)) errors.push(`schema/${file} is out of date: run npm run schema:gen`)
  }

  const summary = { exercises: exercises.length, byType, byPattern, exdb, youtube, youtubeUncurated, skillTrees: trees.length, tests: tests.length, niggleMobilityIds: Object.values(niggleMobility.data ?? {}).flat().length }
  return { errors, warnings, summary }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { errors, warnings, summary } = validateContent(join(import.meta.dirname, '..'))
  for (const w of warnings) console.log(`warning: ${w}`)
  for (const e of errors) console.log(`error: ${e}`)
  const counts = (r: Record<string, number>) => Object.entries(r).map(([k, n]) => `${k} ${n}`).join(', ')
  console.log(`\n${summary.exercises} exercises | type: ${counts(summary.byType)} | pattern: ${counts(summary.byPattern)}`)
  console.log(`media: exdb ${summary.exdb}, youtube ${summary.youtube} (${summary.youtubeUncurated} uncurated) | skill trees ${summary.skillTrees} | tests ${summary.tests} | niggle mobility ids ${summary.niggleMobilityIds}`)
  console.log(`${errors.length ? 'FAIL' : 'PASS'}: ${errors.length} errors, ${warnings.length} warnings`)
  process.exit(errors.length ? 1 : 0)
}
