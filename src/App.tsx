import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import History from './components/History'
import Placement from './components/Placement'
import SignIn from './components/SignIn'
import Player from './components/Player'
import ProgressView from './components/Progress'
import SettingsView from './components/Settings'
import Summary from './components/Summary'
import Today, { type Draft } from './components/Today'
import { available, buildSession, buildTestSession } from './lib/builder'
import { cycleDayOf, detectPattern, periodStarts, redFlag, symptomaticDays } from './lib/cycle'
import {
  clearOutbox, deleteMeta, getGarminStatus, getMeta, getProgress, getSettings, listActivities, listAllSetLogs, listCheckins, listHealth, listOutbox, listTestResults,
  listSessions, listSetLogs, saveActivity, saveCheckin, saveHealth, saveProgress, saveSession, saveSetLog, saveSettings, setMeta,
} from './lib/db'
import { exerciseById, tests } from './content'
import { afterSignIn, launchScreen } from './lib/launch'
import { canSync, supabase } from './lib/supabase'
import { supabaseSyncClient, sync } from './lib/sync'
import { applyTestResults, bestsFromLogs } from './lib/program'
import { applyPain, applySession, applyTooHard, requestCheck, withinAbility } from './lib/progression'
import { suggestMode } from './lib/readiness'
import { localISO } from './lib/trained'
import type { Activity, Checkin, DayMode, GarminStatus, HealthDaily, MilestoneResult, SessionPlan, SessionRecord, SetLog, Settings, SkillProgress } from './lib/types'

type Screen = 'today' | 'player' | 'summary' | 'placement' | 'history' | 'progress' | 'settings' | 'signin'
export type Account = { email?: string; offline: boolean; lastSync?: string; failed: boolean }
// health data derived for Today and the builder; cycle parts stay empty unless cycle tracking is on
type Health = {
  health: HealthDaily[]; checkins: Checkin[]; activities: Activity[]; logs: SetLog[]; garminStatus?: GarminStatus
  suggested: { mode: DayMode | null; reason: string } | null; redFlag: string | null; symptomaticDays: string[]; symptomaticWeekdays: number[]
}

const DAY_MS = 24 * 3600 * 1000
const daysAgo = (n: number) => localISO(new Date(Date.now() - n * DAY_MS))

const syncClient = supabase && supabaseSyncClient(supabase)

