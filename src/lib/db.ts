import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Activity, Checkin, DayMode, GarminStatus, HealthDaily, MilestoneResult, Outbox, SessionRecord, SetLog, Settings, SkillProgress } from './types'

interface MyGymDB extends DBSchema {
  settings: { key: string; value: Settings }
  sessions: { key: string; value: SessionRecord; indexes: { date: string } }
  setLogs: { key: string; value: SetLog; indexes: { sessionId: string; exerciseId: string } }
  progress: { key: string; value: SkillProgress & { key: string } }
  outbox: { key: string; value: Outbox; indexes: { table: string } }
  meta: { key: string; value: string }
  tests: { key: string; value: MilestoneResult; indexes: { testId: string } }
  health: { key: string; value: HealthDaily }
  checkins: { key: string; value: Checkin }
  activities: { key: string; value: Activity; indexes: { date: string } }
  garminStatus: { key: string; value: GarminStatus }
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
  focus: { strength: true, mobility: true, flexibility: true },
  equipment: {
    gym: ['pull_up_bar', 'dip_station', 'trx', 'band', 'dumbbell', 'kettlebell', 'box', 'bench', 'jump_rope', 'slam_ball', 'wall', 'floor', 'door_anchor'],
    home: ['band', 'door_anchor', 'box', 'wall', 'floor'],
  },
  testMode: { mode: 'spread', weekday: 6 },
  cycleTracking: false,
}

// 'bare' was a fourth day mode; rows stored with it read as 'tired'
const unbare = <T extends { mode: DayMode }>(x: T): T => ((x.mode as string) === 'bare' ? { ...x, mode: 'tired' } : x)

export const progressKey = (p: SkillProgress) => (p.side ? `${p.treeId}:${p.side}` : p.treeId)

let dbPromise: Promise<IDBPDatabase<MyGymDB>> | undefined
// opened lazily so importing this module never touches indexedDB
const db = () => (dbPromise ??= openDB<MyGymDB>('my-gym', 5, {
  async upgrade(d, oldVersion, _newVersion, tx) {
    if (oldVersion < 1) {
      d.createObjectStore('settings')
      d.createObjectStore('sessions', { keyPath: 'plan.id' }).createIndex('date', 'plan.date')
      const logs = d.createObjectStore('setLogs', { keyPath: 'id' })
      logs.createIndex('sessionId', 'sessionId')
      logs.createIndex('exerciseId', 'exerciseId')
    }
    if (oldVersion < 2) {
      // v2: progress is keyed by tree and side; v1 entries (keyed by treeId) are copied across
      const old = oldVersion >= 1 ? await tx.objectStore('progress').getAll() : []
      if (oldVersion >= 1) d.deleteObjectStore('progress')
      const store = d.createObjectStore('progress', { keyPath: 'key' })
      await Promise.all(old.map((p) => store.put({ ...p, key: progressKey(p) })))
    }
    if (oldVersion < 3) {
      d.createObjectStore('outbox', { keyPath: 'id' }).createIndex('table', 'table')
      d.createObjectStore('meta')
    }
    if (oldVersion < 4) d.createObjectStore('tests', { keyPath: 'id' }).createIndex('testId', 'testId')
    if (oldVersion < 5) {
      d.createObjectStore('health', { keyPath: 'date' })
      d.createObjectStore('checkins', { keyPath: 'date' })
      d.createObjectStore('activities', { keyPath: 'id' }).createIndex('date', 'date')
      d.createObjectStore('garminStatus')
    }
  },
}))

const now = () => new Date().toISOString()
const outboxEntry = (table: Outbox['table'], key: string, row: unknown): Outbox => ({ id: `${table}:${key}`, table, row, at: now() })

export async function enqueue(table: Outbox['table'], key: string, row: unknown) {
  await (await db()).put('outbox', outboxEntry(table, key, row))
}

export async function listOutbox(): Promise<Outbox[]> {
  return (await db()).getAll('outbox')
}

// skips entries overwritten by a newer save since they were read
export async function clearOutbox(entries: Outbox[]) {
  const tx = (await db()).transaction('outbox', 'readwrite')
  await Promise.all([...entries.map(async (e) => { if ((await tx.store.get(e.id))?.at === e.at) await tx.store.delete(e.id) }), tx.done])
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await db()).get('meta', key)
}

export async function setMeta(key: string, value: string) {
  await (await db()).put('meta', value, key)
}

export async function deleteMeta(key: string) {
  await (await db()).delete('meta', key)
}

export async function getSettings(): Promise<Settings> {
  const s = { ...defaultSettings, ...(await (await db()).get('settings', 'settings')) }
  return { ...s, lastDraft: unbare(s.lastDraft) }
}

export async function saveSettings(settings: Settings) {
  const s = { ...settings, updatedAt: now() }
  const tx = (await db()).transaction(['settings', 'outbox'], 'readwrite')
  await Promise.all([tx.objectStore('settings').put(s, 'settings'), tx.objectStore('outbox').put(outboxEntry('settings', 'settings', s)), tx.done])
}

export async function putSettings(settings: Settings) {
  await (await db()).put('settings', settings, 'settings')
}

export async function listSessions(sinceISO: string): Promise<SessionRecord[]> {
  return (await (await db()).getAllFromIndex('sessions', 'date', IDBKeyRange.lowerBound(sinceISO))).map((r) => ({ ...r, plan: unbare(r.plan) }))
}

export async function listAllSessions(): Promise<SessionRecord[]> {
  return (await (await db()).getAll('sessions')).map((r) => ({ ...r, plan: unbare(r.plan) }))
}

