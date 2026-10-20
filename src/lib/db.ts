import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { SessionRecord, SetLog, Settings, SkillProgress } from './types'

interface MyGymDB extends DBSchema {
  settings: { key: string; value: Settings }
  sessions: { key: string; value: SessionRecord; indexes: { date: string } }
  setLogs: { key: string; value: SetLog; indexes: { sessionId: string; exerciseId: string } }
  progress: { key: string; value: SkillProgress & { key: string } }
}

const defaultSettings: Settings = {
  weeklyTarget: 4,
  countdownSeconds: 10,
  voice: true,
  beeps: true,
  voiceRate: 1,
  sidePause: true,
  bands: [],
  neverShow: [],
  favourites: [],
  niggles: [],
  bests: {},
  headphoneControls: false,
  lastDraft: { minutes: 30, location: 'gym', mode: 'normal' },
  placed: false,
}

const progressKey = (p: SkillProgress) => (p.side ? `${p.treeId}:${p.side}` : p.treeId)

let dbPromise: Promise<IDBPDatabase<MyGymDB>> | undefined
// opened lazily so importing this module never touches indexedDB
const db = () => (dbPromise ??= openDB<MyGymDB>('my-gym', 2, {
  async upgrade(d, oldVersion, _newVersion, tx) {
    if (oldVersion < 1) {
      d.createObjectStore('settings')
      d.createObjectStore('sessions', { keyPath: 'plan.id' }).createIndex('date', 'plan.date')
      const logs = d.createObjectStore('setLogs', { keyPath: 'id' })
      logs.createIndex('sessionId', 'sessionId')
      logs.createIndex('exerciseId', 'exerciseId')
    }
    // v2: progress is keyed by tree and side; v1 entries (keyed by treeId) are copied across
    const old = oldVersion >= 1 ? await tx.objectStore('progress').getAll() : []
    if (oldVersion >= 1) d.deleteObjectStore('progress')
    const store = d.createObjectStore('progress', { keyPath: 'key' })
    await Promise.all(old.map((p) => store.put({ ...p, key: progressKey(p) })))
  },
}))

export async function getSettings(): Promise<Settings> {
  return { ...defaultSettings, ...(await (await db()).get('settings', 'settings')) }
}

export async function saveSettings(settings: Settings) {
  await (await db()).put('settings', settings, 'settings')
}

export async function listSessions(sinceISO: string): Promise<SessionRecord[]> {
  return (await db()).getAllFromIndex('sessions', 'date', IDBKeyRange.lowerBound(sinceISO))
}

export async function saveSession(record: SessionRecord) {
  await (await db()).put('sessions', record)
}

export async function listSetLogs(sessionId: string): Promise<SetLog[]> {
  return (await db()).getAllFromIndex('setLogs', 'sessionId', sessionId)
}

export async function lastSetLog(exerciseId: string, side?: 'left' | 'right', withCm?: boolean): Promise<SetLog | undefined> {
  const logs = (await (await db()).getAllFromIndex('setLogs', 'exerciseId', exerciseId)).filter((l) => (!side || l.side === side) && (!withCm || l.cmFromFloor !== undefined))
  return logs.sort((a, b) => a.at.localeCompare(b.at)).at(-1)
}

export async function saveSetLog(log: SetLog) {
  await (await db()).put('setLogs', log)
}

export async function getProgress(): Promise<SkillProgress[]> {
  return (await db()).getAll('progress').then((all) => all.map(({ key: _, ...p }) => p))
}

export async function saveProgress(progress: SkillProgress[]) {
  const tx = (await db()).transaction('progress', 'readwrite')
  await Promise.all([...progress.map((p) => tx.store.put({ ...p, key: progressKey(p) })), tx.done])
}