export default function App() {
  const [screen, setScreen] = useState<Screen>('today')
  const [settings, setSettings] = useState<Settings>()
  const [progress, setProgress] = useState<SkillProgress[]>([])
  const [recent, setRecent] = useState<SessionRecord[]>([])
  const [recentLogs, setRecentLogs] = useState<SetLog[]>([])
  const [results, setResults] = useState<MilestoneResult[]>([])
  const [plan, setPlan] = useState<SessionPlan>()
  const [summary, setSummary] = useState<{ record: SessionRecord; logs: SetLog[]; events: string[] }>()
  const [account, setAccount] = useState<Account>()
  const [hd, setHd] = useState<Health>({ health: [], checkins: [], activities: [], logs: [], suggested: null, redFlag: null, symptomaticDays: [], symptomaticWeekdays: [] })
  // milestone results from the running test session, applied to bests on finish
  const testResults = useRef<MilestoneResult[]>([])
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  async function load() {
    // date part only so date-only and full ISO plan dates both compare correctly
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    const sessions = await listSessions(since)
    setRecent(sessions)
    setRecentLogs((await Promise.all(sessions.map((s) => listSetLogs(s.plan.id)))).flat())
    setProgress(await getProgress())
    setResults(await listTestResults())
    const s = await getSettings()
    setSettings(s)
    await loadHealth(s)
    return s
  }

  async function loadHealth(s: Settings) {
    const [health, checkins, activities, garminStatus] = await Promise.all([listHealth(daysAgo(200)), listCheckins(daysAgo(200)), listActivities(daysAgo(7)), getGarminStatus()])
    const tracking = !!s.cycleTracking
    const logs = tracking ? await listAllSetLogs() : []
    const today = localISO(new Date())
    const starts = tracking ? periodStarts(health) : []
    const readiness = suggestMode({ checkin: checkins.find((c) => c.date === today), health: health.find((h) => h.date === today), settings: s })
    const pattern = tracking ? detectPattern(health, checkins, logs, starts) : null
    const day = cycleDayOf(today, starts)?.day
    const suggested = readiness.mode ? readiness : pattern && day && pattern.days.includes(day) ? { mode: 'tired' as const, reason: pattern.reason } : null
    // symptomatic cycle days projected onto the coming 7 days of the current cycle
    const sym = tracking ? symptomaticDays(health, checkins, logs, starts) : []
    const next = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * DAY_MS))
    const symDates = next.filter((d) => sym.includes(cycleDayOf(localISO(d), starts)?.day ?? 0))
    setHd({
      health, checkins, activities, logs, garminStatus, suggested, redFlag: tracking ? redFlag(starts, new Date()) : null,
      symptomaticDays: symDates.map(localISO), symptomaticWeekdays: [...new Set(symDates.map((d) => d.getDay()))],
    })
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
  const build = (d: Draft) => buildSession({ ...d, now: new Date(), recent, recentLogs, progress, settings, results, activities: hd.activities, symptomaticDays: hd.symptomaticDays })

  // period and cramps go to the day's health row as manual fields, keeping any Garmin values already there;
  // only when one of them changed, so a plain energy/sleep check-in never turns a Garmin row manual
  async function checkin(c: Checkin, activities: Activity[], manualHealth?: Partial<HealthDaily>) {
    await saveCheckin(c)
    await Promise.all(activities.map(saveActivity))
    const day = hd.health.find((h) => h.date === c.date)
    const changed = (['periodFlow', 'cramps'] as const).some((k) => manualHealth?.[k] !== undefined && manualHealth[k] !== day?.[k])
    if (changed) await saveHealth({ ...day, ...manualHealth, date: c.date, source: 'manual' })
    if (settings) await loadHealth(settings)
    void runSync()
  }

  async function finish(record: SessionRecord, logs: SetLog[]) {
    await saveSession(record)
    await Promise.all(logs.map(saveSetLog))
    // completed normal/push sessions raise bests from their logs, so gates can open mid-week
    const counts = record.completed && (record.plan.mode === 'normal' || record.plan.mode === 'push')
    const fromLogs = counts ? bestsFromLogs(settings?.bests ?? {}, logs) : settings?.bests ?? {}
    const bests = applyTestResults(fromLogs, testResults.current, tests)
    if (settings && JSON.stringify(bests) !== JSON.stringify(settings.bests)) await saveSettings({ ...settings, bests })
    testResults.current = []
    let events: string[] = []
    if (counts) {
      const r = applySession(progress, record.plan, logs, new Date(), bests)
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

  function check(treeId: string, side?: 'left' | 'right') {
    const p = requestCheck(progress, treeId, side)
    setProgress(p)
    void saveProgress(p).then(runSync)
  }

  function startTest() {
    if (!settings) return
    testResults.current = []
    setPlan(buildTestSession({ settings, progress, location: settings.lastDraft.location, now: new Date() }))
    setScreen('player')
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
    return <Placement settings={settings} progress={progress} onSave={place} onRequestCheck={check} onCancel={settings.placed ? () => setScreen('settings') : undefined} />
  if (screen === 'player' && plan)
    return <Player plan={plan} settings={settings} onFinish={finish} onAbort={() => setScreen('today')} onPain={pain} onTooHard={tooHard} onResults={(r) => { testResults.current = r }} canDo={(id) => withinAbility(id, progress, settings?.bests ?? {}, new Date())} canUse={(id) => available(exerciseById[id], settings, plan.location)} />
  if (screen === 'summary' && summary)
    return <Summary {...summary} onDone={() => setScreen('today')} />

  return (
    <>
      {needRefresh && <button className="banner" onClick={() => void updateServiceWorker(true)}>New version ready — tap to update</button>}
      {screen === 'today' && <Today settings={settings} progress={progress} recent={recent} onStartTest={startTest} onSettings={updateSettings} build={build} onStart={(p) => { setPlan(p); setScreen('player') }}
        suggested={hd.suggested} redFlag={hd.redFlag} symptomaticWeekdays={hd.symptomaticWeekdays} checkin={hd.checkins.find((c) => c.date === localISO(new Date()))}
        health={hd.health.find((h) => h.date === localISO(new Date()))} activities={hd.activities} onCheckin={checkin} />}
      {screen === 'history' && <History settings={settings} />}
      {screen === 'progress' && <ProgressView settings={settings} progress={progress} onRequestCheck={check} health={hd.health} checkins={hd.checkins} logs={hd.logs} />}
      {screen === 'settings' && <SettingsView settings={settings} onSettings={updateSettings} onPlacement={() => setScreen('placement')}
        account={account} onSignIn={() => setScreen('signin')} onSync={runSync} onSignOut={signOut} garminStatus={hd.garminStatus} />}
      <nav className="bottom-nav">
        {(['today', 'progress', 'history', 'settings'] as const).map((s) => (
          <button key={s} className={screen === s ? 'active' : ''} onClick={() => setScreen(s)}>
            {s[0].toUpperCase() + s.slice(1)}
          </button>
        ))}
      </nav>
    </>
  )
}
