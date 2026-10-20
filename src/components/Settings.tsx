import { exerciseById } from '../content'
import { getProgress, listSessions, listSetLogs } from '../lib/db'
import type { Band, Settings } from '../lib/types'

type Props = { settings: Settings; onSettings: (s: Settings) => void; onPlacement: () => void }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export default function SettingsView({ settings, onSettings, onPlacement }: Props) {
  const set = (patch: Partial<Settings>) => onSettings({ ...settings, ...patch })
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

      <h3>Data</h3>
      <div className="row">
        <button onClick={exportData}>Export data</button>
        <button className="danger" onClick={reset}>Reset all local data</button>
      </div>
    </main>
  )
}
