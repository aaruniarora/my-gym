import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import type { Exercise } from '../../content/schema'
import { exerciseById } from '../content'
import { beep, speak, unlockAudio } from '../lib/audio'
import { REST } from '../lib/builder'
import { lastSetLog } from '../lib/db'
import { setMediaTitle, startMediaSession, stopMediaSession } from '../lib/mediaSession'
import { flatten, nextPos, prevPos } from '../lib/sequence'
import type { BlockKind, PlannedExercise, SessionPlan, SessionRecord, SetLog, Settings } from '../lib/types'
import { acquire, release } from '../lib/wakeLock'
import SetLogger from './SetLogger'
import TechniqueCard, { Demo } from './TechniqueCard'

type Props = {
  plan: SessionPlan
  settings: Settings
  onFinish: (record: SessionRecord, logs: SetLog[]) => void
  onAbort: () => void
  onPain?: (treeId: string) => void
  onTooHard?: (treeId: string) => void
  canDo?: (exerciseId: string) => boolean
}

type Phase = 'card' | 'ready' | 'work' | 'rest'
// rest: adaptive with rating; interval: fixed work/rest; transition: mobility/stretch hand-over, no rating
type RestKind = 'rest' | 'interval' | 'transition'
// the set just logged, kept for rating, edit and rest adjustment
type Last = { ids: string[]; exerciseId: string; base: number; target: number; lastCm?: (number | undefined)[] }

const SIDE_PAUSE = 3
const CARD_KINDS: BlockKind[] = ['skill', 'strength', 'secondary', 'core', 'conditioning']
const RATINGS = [['Easy', 3], ['Good', 1], ['Hard', 0]] as const

const doseText = (ex: Exercise, pe: PlannedExercise) =>
  pe.seconds !== undefined
    ? `${pe.seconds} seconds${ex.mode === 'time_per_side' ? ' per side' : ''}`
    : `${pe.reps?.[0] === pe.reps?.[1] ? pe.reps?.[0] : `${pe.reps?.[0]} to ${pe.reps?.[1]}`} reps${ex.mode === 'reps_per_side' ? ' per side' : ''}`

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
const clamp = (n: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, n))