export async function saveSession(record: SessionRecord) {
  const r = { ...record, updatedAt: now() }
  const tx = (await db()).transaction(['sessions', 'outbox'], 'readwrite')
  await Promise.all([tx.objectStore('sessions').put(r), tx.objectStore('outbox').put(outboxEntry('sessions', r.plan.id, r)), tx.done])
}

export async function putSession(record: SessionRecord) {
  await (await db()).put('sessions', record)
}

export async function listSetLogs(sessionId: string): Promise<SetLog[]> {
  return (await (await db()).getAllFromIndex('setLogs', 'sessionId', sessionId)).map(unbare)
}

export async function listAllSetLogs(): Promise<SetLog[]> {
  return (await (await db()).getAll('setLogs')).map(unbare)
}

export async function lastSetLog(exerciseId: string, side?: 'left' | 'right', withCm?: boolean): Promise<SetLog | undefined> {
  const logs = (await (await db()).getAllFromIndex('setLogs', 'exerciseId', exerciseId)).filter((l) => (!side || l.side === side) && (!withCm || l.cmFromFloor !== undefined))
  const last = logs.sort((a, b) => a.at.localeCompare(b.at)).at(-1)
  return last && unbare(last)
}

export async function saveSetLog(log: SetLog) {
  const l = { ...log, updatedAt: now() }
  const tx = (await db()).transaction(['setLogs', 'outbox'], 'readwrite')
  await Promise.all([tx.objectStore('setLogs').put(l), tx.objectStore('outbox').put(outboxEntry('set_logs', l.id, l)), tx.done])
}

export async function putSetLog(log: SetLog) {
  await (await db()).put('setLogs', log)
}

export async function getProgress(): Promise<SkillProgress[]> {
  return (await db()).getAll('progress').then((all) => all.map(({ key: _, ...p }) => p))
}

export async function saveProgress(progress: SkillProgress[]) {
  const at = now()
  const tx = (await db()).transaction(['progress', 'outbox'], 'readwrite')
  await Promise.all([
    ...progress.flatMap((p) => {
      const row = { ...p, updatedAt: at }
      return [tx.objectStore('progress').put({ ...row, key: progressKey(p) }), tx.objectStore('outbox').put(outboxEntry('progress', progressKey(p), row))]
    }),
    tx.done,
  ])
}

export async function putProgress(p: SkillProgress) {
  await (await db()).put('progress', { ...p, key: progressKey(p) })
}

export async function listTestResults(): Promise<MilestoneResult[]> {
  return (await db()).getAll('tests')
}

export async function saveTestResult(result: MilestoneResult) {
  const r = { ...result, updatedAt: now() }
  const tx = (await db()).transaction(['tests', 'outbox'], 'readwrite')
  await Promise.all([tx.objectStore('tests').put(r), tx.objectStore('outbox').put(outboxEntry('milestone_tests', r.id, r)), tx.done])
}

export async function putTestResult(result: MilestoneResult) {
  await (await db()).put('tests', result)
}

export async function listHealth(sinceISO: string): Promise<HealthDaily[]> {
  return (await db()).getAll('health', IDBKeyRange.lowerBound(sinceISO))
}

export async function saveHealth(health: HealthDaily) {
  const h = { ...health, updatedAt: now() }
  const tx = (await db()).transaction(['health', 'outbox'], 'readwrite')
  await Promise.all([tx.objectStore('health').put(h), tx.objectStore('outbox').put(outboxEntry('health_daily', h.date, h)), tx.done])
}

export async function putHealth(health: HealthDaily) {
  await (await db()).put('health', health)
}

export async function getCheckin(date: string): Promise<Checkin | undefined> {
  return (await db()).get('checkins', date)
}

export async function listCheckins(sinceISO: string): Promise<Checkin[]> {
  return (await db()).getAll('checkins', IDBKeyRange.lowerBound(sinceISO))
}

export async function saveCheckin(checkin: Checkin) {
  const c = { ...checkin, updatedAt: now() }
  const tx = (await db()).transaction(['checkins', 'outbox'], 'readwrite')
  await Promise.all([tx.objectStore('checkins').put(c), tx.objectStore('outbox').put(outboxEntry('checkins', c.date, c)), tx.done])
}

export async function putCheckin(checkin: Checkin) {
  await (await db()).put('checkins', checkin)
}

export async function listActivities(sinceISO: string): Promise<Activity[]> {
  return (await db()).getAllFromIndex('activities', 'date', IDBKeyRange.lowerBound(sinceISO))
}

export async function saveActivity(activity: Activity) {
  const a = { ...activity, updatedAt: now() }
  const tx = (await db()).transaction(['activities', 'outbox'], 'readwrite')
  await Promise.all([tx.objectStore('activities').put(a), tx.objectStore('outbox').put(outboxEntry('activities', a.id, a)), tx.done])
}

export async function putActivity(activity: Activity) {
  await (await db()).put('activities', activity)
}

// written by the Garmin Action; pulled only
export async function getGarminStatus(): Promise<GarminStatus | undefined> {
  return (await db()).get('garminStatus', 'garmin')
}

export async function putGarminStatus(status: GarminStatus) {
  await (await db()).put('garminStatus', status, 'garmin')
}

// used by pull for rows deleted remotely
export async function deleteLocal(store: 'progress' | 'sessions' | 'setLogs' | 'tests' | 'health' | 'checkins' | 'activities', key: string) {
  await (await db()).delete(store, key)
}
