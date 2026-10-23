import { useMemo, useState } from 'react'
import { pickDayType } from '../lib/builder'
import { prefillCheckin } from '../lib/readiness'
import { localISO } from '../lib/trained'
import type { Activity, Checkin, DayMode, HealthDaily, NiggleArea, SessionPlan, SessionRecord, Settings, SkillProgress } from '../lib/types'
import Info from './Info'
import { EQUIPMENT } from './labels'
import Preview from './Preview'
import ProgramCard from './ProgramCard'

export type Draft = Settings['lastDraft']

type Props = {
  settings: Settings; progress: SkillProgress[]; recent: SessionRecord[]; onSettings: (s: Settings) => void
  build: (d: Draft) => SessionPlan; onStart: (plan: SessionPlan) => void; onStartTest: () => void
  suggested: { mode: DayMode | null; reason: string } | null; redFlag: string | null; symptomaticWeekdays: number[]
  checkin?: Checkin; health?: HealthDaily; activities: Activity[]; onCheckin: (c: Checkin, activities: Activity[], manualHealth?: Partial<HealthDaily>) => void
}

// mirrors niggleAreas in content/schema.ts; importing it would pull zod into the bundle
const AREAS: NiggleArea[] = ['wrist', 'shoulder', 'elbow', 'knee', 'lower_back']
const MODES: [DayMode, string, string][] = [
  ['normal', 'Normal', 'Full session'],
  ['push', 'Feeling strong', 'Bonus sets if you have energy left'],
  ['tired', 'Low energy', 'Fewer sets, easier reps, more stretching; still counts'],
]
const SCALE = [1, 2, 3, 4, 5]
const FLOWS = ['none', 'light', 'medium', 'heavy'] as const
const NEW_ACTIVITY = { type: 'dance' as Activity['type'], minutes: 60, intensity: 'moderate' as Activity['intensity'], stretched: false }
const FALLBACK = { gym: 'Everything', home: 'Bands, wall, floor' }
const DAY = 24 * 3600 * 1000

