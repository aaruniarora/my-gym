import { useEffect, useState } from 'react'
import { exerciseById } from '../content'
import { listSessions, listSetLogs } from '../lib/db'
import type { SessionRecord, SetLog, Settings } from '../lib/types'

const minutes = (a: string, b?: string) => (b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : 0)

export default function History({ settings }: { settings: Settings }) {
  const [sessions, setSessions] = useState<SessionRecord[]>([])
  const [open, setOpen] = useState<string>()
  const [logs, setLogs] = useState<SetLog[]>([])

  useEffect(() => {
    void listSessions('').then((s) => setSessions(s.sort((a, b) => b.startedAt.localeCompare(a.startedAt))))
  }, [])

  async function toggle(id: string) {
    if (open === id) return setOpen(undefined)
    setLogs((await listSetLogs(id)).sort((a, b) => a.at.localeCompare(b.at)))
    setOpen(id)
  }

  const detail = (l: SetLog) =>
    l.bandIds?.map((id) => settings.bands.find((b) => b.id === id)?.label ?? id).join(' + ') ??
    (l.weightKg !== undefined ? `${l.weightKg} kg` : l.setup)
  const byExercise: Record<string, SetLog[]> = {}
  for (const l of logs) if (l.side !== 'left') (byExercise[l.exerciseId] ??= []).push(l)
  // both sides of a set share exerciseId and timestamp
  const cmText = (l: SetLog) =>
    logs.filter((x) => x.exerciseId === l.exerciseId && x.at === l.at && x.cmFromFloor !== undefined)
      .sort((a, b) => (a.side ?? '').localeCompare(b.side ?? ''))
      .map((x) => `${x.side ? `${x.side} ` : ''}${x.cmFromFloor} cm`).join(' / ')

  return (
    <main>
      <h2>History</h2>
      {sessions.length === 0 && <p className="muted">No sessions yet.</p>}
      {sessions.map((s) => (
        <div key={s.plan.id} className="card">
          <button className="link" onClick={() => toggle(s.plan.id)}>
            {new Date(s.startedAt).toLocaleDateString()} · {s.plan.dayType.replace('_', ' ')} · {s.plan.mode} · {s.plan.location}
          </button>
          <p className="muted">
            {s.plan.minutesTarget} min planned, {minutes(s.startedAt, s.endedAt)} min actual · {s.completed ? 'completed' : 'aborted'}
          </p>
          {open === s.plan.id && Object.entries(byExercise).map(([id, list]) => (
            <p key={id}>
              {[exerciseById[id]?.name ?? id, detail(list[0]), list.map((l) => `${l.reps ?? `${l.seconds} s`} (${l.repsLeft === 3 ? 'Easy' : l.repsLeft === 0 ? 'Hard' : 'Good'})${cmText(l) && ` ${cmText(l)}`}`).join(', ')].filter(Boolean).join(' · ')}
            </p>
          ))}
        </div>
      ))}
    </main>
  )
}
