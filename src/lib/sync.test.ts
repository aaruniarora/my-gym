import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fixturePlan } from './fixturePlan'
import type { SyncClient } from './sync'
import type { MilestoneResult, SessionRecord, SetLog } from './types'

type Table = Parameters<SyncClient['upsert']>[0]
type Row = Record<string, unknown>

const T0 = '2026-10-01T00:00:00.000Z'
const T1 = '2026-10-10T00:00:00.000Z'
const T2 = '2026-10-20T00:00:00.000Z'

class FakeClient implements SyncClient {
  tables: Record<Table, Map<string, Row>> = { settings: new Map(), progress: new Map(), sessions: new Map(), set_logs: new Map(), milestone_tests: new Map() }
  clock = T2
  failOn: Table | undefined
  async upsert(table: Table, rows: Row[]) {
    if (table === this.failOn) throw new Error(`upsert ${table} failed`)
    for (const r of rows) this.tables[table].set(String(table === 'settings' ? 'settings' : table === 'progress' ? r.key : r.id), { ...r, updated_at: this.clock })
  }
  async pullSince(table: Table, since: string | null) {
    return [...this.tables[table].values()].filter((r) => !since || (r.updated_at as string) > since)
  }
  userId = () => 'u1'
}

// db.ts caches its connection, so each test gets a fresh IndexedDB and fresh modules
let db: typeof import('./db')
let sync: typeof import('./sync')

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
  db = await import('./db')
  sync = await import('./sync')
})

const plan = { ...fixturePlan, id: 's1' }
const session = (updatedAt?: string, completed = false): SessionRecord => ({ plan, startedAt: T0, completed, updatedAt })
const log = (id: string, extra: Partial<SetLog> = {}): SetLog => ({ id, sessionId: 's1', exerciseId: 'dead-hang', setIndex: 0, repsLeft: 1, mode: 'normal', at: T0, ...extra })
const remoteSession = (updated_at: string, completed: boolean): Row => sync.toRow.sessions({ ...session(updated_at, completed) })

describe('sync', () => {
  it('saveSession queues one entry and push uploads it and empties the outbox', async () => {
    const client = new FakeClient()
    await db.saveSession(session())
    expect(await db.listOutbox()).toHaveLength(1)
    expect((await db.listOutbox())[0].table).toBe('sessions')
    await sync.push(client)
    expect(client.tables.sessions.get(plan.id)?.id).toBe(plan.id)
    expect(await db.listOutbox()).toHaveLength(0)
  })

  it('first sign-in uploads settings, progress, sessions and set logs', async () => {
    const client = new FakeClient()
    await db.putSettings({ ...(await db.getSettings()), weeklyTarget: 5 })
    await db.putProgress({ treeId: 'pull-up', stepIndex: 1, hits: 0, misses: 0 })
    await db.putProgress({ treeId: 'plank', side: 'left', stepIndex: 0, hits: 1, misses: 0 })
    await db.putSession(session())
    await db.putSetLog(log('a'))
    await db.putSetLog(log('b'))
    await sync.enqueueAll()
    await sync.push(client)
    expect(client.tables.settings.size).toBe(1)
    expect(client.tables.progress.size).toBe(2)
    expect(client.tables.sessions.size).toBe(1)
    expect(client.tables.set_logs.size).toBe(2)
  })

  it('last write wins: a newer remote row replaces the local one', async () => {
    const client = new FakeClient()
    await db.putSession(session(T1))
    client.tables.sessions.set(plan.id, remoteSession(T2, true))
    await sync.pull(client)
    expect((await db.listAllSessions())[0]).toMatchObject({ completed: true, updatedAt: T2 })
  })

  it('last write wins: an older remote row is ignored', async () => {
    const client = new FakeClient()
    await db.putSession(session(T1))
    client.tables.sessions.set(plan.id, remoteSession(T0, true))
    await sync.pull(client)
    expect((await db.listAllSessions())[0]).toMatchObject({ completed: false, updatedAt: T1 })
  })

  it('a remote deleted set log removes the local one', async () => {
    const client = new FakeClient()
    await db.putSetLog(log('a', { updatedAt: T0 }))
    client.tables.set_logs.set('a', { ...sync.toRow.set_logs(log('a')), updated_at: T2, deleted: true })
    await sync.pull(client)
    expect(await db.listAllSetLogs()).toHaveLength(0)
  })

  it('a queued local row is not overwritten by a newer remote one', async () => {
    const client = new FakeClient()
    const mine = session(T1)
    await db.putSession(mine)
    await db.enqueue('sessions', plan.id, mine)
    client.tables.sessions.set(plan.id, remoteSession(T2, true))
    await sync.pull(client)
    expect((await db.listAllSessions())[0]).toMatchObject({ completed: false, updatedAt: T1 })
    expect(await db.listOutbox()).toHaveLength(1)
  })

  it('lastPull advances to the newest remote updated_at and a second pull gets nothing', async () => {
    const client = new FakeClient()
    client.tables.set_logs.set('a', { ...sync.toRow.set_logs(log('a')), updated_at: T1 })
    client.tables.set_logs.set('b', { ...sync.toRow.set_logs(log('b')), updated_at: T2 })
    expect(await sync.pull(client)).toBe(2)
    expect(await db.getMeta('lastPull')).toBe(T2)
    expect(await sync.pull(client)).toBe(0)
  })

  it('a failed table keeps its outbox entries while the others are cleared', async () => {
    const client = new FakeClient()
    client.failOn = 'sessions'
    await db.saveSession(session())
    await db.saveSetLog(log('a'))
    await expect(sync.push(client)).rejects.toThrow('upsert sessions failed')
    expect((await db.listOutbox()).map((e) => e.table)).toEqual(['sessions'])
    expect(client.tables.set_logs.size).toBe(1)
  })

  it('saveTestResult then push upserts one milestone_tests row', async () => {
    const client = new FakeClient()
    const result: MilestoneResult = { id: 'm1', testId: 'pull-up-max', value: 7, week: 4, date: '2026-10-05' }
    await db.saveTestResult(result)
    await sync.push(client)
    expect(client.tables.milestone_tests.size).toBe(1)
    expect(client.tables.milestone_tests.get('m1')).toMatchObject({ test_id: 'pull-up-max', value: 7, week: 4, date: '2026-10-05' })
    expect(await db.listOutbox()).toHaveLength(0)
  })

  it('pull lands a remote milestone_tests row in listTestResults', async () => {
    const client = new FakeClient()
    client.tables.milestone_tests.set('m2', { ...sync.toRow.milestone_tests({ id: 'm2', testId: 'front-split-left', side: 'left', value: 15, week: 8, date: '2026-11-02' }), updated_at: T1 })
    await sync.pull(client)
    expect(await db.listTestResults()).toMatchObject([{ id: 'm2', testId: 'front-split-left', side: 'left', value: 15, week: 8, date: '2026-11-02', updatedAt: T1 }])
  })

  it('toRow and fromRow round-trip a set log, mapping undefined to null and back', () => {
    const l = log('a', { cmFromFloor: 40, bandIds: ['red', 'blue'], side: 'left', updatedAt: T1 })
    const row = sync.toRow.set_logs(l)
    expect(row).toMatchObject({ cm_from_floor: 40, band_ids: ['red', 'blue'], side: 'left', weight_kg: null })
    expect(sync.fromRow.set_logs(row)).toEqual({ ...l, weightKg: undefined, reps: undefined, seconds: undefined, setup: undefined, note: undefined })
  })
})
