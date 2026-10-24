import { useEffect, useState } from 'react'
import { exerciseById } from '../content'
import { listCheckins, listHealth, listSessions, listSetLogs } from '../lib/db'
import { countsAsTrained, dayStatus, localISO, mondayOf, monthGrid, periodDays, periodInfo, streakWeeks, weekCount } from '../lib/trained'
import type { Checkin, HealthDaily, SessionRecord, SetLog, Settings } from '../lib/types'

const minutes = (s: SessionRecord, logs: SetLog[]) => {
  const end = s.endedAt ?? logs[logs.length - 1]?.at
  return end ? Math.max(0, Math.round((Date.parse(end) - Date.parse(s.startedAt)) / 60000)) : 0
}
const statusText = { completed: 'Completed', partial: 'Partial', started: 'Started only', none: '' }
const dotClass = { completed: 'dot', partial: 'dot dot-partial', started: 'dot dot-started', none: '' }

export default function History({ settings }: { settings: Settings }) {
  const today = new Date()
  const todayISO = localISO(today)
  const [month, setMonth] = useState({ y: today.getFullYear(), m: today.getMonth() })
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [logsBySession, setLogsBySession] = useState<Record<string, SetLog[]>>({})
  const [open, setOpen] = useState<string>()
  const [day, setDay] = useState<string>()
  const [health, setHealth] = useState<HealthDaily[]>([])
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const tracking = !!settings.cycleTracking

  useEffect(() => {
    // plan.date is UTC, so reach one extra day back; 26 weeks keeps half-year streaks counted
    const since = new Date(Math.min(new Date(month.y, month.m, 1).getTime() - 86400000, Date.now() - 182 * 86400000)).toISOString().slice(0, 10)
    if (tracking) {
      void listHealth(since).then(setHealth)
      void listCheckins(since).then(setCheckins)
    }
    void listSessions(since).then(async (s) => {
      const logs = await Promise.all(s.map((x) => listSetLogs(x.plan.id)))
      setLogsBySession(Object.fromEntries(s.map((x, i) => [x.plan.id, logs[i].sort((a, b) => a.at.localeCompare(b.at))])))
      setSessions(s.sort((a, b) => b.startedAt.localeCompare(a.startedAt)))
    })
  }, [month, tracking])

  const shift = (n: number) => {
    setDay(undefined)
    setMonth(({ y, m }) => ({ y: new Date(y, m + n).getFullYear(), m: new Date(y, m + n).getMonth() }))
  }

  const band = (id: string) => {
    const b = settings.bands.find((x) => x.id === id)
    return b?.label || b?.colour || id
  }

  function sets(s: SessionRecord, logs: SetLog[]) {
    // Map keeps the order of each exercise's first log
    const byExercise = new Map<string, SetLog[]>()
    for (const l of logs) byExercise.set(l.exerciseId, [...(byExercise.get(l.exerciseId) ?? []), l])
    return [...byExercise].map(([id, list]) => (
      <div key={id} className="history-ex">
        <strong>{exerciseById[id]?.name ?? id}</strong>
        {s.painEvents?.includes(id) && <span className="history-flag"> Pain</span>}
        {s.tooHardEvents?.includes(id) && <span className="history-flag"> Too hard</span>}
        {list.map((l) => (
          <p key={l.id} className="small">
            {[
              `Set ${l.setIndex + 1}`,
              l.side && (l.side === 'left' ? 'L' : 'R'),
              l.reps !== undefined ? `${l.reps} reps` : l.seconds !== undefined && `${l.seconds} s`,
              l.weightKg !== undefined && `${l.weightKg} kg`,
              l.bandIds?.length && l.bandIds.map(band).join(' + '),
              l.setup,
              l.cmFromFloor !== undefined && `${l.cmFromFloor} cm from floor`,
              l.repsLeft === 3 ? 'Easy' : l.repsLeft === 0 ? 'Hard' : 'Good',
            ].filter(Boolean).join(' · ')}
          </p>
        ))}
      </div>
    ))
  }

  const period = tracking ? periodDays(health, checkins) : new Set<string>()
  const info = tracking && day ? periodInfo(day, health, checkins) : null
  const shown = day ? sessions.filter((s) => localISO(new Date(s.startedAt)) === day) : sessions

  return (
    <main>
      <h2>History</h2>
      <p>
        {weekCount(sessions, logsBySession, localISO(mondayOf(today)))} / {settings.weeklyTarget} this week · Streak: {streakWeeks(sessions, logsBySession, settings.weeklyTarget, today)} weeks
      </p>
      <div className="row">
        <button onClick={() => shift(-1)}>‹</button>
        <strong style={{ flex: 1, alignSelf: 'center', textAlign: 'center' }}>
          {new Date(month.y, month.m).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </strong>
        <button onClick={() => shift(1)}>›</button>
      </div>
      <div className="cal">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="muted small">{d}</span>)}
        {monthGrid(month.y, month.m).flat().map((d, i) => d ? (
          <button key={d} className={`cal-day${d === todayISO ? ' cal-today' : ''}${d === day ? ' active' : ''}${period.has(d) ? ' cal-period' : ''}`} onClick={() => setDay(day === d ? undefined : d)}>
            {period.has(d) && <span className="cal-period-mark" aria-label="Period">▒</span>}
            {Number(d.slice(8))}
            <span className={dotClass[dayStatus(sessions, logsBySession, d)]} />
          </button>
        ) : <span key={i} />)}
      </div>
      <p className="muted small">● trained  ○ started{tracking && '  ▒ period'}</p>
      {info && <p><strong>Period: {info.flow ?? '–'} · Cramps: {info.cramps ?? '–'}</strong></p>}
      {day && <button className="link" onClick={() => setDay(undefined)}>Show all sessions</button>}
      {shown.length === 0 && <p className="muted">{day ? 'No sessions this day.' : 'No sessions yet.'}</p>}
      {shown.map((s) => {
        const logs = logsBySession[s.plan.id] ?? []
        return (
          <div key={s.plan.id} className="card">
            <button className="link" onClick={() => setOpen(open === s.plan.id ? undefined : s.plan.id)}>
              {!day && `${new Date(s.startedAt).toLocaleDateString()} · `}{s.plan.dayType.replace('_', ' ')} · {minutes(s, logs)} min · {statusText[countsAsTrained(s, logs)]}
            </button>
            {(day || open === s.plan.id) && sets(s, logs)}
          </div>
        )
      })}
    </main>
  )
}
