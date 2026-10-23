import { useEffect, useState } from 'react'
import { exerciseById, exercises, skillTrees, tests } from '../content'
import { listAllSetLogs, listTestResults } from '../lib/db'
import { currentStep } from '../lib/progression'
import type { MilestoneResult, SetLog, Settings, SkillProgress } from '../lib/types'
import { cmSeries, personalRecords, testMarkers, treeStairs, weeklySeries } from '../lib/weekly'
import { WeeklyChart } from './Charts'
import SkillTrees from './SkillTrees'

type Props = { settings: Settings; progress: SkillProgress[]; onRequestCheck: (treeId: string, side?: 'left' | 'right') => void }

const name = (id: string) => exerciseById[id]?.name ?? id
const signed = (n: number) => `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}`
const cmIds = (treeId: string) => skillTrees.find((t) => t.id === treeId)?.steps.map((s) => s.exerciseId).filter((id) => exerciseById[id]?.loggable.cm) ?? []

export default function Progress(props: Props) {
  const { settings, progress } = props
  const [logs, setLogs] = useState<SetLog[]>([])
  const [results, setResults] = useState<MilestoneResult[]>([])
  const now = new Date()
  // current tree steps first, then everything else alphabetically
  const currentIds = [...new Set(skillTrees.flatMap((t) => (t.perSide ? (['left', 'right'] as const) : [undefined]).map((side) => currentStep(progress, t, now, settings.bests, side).step.exerciseId)))]
  const rest = exercises.filter((e) => !currentIds.includes(e.id)).sort((a, b) => a.name.localeCompare(b.name))
  const [exId, setExId] = useState(currentIds[0] ?? rest[0]?.id)

  useEffect(() => {
    void listAllSetLogs().then(setLogs)
    void listTestResults().then(setResults)
  }, [])

  const ex = exerciseById[exId]
  const unit = ex?.mode.startsWith('time') ? 's' : 'reps'
  const weeks = weeklySeries(logs, exId, settings.bands)
  const exTests = tests.filter((t) => t.exerciseId === exId)
  const markers = exTests.filter((t) => t.metric === (unit === 's' ? 'seconds' : 'reps')).flatMap((t) => testMarkers(results, t.id).map((m) => ({ ...m, label: 'Test' })))
  const kg = weeks.filter((w) => w.maxKg !== undefined)
  const band = weeks.filter((w) => w.bandLevel !== undefined)
  const stairs = skillTrees.map((t) => ({ tree: t, points: treeStairs(logs, t) })).filter((s) => s.points.length > 0)
  const front = cmSeries(logs, cmIds('front-split'))
  const middle = cmSeries(logs, cmIds('middle-split'))
  const pick = (ps: { week: string; left?: number; right?: number; value?: number }[], k: 'left' | 'right' | 'value') =>
    ps.flatMap((p) => (p[k] === undefined ? [] : [{ week: p.week, value: p[k] }]))
  const testSeries = (id: string, label: string) => ({ label, points: testMarkers(results, id) })
  const prs = Object.entries(personalRecords(logs)).sort(([a], [b]) => name(a).localeCompare(name(b)))

  return (
    <main className="progress">
      <h2>Progress</h2>

      <label>Exercise
        <select value={exId} onChange={(e) => setExId(e.target.value)}>
          <optgroup label="Current steps">{currentIds.map((id) => <option key={id} value={id}>{name(id)}</option>)}</optgroup>
          <optgroup label="All exercises">{rest.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</optgroup>
        </select>
      </label>
      <h3>Best set</h3>
      <WeeklyChart series={[{ label: unit, points: weeks.map((w) => ({ week: w.week, value: w.bestSet })) }]} unit={unit} yLabel="Best set" markers={markers} />
      <h3>Weekly total</h3>
      <WeeklyChart series={[{ label: unit, points: weeks.map((w) => ({ week: w.week, value: w.total })) }]} unit={unit} yLabel="Weekly total" />
      {kg.length > 0 && <>
        <h3>Heaviest weight</h3>
        <WeeklyChart series={[{ label: 'kg', points: kg.map((w) => ({ week: w.week, value: w.maxKg! })) }]} unit="kg" yLabel="Heaviest" />
      </>}
      {band.length > 0 && <>
        <h3>Band level</h3>
        <WeeklyChart step series={[{ label: 'band', points: band.map((w) => ({ week: w.week, value: w.bandLevel! })) }]} unit="higher = lighter" yLabel="Band level" />
      </>}
      {exTests.map((t) => {
        const ms = testMarkers(results, t.id)
        return ms.length > 0 && (
          <p key={t.id} className="small">{t.name}: {ms.at(-1)!.value}{ms.length > 1 && ` · vs baseline: ${signed(ms.at(-1)!.value - ms[0].value)}`}</p>
        )
      })}

      <h3>Skill trees</h3>
      <SkillTrees {...props} />
      <h3>Steps over time</h3>
      {stairs.length === 0 && <p className="muted small">Train 2 weeks to see a trend</p>}
      {stairs.map(({ tree, points }) => (
        <div key={tree.id}>
          <h4>{tree.name}</h4>
          <WeeklyChart step series={[{ label: 'step', points: points.map((p) => ({ week: p.week, value: p.stepIndex + 1 })) }]} unit="step" yLabel="Step" />
        </div>
      ))}

      <h3>Splits and leg raises</h3>
      <h4>Front split</h4>
      <WeeklyChart series={[{ label: 'L', points: pick(front, 'left') }, { label: 'R', points: pick(front, 'right') }]} unit="cm" yLabel="From floor"
        markers={[...testMarkers(results, 'front-split-left'), ...testMarkers(results, 'front-split-right')].map((m) => ({ ...m, label: m.side === 'right' ? 'R test' : 'L test' }))} />
      <h4>Middle split</h4>
      <WeeklyChart series={[{ label: 'cm', points: pick(middle, 'value') }]} unit="cm" yLabel="From floor" markers={testMarkers(results, 'middle-split').map((m) => ({ ...m, label: 'Test' }))} />
      <h4>Active front leg raise</h4>
      <WeeklyChart series={[testSeries('active-front-leg-raise-left', 'L'), testSeries('active-front-leg-raise-right', 'R')]} unit="cm" yLabel="Height" />
      <h4>Active side leg raise</h4>
      <WeeklyChart series={[testSeries('active-side-leg-raise-left', 'L'), testSeries('active-side-leg-raise-right', 'R')]} unit="cm" yLabel="Height" />

      <h3>Personal records</h3>
      {prs.length === 0 && <p className="muted small">No sets logged yet.</p>}
      {prs.map(([id, pr]) => (
        <p key={id} className="small">
          <strong>{name(id)}</strong>{' · '}
          {[pr.bestReps !== undefined && `${pr.bestReps} reps`, pr.bestSeconds !== undefined && `${pr.bestSeconds} s hold`, pr.maxKg !== undefined && `${pr.maxKg} kg`].filter(Boolean).join(' · ')}
        </p>
      ))}
    </main>
  )
}
