import { useEffect, useState } from 'react'
import History from './components/History'
import Placement from './components/Placement'
import Player from './components/Player'
import SettingsView from './components/Settings'
import Summary from './components/Summary'
import Today, { type Draft } from './components/Today'
import { buildSession } from './lib/builder'
import { getProgress, getSettings, listSessions, listSetLogs, saveProgress, saveSession, saveSetLog, saveSettings } from './lib/db'
import { exerciseById } from './content'
import { applyPain, applySession, applyTooHard, withinAbility } from './lib/progression'
import type { SessionPlan, SessionRecord, SetLog, Settings, SkillProgress } from './lib/types'

type Screen = 'today' | 'player' | 'summary' | 'placement' | 'history' | 'settings'

export default function App() {
  const [screen, setScreen] = useState<Screen>('today')
  const [settings, setSettings] = useState<Settings>()
  const [progress, setProgress] = useState<SkillProgress[]>([])
  const [recent, setRecent] = useState<SessionRecord[]>([])
  const [recentLogs, setRecentLogs] = useState<SetLog[]>([])
  const [plan, setPlan] = useState<SessionPlan>()
  const [summary, setSummary] = useState<{ record: SessionRecord; logs: SetLog[]; events: string[] }>()

  async function load() {
    // date part only so date-only and full ISO plan dates both compare correctly
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const sessions = await listSessions(since)
    setRecent(sessions)
    setRecentLogs((await Promise.all(sessions.map((s) => listSetLogs(s.plan.id)))).flat())
    setProgress(await getProgress())
    setSettings(await getSettings())
  }
  useEffect(() => { void load() }, [])

  if (!settings) return null

  const updateSettings = (s: Settings) => { setSettings(s); void saveSettings(s) }
  const build = (d: Draft) => buildSession({ ...d, now: new Date(), recent, recentLogs, progress, settings })

  async function finish(record: SessionRecord, logs: SetLog[]) {
    await saveSession(record)
    await Promise.all(logs.map(saveSetLog))
    let events: string[] = []
    if (record.completed && (record.plan.mode === 'normal' || record.plan.mode === 'push')) {
      const r = applySession(progress, record.plan, logs, new Date(), settings?.bests)
      await saveProgress(r.progress)
      events = r.events
    }
    if (record.tooHardEvents?.length) events.push(`Marked too hard: ${record.tooHardEvents.map((id) => exerciseById[id]?.name ?? id).join(', ')}`)
    await load()
    setSummary({ record, logs, events })
    setScreen(record.completed ? 'summary' : 'today')
  }

  async function place(p: SkillProgress[], s: Settings) {
    await saveProgress(p)
    await saveSettings(s)
    await load()
    setScreen('today')
  }

  function pain(treeId: string) {
    const p = applyPain(progress, treeId, new Date())
    setProgress(p)
    void saveProgress(p)
  }

  function tooHard(treeId: string) {
    const p = applyTooHard(progress, treeId, new Date())
    setProgress(p)
    void saveProgress(p)
  }

  if (!settings.placed || screen === 'placement')
    return <Placement settings={settings} progress={progress} onSave={place} onCancel={settings.placed ? () => setScreen('settings') : undefined} />
  if (screen === 'player' && plan)
    return <Player plan={plan} settings={settings} onFinish={finish} onAbort={() => setScreen('today')} onPain={pain} onTooHard={tooHard} canDo={(id) => withinAbility(id, progress, settings?.bests ?? {}, new Date())} />
  if (screen === 'summary' && summary)
    return <Summary {...summary} onDone={() => setScreen('today')} />

  return (
    <>
      {screen === 'today' && <Today settings={settings} recent={recent} onSettings={updateSettings} build={build} onStart={(p) => { setPlan(p); setScreen('player') }} />}
      {screen === 'history' && <History settings={settings} />}
      {screen === 'settings' && <SettingsView settings={settings} onSettings={updateSettings} onPlacement={() => setScreen('placement')} />}
      <nav className="bottom-nav">
        {(['today', 'history', 'settings'] as const).map((s) => (
          <button key={s} className={screen === s ? 'active' : ''} onClick={() => setScreen(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </nav>
    </>
  )
}
