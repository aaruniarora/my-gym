import { useMemo, useState } from 'react'
import { pickDayType } from '../lib/builder'
import type { DayMode, NiggleArea, SessionPlan, SessionRecord, Settings } from '../lib/types'
import Preview from './Preview'

export type Draft = Settings['lastDraft']

type Props = { settings: Settings; recent: SessionRecord[]; onSettings: (s: Settings) => void; build: (d: Draft) => SessionPlan; onStart: (plan: SessionPlan) => void }

// mirrors niggleAreas in content/schema.ts; importing it would pull zod into the bundle
const AREAS: NiggleArea[] = ['wrist', 'shoulder', 'elbow', 'knee', 'lower_back']
const MODES: [DayMode, string][] = [['normal', 'Normal'], ['push', 'Push'], ['tired', 'Tired'], ['bare', 'Bare minimum']]
const DAY = 24 * 3600 * 1000

export default function Today({ settings, recent, onSettings, build, onStart }: Props) {
  const draft = settings.lastDraft
  const { minutes, location, mode } = draft
  const setDraft = (patch: Partial<Draft>) => onSettings({ ...settings, lastDraft: { ...draft, ...patch } })
  const [checkIn, setCheckIn] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const now = new Date()
  const bare = mode === 'bare'
  const effective = { minutes: bare ? 10 : Math.min(120, Math.max(10, minutes)), location, mode }
  // settings covers the draft, niggles and never-show, so the plan follows every input
  const plan = useMemo(() => (showPlan ? build(effective) : undefined), [showPlan, settings, recent])

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

      <h3>Minutes</h3>
      <input type="number" inputMode="numeric" min={10} max={120} disabled={bare} value={bare ? 10 : minutes}
        onChange={(e) => setDraft({ minutes: Number(e.target.value) })} onBlur={() => setDraft({ minutes: effective.minutes })} />
      <div className="row">
        {[10, 20, 30, 45, 60, 90].map((m) => (
          <button key={m} disabled={bare} className={!bare && minutes === m ? 'primary' : ''} onClick={() => setDraft({ minutes: m })}>{m}</button>
        ))}
      </div>

      <div className="row">
        {(['gym', 'home'] as const).map((l) => (
          <button key={l} className={location === l ? 'primary' : ''} onClick={() => setDraft({ location: l })}>{l === 'gym' ? 'Gym' : 'Home'}</button>
        ))}
      </div>
      <div className="row">
        {MODES.map(([m, label]) => <button key={m} className={mode === m ? 'primary' : ''} onClick={() => setDraft({ mode: m })}>{label}</button>)}
      </div>
      <p className="muted small">
        Next up: {pickDayType(recent, settings, now).replace('_', ' ')} · {recent.filter((s) => s.completed).length} of {settings.weeklyTarget} sessions in the last 7 days
      </p>

      <details open={checkIn} onToggle={(e) => setCheckIn(e.currentTarget.open)}>
        <summary>Check-in</summary>
        <div className="row">
          {AREAS.map((a) => {
            const n = settings.niggles.find((x) => x.area === a && !x.clearedAt)
            return <button key={a} className={n ? 'primary' : ''} onClick={() => toggleNiggle(a)}>{a.replace('_', ' ')}</button>
          })}
        </div>
        {settings.niggles.filter((n) => !n.clearedAt).map((n) => {
          const days = Math.floor((now.getTime() - Date.parse(n.startedAt)) / DAY)
          return <p key={n.area} className="muted">{n.area.replace('_', ' ')}: since {days} days{days > 14 && ' · over 14 days? consider a physio'}</p>
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
