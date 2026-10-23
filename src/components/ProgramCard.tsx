import { useEffect, useState } from 'react'
import { skillTrees, tests as battery } from '../content'
import { listTestResults } from '../lib/db'
import { blockOf, isTestDay, isTestWeek, nextTestWeek, proposeFocus, quarterWeek, suggestTestDayMove, testAllowed, untestedThisWeek } from '../lib/program'
import { localISO } from '../lib/trained'
import type { MilestoneResult, SessionRecord, Settings, SkillProgress } from '../lib/types'
import Info from './Info'

type Props = { settings: Settings; progress: SkillProgress[]; recent: SessionRecord[]; onSettings: (s: Settings) => void; onStartTest: () => void; symptomaticWeekdays: number[] }

const treeName = (id: string) => skillTrees.find((t) => t.id === id)?.name ?? id
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const short = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

export default function ProgramCard({ settings, progress, recent, onSettings, onStartTest, symptomaticWeekdays }: Props) {
  const today = localISO(new Date())
  const program = settings.program
  const now = new Date()
  const week = program ? quarterWeek(program.startDate, now) : 0
  const over = !program || week > 12
  const [focus, setFocus] = useState<string[]>()
  const [results, setResults] = useState<MilestoneResult[]>([])

  // recent changes after each finished session, which may have saved test results
  useEffect(() => { void listTestResults().then(setResults) }, [recent])

  useEffect(() => {
    if (over) void listTestResults().then((r) => setFocus(proposeFocus(r, settings.bests, progress)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposed once when the card shows; edits are kept
  }, [over])

  if (over) {
    const move = (i: number, d: number) => {
      const f = [...focus!]
      ;[f[i], f[i + d]] = [f[i + d], f[i]]
      setFocus(f)
    }
    return (
      <div className="card">
        <strong>{program ? 'Quarter finished: start the next one' : 'Start new quarter'}</strong>
        <p className="muted small">Focus, in priority order:</p>
        <ol>
          {focus?.map((id, i) => (
            <li key={id} className="row">
              <span style={{ flex: 1, alignSelf: 'center' }}>{treeName(id)}</span>
              <button disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button disabled={i === focus.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
            </li>
          ))}
        </ol>
        <button className="primary wide" disabled={!focus} onClick={() => onSettings({ ...settings, program: { startDate: today, focus: focus! } })}>Start quarter</button>
      </div>
    )
  }

  const next = nextTestWeek(week)
  const testMode = settings.testMode ?? { mode: 'spread', weekday: 6 }
  const location = settings.lastDraft.location
  const untested = untestedThisWeek(settings, progress, results, week, location)
  const total = battery.filter((t) => t.scheduledWeeks.includes(week) && testAllowed(t, settings, progress, location)).length
  // the test week is the quarter week, so it starts on the quarter's start weekday
  const [y, m, d] = program.startDate.split('-').map(Number)
  const weekStart = localISO(new Date(y, m - 1, d + (week - 1) * 7))
  const moveTo = testMode.mode === 'day' ? suggestTestDayMove(settings, symptomaticWeekdays, now) : null
  const sessions = recent.filter((s) => s.completed && s.plan.date.slice(0, 10) >= weekStart).length
  return (
    <div className="card">
      <p>Quarter from {short(program.startDate)} · {blockOf(week)} · Week {week} of 12{next !== null && ` · Next test: week ${next}`}{' '}
        <Info text="Max-effort tests in weeks 1, 4, 8 and 12; week 1 is your baseline." /></p>
      {isTestWeek(week) && testMode.mode === 'spread' && (
        <>
          <p className="muted small">Tests this week: {total - untested.length} done / {total}</p>
          {untested.length > 0 && (now.getDay() === 0 || sessions > 0) && <p className="muted small">Not tested this round: {untested.map((t) => t.name).join(', ')}</p>}
        </>
      )}
      {isTestWeek(week) && testMode.mode === 'day' && (isTestDay(settings, now)
        ? <button className="primary wide" onClick={onStartTest}>Start test session</button>
        : <p className="muted small">Test day: {WEEKDAYS[testMode.weekday]}</p>)}
      {moveTo && (
        <div className="row">
          <span className="small" style={{ flex: 1, alignSelf: 'center' }}>Your test day usually falls on a low day; move it to {WEEKDAYS[moveTo.to]}?</span>
          <button onClick={() => onSettings({ ...settings, testMode: { ...testMode, weekday: moveTo.to } })}>Move</button>
        </div>
      )}
    </div>
  )
}
