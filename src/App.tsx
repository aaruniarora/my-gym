import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import History from './components/History'
import Placement from './components/Placement'
import SignIn from './components/SignIn'
import Player from './components/Player'
import SettingsView from './components/Settings'
import Summary from './components/Summary'
import Today, { type Draft } from './components/Today'
import { buildSession } from './lib/builder'
import { clearOutbox, deleteMeta, getMeta, getProgress, getSettings, listOutbox, listSessions, listSetLogs, saveProgress, saveSession, saveSetLog, saveSettings, setMeta } from './lib/db'
import { exerciseById } from './content'
import { afterSignIn, launchScreen } from './lib/launch'
import { canSync, supabase } from './lib/supabase'
import { supabaseSyncClient, sync } from './lib/sync'
import { applyPain, applySession, applyTooHard, withinAbility } from './lib/progression'
import type { SessionPlan, SessionRecord, SetLog, Settings, SkillProgress } from './lib/types'

type Screen = 'today' | 'player' | 'summary' | 'placement' | 'history' | 'settings' | 'signin'
export type Account = { email?: string; offline: boolean; lastSync?: string; failed: boolean }

const syncClient = supabase && supabaseSyncClient(supabase)

export default function App() {
  const [screen, setScreen] = useState<Screen>('today')
  const [settings, setSettings] = useState<Settings>()
  const [progress, setProgress] = useState<SkillProgress[]>([])
  const [recent, setRecent] = useState<SessionRecord[]>([])
  const [recentLogs, setRecentLogs] = useState<SetLog[]>([])
  const [plan, setPlan] = useState<SessionPlan>()
  const [summary, setSummary] = useState<{ record: SessionRecord; logs: SetLog[]; events: string[] }>()
  const [account, setAccount] = useState<Account>()
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  async function load() {
    // date part only so date-only and full ISO plan dates both compare correctly
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const sessions = await listSessions(since)
    setRecent(sessions)
    setRecentLogs((await Promise.all(sessions.map((s) => listSetLogs(s.plan.id)))).flat())
    setProgress(await getProgress())
    const s = await getSettings()
    setSettings(s)
    return s
  }

  async function loadAccount(failed = false) {
    setAccount({ email: await getMeta('userEmail'), offline: !!(await getMeta('offlineChoice')), lastSync: await getMeta('lastSync'), failed })
  }

  // background sync; does nothing offline-only or when signed out
  async function runSync() {
    if (!supabase || !syncClient || !(await supabase.auth.getSession()).data.session) return
    let failed = false
    try {
      if ((await sync(syncClient)).pulled) await load()
    } catch {
      failed = true
    }
    await loadAccount(failed)
  }

  async function start() {
    const s = await load()
    const hasSession = !!supabase && !!(await supabase.auth.getSession()).data.session
    setScreen(launchScreen({ canSync, hasSession, offlineChoice: !!(await getMeta('offlineChoice')), placed: s.placed }))
    await loadAccount()
    await runSync()
  }

  useEffect(() => {
    void start()
    const online = () => void runSync()
    window.addEventListener('online', online)
    return () => window.removeEventListener('online', online)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on start
  }, [])

  if (!settings || !account) return null

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
    void runSync()
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

  // SignIn has already stored userEmail and run enqueueAll; full push+pull before leaving
  async function signedIn() {
    let failed = false
    try {
      if (syncClient) await sync(syncClient)
    } catch {
      failed = true
    }
    const s = await load()
    await loadAccount(failed)
    setScreen(afterSignIn(s.placed))
  }

  async function offline() {
    await setMeta('offlineChoice', '1')
    await loadAccount()
    setScreen(settings?.placed ? 'today' : 'placement')
  }

  async function signOut() {
    await supabase?.auth.signOut()
    // local data stays; the next account starts with a clean queue and a full pull
    await clearOutbox(await listOutbox())
    await Promise.all(['lastPull', 'lastSync', 'userEmail'].map(deleteMeta))
    await setMeta('offlineChoice', '1')
    await loadAccount()
  }

  if (canSync && screen === 'signin')
    return <SignIn onSignedIn={signedIn} onOffline={offline} />
  if (!settings.placed || screen === 'placement')
    return <Placement settings={settings} progress={progress} onSave={place} onCancel={settings.placed ? () => setScreen('settings') : undefined} />
  if (screen === 'player' && plan)
    return <Player plan={plan} settings={settings} onFinish={finish} onAbort={() => setScreen('today')} onPain={pain} onTooHard={tooHard} canDo={(id) => withinAbility(id, progress, settings?.bests ?? {}, new Date())} />
  if (screen === 'summary' && summary)
    return <Summary {...summary} onDone={() => setScreen('today')} />

  return (
    <>
      {needRefresh && <button className="banner" onClick={() => void updateServiceWorker(true)}>New version ready — tap to update</button>}
      {screen === 'today' && <Today settings={settings} recent={recent} onSettings={updateSettings} build={build} onStart={(p) => { setPlan(p); setScreen('player') }} />}
      {screen === 'history' && <History settings={settings} />}
      {screen === 'settings' && <SettingsView settings={settings} onSettings={updateSettings} onPlacement={() => setScreen('placement')}
        account={account} onSignIn={() => setScreen('signin')} onSync={runSync} onSignOut={signOut} />}
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