export default function Today({ settings, progress, recent, onSettings, build, onStart, onStartTest, suggested, redFlag, symptomaticWeekdays, checkin, health, activities: saved, onCheckin }: Props) {
  const draft = settings.lastDraft
  const { minutes, location } = draft
  // anything else, such as an old 'bare', reads as low energy
  const mode: DayMode = draft.mode === 'normal' || draft.mode === 'push' ? draft.mode : 'tired'
  const setDraft = (patch: Partial<Draft>) => onSettings({ ...settings, lastDraft: { ...draft, ...patch } })
  const [checkIn, setCheckIn] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // edits on top of the saved check-in, itself on top of what Garmin knows about today
  const [edit, setEdit] = useState<Partial<Checkin>>({})
  const [activities, setActivities] = useState<Activity[]>([])
  const [activity, setActivity] = useState(NEW_ACTIVITY)
  const now = new Date()
  const today = localISO(now)
  const yesterday = localISO(new Date(now.getTime() - DAY))
  const [activityDate, setActivityDate] = useState(today)
  const tracking = !!settings.cycleTracking
  const form = { ...prefillCheckin(health, tracking), ...checkin, ...edit }
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

  function saveCheckin() {
    const cycle = tracking ? { periodFlow: form.periodFlow, cramps: form.cramps } : {}
    onCheckin({ date: today, energy: form.energy, sleepQuality: form.sleepQuality, notes: form.notes, ...cycle }, activities,
      tracking ? { date: today, source: 'manual', ...cycle } : undefined)
    setCheckIn(false)
  }

  const scale = (label: string, key: 'energy' | 'sleepQuality') => (
    <>
      <p>{label}</p>
      <div className="row">
        {SCALE.map((v) => <button key={v} className={form[key] === v ? 'primary' : ''} aria-pressed={form[key] === v} onClick={() => setEdit({ ...edit, [key]: v })}>{v}</button>)}
      </div>
    </>
  )

  return (
    <main>
      <h2>Today</h2>
      <ProgramCard settings={settings} progress={progress} recent={recent} onSettings={onSettings} onStartTest={onStartTest} symptomaticWeekdays={symptomaticWeekdays} />
      {redFlag && <p className="muted small">{redFlag}</p>}
      {suggested?.mode && suggested.mode !== draft.mode && !dismissed && (
        <div className="card">
          <p>{MODES.find(([m]) => m === suggested.mode)?.[1]} suggested: {suggested.reason}</p>
          <div className="row">
            <button className="primary" onClick={() => setDraft({ mode: suggested.mode! })}>Use</button>
            <button onClick={() => setDismissed(true)}>Keep {MODES.find(([m]) => m === mode)?.[1]}</button>
          </div>
        </div>
      )}

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
        Next up: {pickDayType(recent, settings, now, saved).replace('_', ' ')} · {recent.filter((s) => s.completed).length} of {settings.weeklyTarget} sessions in the last 7 days
      </p>

      <details open={checkIn} onToggle={(e) => setCheckIn(e.currentTarget.open)}>
        <summary>How are you today? (optional)</summary>
        <p className="muted small">Adjusts today's session: fewer sets if you're tired or sore.</p>
        {scale('Energy (1 = drained, 5 = great)', 'energy')}
        {scale('Sleep quality (1 = awful, 5 = great)', 'sleepQuality')}
        <p>Sore areas</p>
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
        {tracking && <>
          <p>Period today</p>
          <div className="row">
            {FLOWS.map((f) => <button key={f} className={form.periodFlow === f ? 'primary' : ''} aria-pressed={form.periodFlow === f} onClick={() => setEdit({ ...edit, periodFlow: f })}>{f[0].toUpperCase() + f.slice(1)}</button>)}
          </div>
          <p>Cramps (0 = none, 3 = strong)</p>
          <div className="row">
            {[0, 1, 2, 3].map((v) => <button key={v} className={form.cramps === v ? 'primary' : ''} aria-pressed={form.cramps === v} onClick={() => setEdit({ ...edit, cramps: v })}>{v}</button>)}
          </div>
        </>}
        <p>Other activity today or yesterday</p>
        {saved.filter((a) => a.date === today || a.date === yesterday).map((a) => (
          <p key={a.id} className="muted small">{a.date === today ? 'Today' : 'Yesterday'} · {a.type} · {a.minutes} min · {a.intensity}{a.stretched && ' · stretching'}</p>
        ))}
        <div className="row">
          <select aria-label="Day" value={activityDate} onChange={(e) => setActivityDate(e.target.value)}>
            <option value={today}>Today</option>
            <option value={yesterday}>Yesterday</option>
          </select>
          <select aria-label="Activity" value={activity.type} onChange={(e) => setActivity({ ...activity, type: e.target.value as Activity['type'] })}>
            {(['dance', 'taekwondo', 'run', 'other'] as const).map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
          </select>
          <input type="number" inputMode="numeric" min={5} max={300} aria-label="Minutes" value={activity.minutes} onChange={(e) => setActivity({ ...activity, minutes: Number(e.target.value) })} />
          <select aria-label="Intensity" value={activity.intensity} onChange={(e) => setActivity({ ...activity, intensity: e.target.value as Activity['intensity'] })}>
            {(['easy', 'moderate', 'hard'] as const).map((i) => <option key={i} value={i}>{i[0].toUpperCase() + i.slice(1)}</option>)}
          </select>
        </div>
        <label className="row">Included stretching <input type="checkbox" checked={activity.stretched} onChange={(e) => setActivity({ ...activity, stretched: e.target.checked })} /></label>
        <button disabled={!(activity.minutes > 0)} onClick={() => setActivities([...activities, { id: crypto.randomUUID(), date: activityDate, ...activity }])}>Add</button>
        {activities.map((a) => (
          <div key={a.id} className="row">
            <span style={{ flex: 1, alignSelf: 'center' }}>{a.date === today ? 'Today' : 'Yesterday'} · {a.type} · {a.minutes} min · {a.intensity}{a.stretched && ' · stretching'}</span>
            <button onClick={() => setActivities(activities.filter((x) => x.id !== a.id))}>Remove</button>
          </div>
        ))}
        <button className="primary wide" onClick={saveCheckin}>Save check-in</button>
      </details>

      <details open={showPlan} onToggle={(e) => setShowPlan(e.currentTarget.open)}>
        <summary>See plan</summary>
        {plan && <Preview plan={plan} settings={settings} onSettings={onSettings} />}
      </details>

      <button className="primary wide start" onClick={() => onStart(plan ?? build(effective))}>Start</button>
    </main>
  )
}
