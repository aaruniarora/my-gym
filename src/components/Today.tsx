import { useMemo, useState } from 'react'
import { pickDayType } from '../lib/builder'
import type { DayMode, NiggleArea, SessionPlan, SessionRecord, Settings, SkillProgress } from '../lib/types'
import Info from './Info'
import { EQUIPMENT } from './labels'
import Preview from './Preview'
import ProgramCard from './ProgramCard'

export type Draft = Settings['lastDraft']

type Props = {
  settings: Settings; progress: SkillProgress[]; recent: SessionRecord[]; onSettings: (s: Settings) => void
  build: (d: Draft) => SessionPlan; onStart: (plan: SessionPlan) => void; onStartTest: () => void
}

// mirrors niggleAreas in content/schema.ts; importing it would pull zod into the bundle
const AREAS: NiggleArea[] = ['wrist', 'shoulder', 'elbow', 'knee', 'lower_back']
const MODES: [DayMode, string, string][] = [
  ['normal', 'Normal', 'Full session'],
  ['push', 'Feeling strong', 'Bonus sets if you have energy left'],
  ['tired', 'Low energy', 'Fewer sets, easier reps, more stretching; still counts'],
]
const FALLBACK = { gym: 'Everything', home: 'Bands, wall, floor' }
const DAY = 24 * 3600 * 1000

export default function Today({ settings, progress, recent, onSettings, build, onStart, onStartTest }: Props) {
  const draft = settings.lastDraft
  const { minutes, location } = draft
  // anything else, such as an old 'bare', reads as low energy
  const mode: DayMode = draft.mode === 'normal' || draft.mode === 'push' ? draft.mode : 'tired'
  const setDraft = (patch: Partial<Draft>) => onSettings({ ...settings, lastDraft: { ...draft, ...patch } })
  const [checkIn, setCheckIn] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const now = new Date()
  const effective = { minutes: Math.min(120, Math.max(10, minutes)), location, mode }
  // settings covers the draft, niggles and never-show, so the plan follows every input
  // eslint-disable-next-line react-hooks/exhaustive-deps -- build and effective are fresh every render; settings and recent are the real inputs
  const plan = useMemo(() => (showPlan ? build(effective) : undefined), [showPlan, settings, recent])

  function kit(l: 'gym' | 'home') {
    const have = settings.equipment?.[l]
    if (!have) return FALLBACK[l]
    const names = EQUIPMENT.filter(([e]) => have.includes(e)).map(([, label]) => label)
    return names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.join(', ') || 'Nothing ticked'
  }

  function toggleNiggle(area: NiggleArea) {
    const t = now.toISOString()
    const niggles = settings.niggles.some((n) => n.area === area && !n.clearedAt)
      ? settings.niggles.map((n) => (n.area === area && !n.clearedAt ? { ...n, clearedAt: t } : n))
      : [...settings.niggles, { area, startedAt: t }]
    onSettings({ ...settings, niggles })
  }

  return (
    <main>
      <h2>Today</h2>
      <ProgramCard settings={settings} progress={progress} recent={recent} onSettings={onSettings} onStartTest={onStartTest} />

      <h3>Where are you training?</h3>
      <div className="choices">
        {(['gym', 'home'] as const).map((l) => (
          <button key={l} className={`choice${location === l ? ' selected' : ''}`} aria-pressed={location === l} onClick={() => setDraft({ location: l })}>
            <strong>{l === 'gym' ? 'Gym' : 'Home'}</strong>
            <span className="small">{kit(l)}</span>
          </button>
        ))}
      </div>

      <h3>Minutes</h3>
      <input type="number" inputMode="numeric" min={10} max={120} value={minutes}
        onChange={(e) => setDraft({ minutes: Number(e.target.value) })} onBlur={() => setDraft({ minutes: effective.minutes })} />
      <div className="row">
        {[10, 20, 30, 45, 60, 90].map((m) => (
          <button key={m} className={minutes === m ? 'primary' : ''} onClick={() => setDraft({ minutes: m })}>{m}</button>
        ))}
      </div>

      <h3>How much today? <Info text="Normal is the full session, Feeling strong offers bonus sets if you have energy left, and Low energy means fewer sets, easier reps and more stretching that still counts." /></h3>
      <div className="choices">
        {MODES.map(([m, label, note]) => (
          <label key={m} className={`choice${mode === m ? ' selected' : ''}`}>
            <input type="radio" name="mode" checked={mode === m} onChange={() => setDraft({ mode: m })} />
            <strong>{label}</strong>
            <span className="small">{note}</span>
          </label>
        ))}
      </div>
      <p className="muted small">
        Next up: {pickDayType(recent, settings, now).replace('_', ' ')} · {recent.filter((s) => s.completed).length} of {settings.weeklyTarget} sessions in the last 7 days
      </p>

      <details open={checkIn} onToggle={(e) => setCheckIn(e.currentTarget.open)}>
        <summary>How are you today? (optional)</summary>
        <p className="muted small">Adjusts today's session: fewer sets if you're tired or sore.</p>
        <div className="row">
          {AREAS.map((a) => {
            const n = settings.niggles.find((x) => x.area === a && !x.clearedAt)
            return <button key={a} className={n ? 'primary' : ''} aria-pressed={!!n} onClick={() => toggleNiggle(a)}>Sore {a.replace('_', ' ')} this week?</button>
          })}
        </div>
        {settings.niggles.filter((n) => !n.clearedAt).map((n) => {
          const days = Math.floor((now.getTime() - Date.parse(n.startedAt)) / DAY)
          return <p key={n.area} className="muted">Sore {n.area.replace('_', ' ')} for {days} days{days > 14 && ' · over 14 days? consider a physio'}</p>
        })}
      </details>

      <details open={showPlan} onToggle={(e) => setShowPlan(e.currentTarget.open)}>
        <summary>See plan</summary>
        {plan && <Preview plan={plan} settings={settings} onSettings={onSettings} />}
      </details>

      <button className="primary wide start" onClick={() => onStart(plan ?? build(effective))}>Start</button>
    </main>
  )
}