export default function Player({ plan, settings, onFinish, onAbort, onPain, onTooHard, canDo = () => true }: Props) {
  const items = useMemo(() => flatten(plan), [plan])
  const [startedAt] = useState(() => new Date().toISOString())
  const [pos, setPos] = useState(0)
  const [phase, setPhase] = useState<Phase>('card')
  const [restKind, setRestKind] = useState<RestKind>('rest')
  const [swapped, setSwapped] = useState<Record<string, string>>({})
  const [skipped, setSkipped] = useState<string[]>([])
  const [trail, setTrail] = useState<number[]>([])
  const [seen, setSeen] = useState<string[]>([])
  const [logs, setLogs] = useState<SetLog[]>([])
  // log ids per position, so re-running a set replaces its own logs only
  const [logIds, setLogIds] = useState<Record<number, string[]>>({})
  const [last, setLast] = useState<Last | null>(null)
  const [painEvents, setPainEvents] = useState<string[]>([])
  const [tooHardEvents, setTooHardEvents] = useState<string[]>([])
  const [deadline, setDeadline] = useState(0)
  const [pausedLeft, setPausedLeft] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [sheet, setSheet] = useState<'technique' | 'swap' | 'edit' | null>(null)
  const [dbLast, setDbLast] = useState<SetLog | undefined>()
  const [dbSides, setDbSides] = useState<Partial<Record<'left' | 'right', SetLog>>>({})
  const started = useRef(false)
  const tooHardReported = useRef(new Set<string>())
  const media = useRef({ toggle: () => {}, next: () => {}, previous: () => {} })

  useEffect(() => {
    void acquire()
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => { clearInterval(t); void release(); stopMediaSession() }
  }, [])

  // pos === items.length only while resting after the final set
  const atEnd = pos >= items.length
  const item = items[Math.min(pos, items.length - 1)]
  const exId = (i: number) => swapped[items[i].key] ?? items[i].pe.exerciseId
  const ex = exerciseById[exId(Math.min(pos, items.length - 1))]
  const pe = item.pe
  const perSide = ex.mode === 'time_per_side'
  const timed = ex.mode === 'time' || perSide
  const sidePause = settings.sidePause ? SIDE_PAUSE : 0
  // the weaker side holds 1.5x longer
  const hold = (side: 'left' | 'right') => Math.round((pe.seconds ?? 0) * (pe.weakSide === side ? 1.5 : 1))
  const [rightSecs, leftSecs] = [hold('right'), hold('left')]
  const workTotal = pe.seconds !== undefined ? (perSide ? rightSecs + sidePause + leftSecs : pe.seconds) : 0
  const left = pausedLeft ?? Math.max(0, deadline - now)
  const secLeft = Math.ceil(left / 1000)

  const retitle = useEffectEvent(() => { if (started.current && settings.headphoneControls) setMediaTitle(ex.name) })
  useEffect(() => {
    let live = true
    lastSetLog(ex.id).then((l) => live && setDbLast(l)).catch(() => {})
    if (ex.loggable.cm) Promise.all([lastSetLog(ex.id, 'left', true), lastSetLog(ex.id, 'right', true)]).then(([left, right]) => live && setDbSides({ left, right })).catch(() => {})
    retitle()
    return () => { live = false }
  }, [ex.id, ex.loggable.cm])

  // the card shows once per slot+exercise, for the session's first exercise and main blocks only
  const needsCard = (i: number, seenList = seen, swaps = swapped) =>
    !seenList.includes(`${items[i].key}:${swaps[items[i].key] ?? items[i].pe.exerciseId}`) && (!started.current || CARD_KINDS.includes(items[i].kind))

  function startTimer(seconds: number) {
    const t = Date.now()
    setNow(t)
    setDeadline(t + seconds * 1000)
    setPausedLeft(null)
  }

  const addRest = (s: number) => pausedLeft === null ? setDeadline(deadline + s * 1000) : setPausedLeft(pausedLeft + s * 1000)

  function finish(completed: boolean, all = logs) {
    onFinish({ plan, startedAt, endedAt: new Date().toISOString(), completed, painEvents, tooHardEvents }, all)
  }

  function enter(i: number, swaps = swapped, seenList = seen) {
    if (i >= items.length) return finish(true)
    setPos(i)
    setSheet(null)
    if (needsCard(i, seenList, swaps)) return setPhase('card')
    const next = exerciseById[swaps[items[i].key] ?? items[i].pe.exerciseId]
    speak(`Next: ${next.name}, ${doseText(next, items[i].pe)}, starting in ${settings.countdownSeconds}`, settings)
    setPhase('ready')
    startTimer(settings.countdownSeconds)
  }

  function start() {
    unlockAudio()
    if (!started.current && settings.headphoneControls)
      startMediaSession({ toggle: () => media.current.toggle(), next: () => media.current.next(), previous: () => media.current.previous() }, ex.name)
    started.current = true
    const s = [...seen, `${item.key}:${ex.id}`]
    setSeen(s)
    enter(pos, swapped, s)
  }

  function startWork() {
    beep('go', settings)
    if (pe.interval) speak('Go', settings)
    if (perSide && pe.weakSide === 'right') speak('Weaker side: longer hold', settings)
    setPhase('work')
    if (timed) startTimer(workTotal)
  }

  // logs the current set with prefilled values and rating Good, then rests
  function logSet(seconds?: number, leftSeconds = seconds) {
    const prev = logs.filter((l) => l.exerciseId === ex.id).at(-1) ?? (dbLast?.exerciseId === ex.id ? dbLast : undefined)
    const base: Omit<SetLog, 'id'> = {
      sessionId: plan.id,
      exerciseId: ex.id,
      setIndex: item.setIndex,
      ...(timed ? { seconds } : { reps: prev?.reps ?? pe.reps?.[1] ?? 0 }),
      repsLeft: 1,
      ...(ex.loggable.weight && prev?.weightKg !== undefined && { weightKg: prev.weightKg }),
      ...(ex.loggable.band && prev?.bandIds && { bandIds: prev.bandIds }),
      ...(ex.loggable.setup && prev?.setup && { setup: prev.setup }),
      mode: plan.mode,
      at: new Date().toISOString(),
    }
    const sides = ex.mode.endsWith('_per_side') ? (['right', 'left'] as const) : [undefined]
    // cm is never prefilled; the last typed value on that side (this session, else saved) is the placeholder
    const lastCm = (side?: 'left' | 'right') => {
      const db = side ? dbSides[side] : dbLast
      return logs.filter((l) => l.exerciseId === ex.id && l.side === side && l.cmFromFloor !== undefined).at(-1)?.cmFromFloor ?? (db?.exerciseId === ex.id ? db.cmFromFloor : undefined)
    }
    const fresh = sides.map((side) => ({
      ...base,
      id: crypto.randomUUID(),
      ...(side && { side }),
      ...(timed && side === 'left' && { seconds: leftSeconds }),
    }))
    const ids = fresh.map((l) => l.id)
    const all = [...logs.filter((l) => !logIds[pos]?.includes(l.id)), ...fresh]
    setLogs(all)
    setLogIds({ ...logIds, [pos]: ids })
    setTrail([...trail, pos])

    const n = nextPos(items, pos + 1, skipped)
    const range = REST[ex.type].range
    const nextEx = n < items.length ? exerciseById[exId(n)] : undefined
    let rest = clamp(pe.restSeconds, range)
    if (ex.type === 'mobility' || ex.type === 'stretch') {
      // a last cm-logged stretch still gets the rest screen so cm can be entered
      if (!nextEx && !ex.loggable.cm) return finish(true, all)
      setRestKind('transition')
      if (nextEx) speak(`Next: ${nextEx.name}`, settings)
    } else if (pe.interval) {
      rest = pe.restSeconds
      setRestKind('interval')
      speak(nextEx && nextEx.id !== ex.id ? `Rest. Next: ${nextEx.name}` : 'Rest', settings)
    } else {
      setRestKind('rest')
      speak(`Rest ${rest} seconds`, settings)
    }
    setLast({ ids, exerciseId: ex.id, base: rest, target: rest, ...(ex.loggable.cm && { lastCm: sides.map(lastCm) }) })
    setPos(n)
    setPhase('rest')
    startTimer(rest)
  }

  function finishWork(early = false) {
    if (!early) beep('done', settings)
    const elapsed = Math.round((workTotal * 1000 - left) / 1000)
    if (!early) return perSide ? logSet(rightSecs, leftSecs) : logSet(pe.seconds)
    logSet(perSide ? Math.max(0, Math.round((elapsed - sidePause) / 2)) : elapsed)
  }

  // Hard adds 30 s, a second consecutive Easy takes 15 s off, always within the type's range
  function rate(r: 0 | 1 | 3) {
    if (!last) return
    const all = logs.map((l) => last.ids.includes(l.id) ? { ...l, repsLeft: r } : l)
    setLogs(all)
    if (restKind !== 'rest') return
    const before = all.filter((l) => l.exerciseId === last.exerciseId && l.side !== 'left' && !last.ids.includes(l.id)).at(-1)
    const adj = r === 0 ? 30 : r === 3 && before?.repsLeft === 3 ? -15 : 0
    const target = clamp(last.base + adj, REST[exerciseById[last.exerciseId].type].range)
    addRest(target - last.target)
    setLast({ ...last, target })
  }

  function skipRest() {
    if (atEnd) return finish(true)
    if (needsCard(pos)) return enter(pos)
    setPhase('ready')
    startTimer(3)
  }

  // runs once per timer second or phase change, reading the latest render's values
  const onTick = useEffectEvent(() => {
    if (phase === 'ready') {
      if (secLeft >= 1 && secLeft <= 3) beep('tick', settings)
      if (secLeft === 0) startWork()
    }
    if (phase === 'work' && timed) {
      if (perSide && secLeft === leftSecs + sidePause) {
        speak(pe.weakSide === 'left' ? 'Switch to left side. Weaker side: longer hold' : 'Switch to left side', settings)
        beep('switch', settings)
      }
      if (perSide && sidePause && secLeft === leftSecs) beep('go', settings)
      if (secLeft === 0) finishWork()
    }
    // rest doubles as the get-ready countdown unless a technique card comes next
    if (phase === 'rest') {
      if (atEnd) return void (secLeft === 0 && finish(true))
      const card = needsCard(pos)
      if (restKind === 'rest' && secLeft === 10) speak(`Next: ${ex.name}, ${doseText(ex, pe)}`, settings)
      if (!card && secLeft >= 1 && secLeft <= 3) beep('tick', settings)
      if (secLeft === 0 && card) { beep('done', settings); enter(pos) }
      else if (secLeft === 0) startWork()
    }
  })
  useEffect(() => { onTick() }, [secLeft, phase])

  const paused = pausedLeft !== null
  const togglePause = () => {
    if (pausedLeft === null) setPausedLeft(left)
    else { setDeadline(Date.now() + pausedLeft); setNow(Date.now()); setPausedLeft(null) }
  }

  function skipSet() {
    setTrail([...trail, pos])
    enter(nextPos(items, pos + 1, skipped))
  }

  function skipExercise() {
    const s = [...skipped, item.key]
    setSkipped(s)
    setTrail([...trail, pos])
    enter(nextPos(items, pos, s))
  }

  // re-runs the previous set (or a skipped one); its log is replaced only if completed again
  function previous() {
    const [p, t] = prevPos(trail, pos)
    setTrail(t)
    setSkipped(skipped.filter((k) => k !== items[p].key))
    enter(p)
  }

  function replace(id: string) {
    const s = { ...swapped, [item.key]: id }
    setSwapped(s)
    enter(pos, s)
  }

  function pain() {
    setPainEvents([...painEvents, ex.id])
    if (pe.treeId) onPain?.(pe.treeId)
    easier()
  }

  function tooHard() {
    setTooHardEvents([...tooHardEvents, ex.id])
    if (pe.treeId && !tooHardReported.current.has(pe.treeId)) {
      tooHardReported.current.add(pe.treeId)
      onTooHard?.(pe.treeId)
    }
    easier()
  }

  function easier() {
    if (ex.regression && exerciseById[ex.regression] && canDo(ex.regression)) {
      speak('Switching to an easier variation', settings)
      replace(ex.regression)
    } else skipExercise()
  }

  // the rest timer holds while editing so the next set cannot start underneath
  function openEdit() {
    if (pausedLeft === null) setPausedLeft(left)
    setSheet('edit')
  }

  const end = () => logs.length === 0 ? onAbort() : finish(false)
  const done = () => logSet()

  media.current = {
    toggle: () => phase === 'card' ? start() : phase === 'work' && !timed ? done() : togglePause(),
    next: skipSet,
    previous,
  }

  const active = settings.niggles.filter((n) => !n.clearedAt).map((n) => n.area)
  const swapOptions = [...new Set([
    ...(ex.alternates.general ?? []),
    ...ex.alternates.home.filter((id) => plan.location === 'home' || exerciseById[id]?.homeOk),
    ...active.flatMap((a) => ex.alternates.niggle[a] ?? []),
  ])].filter((id) => exerciseById[id] && id !== ex.id && (plan.location !== 'home' || exerciseById[id].homeOk) && !settings.neverShow.includes(id) && canDo(id))

  const elapsed = workTotal - secLeft
  const sideLabel = !perSide ? '' : elapsed < rightSecs ? 'Right side' : elapsed < rightSecs + sidePause ? 'Switch sides' : 'Left side'
  const shown = !perSide ? secLeft : elapsed < rightSecs ? rightSecs - elapsed : elapsed < rightSecs + sidePause ? rightSecs + sidePause - elapsed : secLeft
  const lastLogs = logs.filter((l) => last?.ids.includes(l.id))
  const cmLogs = lastLogs.filter((l) => exerciseById[l.exerciseId].loggable.cm)
  const setCm = (id: string, value: string) => setLogs(logs.map((l) => (l.id === id ? { ...l, cmFromFloor: value === '' ? undefined : Number(value) } : l)))
  const cmHint = (id: string) => last?.lastCm?.[last.ids.indexOf(id)]
  const rating = lastLogs[0]?.repsLeft

  return (
    <main className="player">
      {atEnd
        ? <h2>Last set done</h2>
        : <>
          <p className="muted">Set {item.setIndex + 1} of {pe.sets}{phase === 'rest' && ' - up next'}</p>
          <h2>{ex.name}</h2>
          <p>{doseText(ex, pe)}</p>
        </>}

      {phase === 'card' && <>
        <TechniqueCard exercise={ex} />
        <button className="primary wide huge" onClick={start}>Start</button>
      </>}

      {phase !== 'card' && !atEnd && (
        <div className="active-demo">
          <Demo key={ex.id} exercise={ex} />
          <ul className="cues">{ex.technique.cues.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}

      {phase === 'ready' && <><p>Get ready</p><div className="timer">{secLeft}</div></>}
      {phase === 'work' && (timed
        ? <><p>{sideLabel}</p><div className="timer">{mmss(shown)}</div><button className="wide" onClick={() => finishWork(true)}>Done early</button></>
        : <button className="primary done-target" onClick={done}>Done</button>)}
      {phase === 'rest' && <>
        <p>{restKind !== 'transition' ? 'Rest' : atEnd ? 'Done' : `Next: ${ex.name}`}</p>
        <div className="timer">{mmss(secLeft)}</div>
        {/* typing holds the timer, like edit */}
        {cmLogs.length > 0 && <div className="row">{cmLogs.map((l) => (
          <label key={l.id}>{l.side === 'left' ? 'Left ' : l.side === 'right' ? 'Right ' : ''}cm from floor
            <input type="number" inputMode="decimal" min={0} value={l.cmFromFloor ?? ''} placeholder={cmHint(l.id) !== undefined ? `last ${cmHint(l.id)}` : undefined} onFocus={() => pausedLeft === null && setPausedLeft(left)} onChange={(e) => setCm(l.id, e.target.value)} />
          </label>
        ))}</div>}
        {restKind !== 'transition' && lastLogs.length > 0 && <>
          <div className="row big">
            {RATINGS.map(([label, r]) => <button key={label} className={rating === r ? 'primary' : ''} onClick={() => rate(r)}>{label}</button>)}
          </div>
          <button className="link" onClick={openEdit}>edit</button>
        </>}
        <div className="row">
          <button onClick={() => addRest(30)}>+30 s</button>
          <button className="primary" onClick={skipRest}>{atEnd ? 'Finish' : 'Skip rest'}</button>
        </div>
      </>}

      <div className="controls">
        <button onClick={previous}>Previous</button>
        <button onClick={togglePause}>{paused ? 'Resume' : 'Pause'}</button>
        <button onClick={skipSet}>Skip set</button>
        <button onClick={skipExercise}>Skip exercise</button>
        <button onClick={() => setSheet('technique')}>Technique</button>
        <button onClick={() => setSheet('swap')}>Swap</button>
        <button onClick={tooHard}>Too hard</button>
        <button className="danger" onClick={pain}>Pain</button>
        <button onClick={end}>End session</button>
      </div>

      {sheet && (
        <div className="sheet">
          {sheet !== 'edit' && <button className="wide" onClick={() => setSheet(null)}>Close</button>}
          {sheet === 'technique' && <TechniqueCard exercise={ex} />}
          {sheet === 'swap' && (swapOptions.length === 0
            ? <p className="muted">No alternates available</p>
            : swapOptions.map((id) => <button key={id} className="wide" onClick={() => replace(id)}>{exerciseById[id].name}</button>))}
          {sheet === 'edit' && lastLogs.length > 0 && (
            <SetLogger exercise={exerciseById[lastLogs[0].exerciseId]} logs={lastLogs} settings={settings}
              onSave={(edited) => { setLogs(logs.map((l) => edited.find((e) => e.id === l.id) ?? l)); setSheet(null); togglePause() }} />
          )}
        </div>
      )}
    </main>
  )
}
