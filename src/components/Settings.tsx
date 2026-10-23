import { exerciseById } from '../content'
import type { Account } from '../App'
import { getProgress, listSessions, listSetLogs } from '../lib/db'
import { canSync } from '../lib/supabase'
import { APP_VERSION } from '../lib/version'
import type { Band, GarminStatus, Settings } from '../lib/types'
import Info from './Info'
import { DEFAULT_EQUIPMENT, EQUIPMENT } from './labels'

type Props = {
  settings: Settings; onSettings: (s: Settings) => void; onPlacement: () => void
  account: Account; onSignIn: () => void; onSync: () => void; onSignOut: () => void; garminStatus?: GarminStatus
}

const FOCUS = [['strength', 'Strength'], ['mobility', 'Mobility'], ['flexibility', 'Flexibility']] as const
const WEEKDAYS = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']] as const
const clamp =(v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export default function SettingsView({ settings, onSettings, onPlacement, account, onSignIn, onSync, onSignOut, garminStatus }: Props) {
  const set = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch })
  const focus = { strength: true, mobility: true, flexibility: true, ...settings.focus }
  const ticked = Object.values(focus).filter(Boolean).length
  const testMode: NonNullable<Settings['testMode']> = settings.testMode ?? { mode: 'spread', weekday: 6 }
  const kit = settings.equipment ?? DEFAULT_EQUIPMENT
  const bands = [...settings.bands].sort((a, b) => a.order - b.order)
  const setBands = (list: Band[]) => set({ bands: list.map((b, i) => ({ ...b, order: i })) })
  const editBand = (i: number, patch: Partial<Band>) => setBands(bands.map((b, j) => (j === i ? { ...b, ...patch } : b)))
  const move = (i: number, d: number) => {
    const list = [...bands]
    ;[list[i], list[i + d]] = [list[i + d], list[i]]
    setBands(list)
  }

  async function exportData() {
    const sessions = await listSessions('')
    const setLogs = (await Promise.all(sessions.map((s) => listSetLogs(s.plan.id)))).flat()
    const blob = new Blob([JSON.stringify({ settings, sessions, setLogs, progress: await getProgress() }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `my-gym-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const g = garminStatus
  // the script writes lastError only on failure and lastOk only on success; lastAttempt dates the newest one
  const garminFailed = !!g?.lastError && (!g.lastOk || Date.parse(g.lastAttempt ?? '') > Date.parse(g.lastOk))

  function reset() {
    if (!confirm('Delete all local data? This cannot be undone.')) return
    // the delete waits for the open connection, which the reload closes
    indexedDB.deleteDatabase('my-gym')
    location.reload()
  }

  return (
    <main className="settings">
      <h2>Settings</h2>
      <label>Weekly target <input type="number" min={1} max={7} value={settings.weeklyTarget} onChange={(e) => set({ weeklyTarget: clamp(Number(e.target.value), 1, 7) })} /></label>
      <label>Countdown {settings.countdownSeconds} s <input type="range" min={5} max={20} value={settings.countdownSeconds} onChange={(e) => set({ countdownSeconds: Number(e.target.value) })} /></label>
      <label>Voice <input type="checkbox" checked={settings.voice} onChange={(e) => set({ voice: e.target.checked })} /></label>
      <label>Beeps <input type="checkbox" checked={settings.beeps} onChange={(e) => set({ beeps: e.target.checked })} /></label>
      <label>Voice rate {settings.voiceRate.toFixed(1)} <input type="range" min={0.8} max={1.4} step={0.1} value={settings.voiceRate} onChange={(e) => set({ voiceRate: Number(e.target.value) })} /></label>
      <label>Pause between sides <input type="checkbox" checked={settings.sidePause} onChange={(e) => set({ sidePause: e.target.checked })} /></label>
      <label>Headphone controls (experimental) <input type="checkbox" checked={settings.headphoneControls} onChange={(e) => set({ headphoneControls: e.target.checked })} /></label>
      <p className="muted">Play/pause = done or pause, next/previous track = skip/back; keeps a silent audio track playing</p>
      <button className="wide" onClick={onPlacement}>Where are you now?</button>

      <h3>Focus <Info text="Untick a part to leave it out of every session; at least one stays on." /></h3>
      {FOCUS.map(([key, label]) => (
        <label key={key}>{label} <input type="checkbox" checked={focus[key]}
          onChange={(e) => { if (e.target.checked || ticked > 1) set({ focus: { ...focus, [key]: e.target.checked } }) }} /></label>
      ))}
      {ticked === 1 && <p className="muted">Keep at least one</p>}

      <h3>How do you want to test? <Info text="Across the week: each session in a test week includes the 3–6 tests that fit its day, done fresh. One test day: the core tests in one 45–60 min session, least fatiguing first." /></h3>
      <label>Across the test week <input type="radio" name="testMode" checked={testMode.mode === 'spread'} onChange={() => set({ testMode: { ...testMode, mode: 'spread' } })} /></label>
      <label>On one test day <input type="radio" name="testMode" checked={testMode.mode === 'day'} onChange={() => set({ testMode: { ...testMode, mode: 'day' } })} /></label>
      {testMode.mode === 'day' && (
        <label>Test day <select value={testMode.weekday} onChange={(e) => set({ testMode: { ...testMode, weekday: Number(e.target.value) } })}>
          {WEEKDAYS.map(([d, label]) => <option key={d} value={d}>{label}</option>)}
        </select></label>
      )}

      <label>Track my menstrual cycle <Info text="Adds period and cramps to the check-in, learns your own pattern after 3 cycles, and avoids test days that are usually low. Off: nothing is asked or stored." />
        <input type="checkbox" checked={!!settings.cycleTracking} onChange={(e) => set({ cycleTracking: e.target.checked })} /></label>

      <h3>Equipment</h3>
      {(['gym', 'home'] as const).map((l) => (
        <fieldset key={l}>
          <legend>{l === 'gym' ? 'At the gym' : 'At home'}</legend>
          {EQUIPMENT.map(([e, label]) => (
            <label key={e}>{label} <input type="checkbox" checked={kit[l].includes(e)}
              onChange={(ev) => set({ equipment: { ...kit, [l]: ev.target.checked ? [...kit[l], e] : kit[l].filter((x) => x !== e) } })} /></label>
          ))}
        </fieldset>
      ))}

      <h3>Bands (lightest first)</h3>
      {bands.map((b, i) => (
        <div key={b.id} className="row">
          <input placeholder="Colour" value={b.colour} onChange={(e) => editBand(i, { colour: e.target.value })} />
          <input placeholder="Label" value={b.label} onChange={(e) => editBand(i, { label: e.target.value })} />
          <input type="number" inputMode="decimal" placeholder="kg" value={b.resistanceKg ?? ''}
            onChange={(e) => editBand(i, { resistanceKg: e.target.value === '' ? undefined : Number(e.target.value) })} />
          <button disabled={i === 0} onClick={() => move(i, -1)}>Up</button>
          <button disabled={i === bands.length - 1} onClick={() => move(i, 1)}>Down</button>
          <button onClick={() => setBands(bands.filter((x) => x.id !== b.id))}>Delete</button>
        </div>
      ))}
      <button onClick={() => setBands([...bands, { id: crypto.randomUUID(), colour: '', label: '', order: bands.length }])}>Add band</button>

      <h3>Never show</h3>
      {settings.neverShow.length === 0 && <p className="muted">Add from an exercise's technique card.</p>}
      {settings.neverShow.map((id) => (
        <div key={id} className="row">
          <span>{exerciseById[id]?.name ?? id}</span>
          <button onClick={() => set({ neverShow: settings.neverShow.filter((x) => x !== id) })}>Remove</button>
        </div>
      ))}

      <h3>Account</h3>
      {!canSync && <p className="muted">Sync not configured</p>}
      {canSync && !account.email && <button onClick={onSignIn}>Sign in</button>}
      {canSync && account.email && (
        <>
          <p className="muted">Signed in as {account.email} · {account.lastSync ? `Last synced ${new Date(account.lastSync).toLocaleString()}` : 'Not synced yet'}</p>
          {account.failed && <p className="muted">Sync failed</p>}
          <div className="row">
            <button onClick={onSync}>Sync now</button>
            <button onClick={onSignOut}>Sign out</button>
          </div>
        </>
      )}

      <h3>Garmin</h3>
      <p className="muted">Last sync: {g?.lastOk ? new Date(g.lastOk).toLocaleString() : 'never'}</p>
      {garminFailed && <p className="muted">Garmin sync failed: log manually</p>}
      <ol className="small muted">
        <li>Run <code>python scripts/garmin_login.py</code> once and copy the printed token.</li>
        <li>Add it as the GARMIN_TOKENS secret on GitHub, plus SUPABASE_EMAIL and SUPABASE_PASSWORD.</li>
        <li>Add the VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY repository variables.</li>
        <li>The Garmin sync action then runs daily. Full steps: Garmin section of supabase/README.md.</li>
      </ol>

      <h3>Data</h3>
      <div className="row">
        <button onClick={exportData}>Export data</button>
        <button className="danger" onClick={reset}>Reset all local data</button>
      </div>
      <p className="muted">Version {APP_VERSION}</p>
    </main>
  )
}
