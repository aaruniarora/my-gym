import type { SupabaseClient } from '@supabase/supabase-js'
import { clearOutbox, deleteLocal, enqueue, getMeta, getProgress, getSettings, listAllSessions, listAllSetLogs, listOutbox, listTestResults, progressKey, putProgress, putSession, putSetLog, putSettings, putTestResult, setMeta } from './db'
import type { MilestoneResult, Outbox, SessionRecord, SetLog, Settings, SkillProgress } from './types'

type Table = Outbox['table']
type Row = Record<string, unknown>

export interface SyncClient {
  upsert(table: Table, rows: Row[]): Promise<void>
  pullSince(table: Table, sinceISO: string | null): Promise<Row[]>
  userId(): string | null
}

const tables: Table[] = ['settings', 'progress', 'sessions', 'set_logs', 'milestone_tests']
const conflict: Record<Table, string> = { settings: 'user_id', progress: 'user_id,key', sessions: 'user_id,id', set_logs: 'user_id,id', milestone_tests: 'user_id,id' }
const PAGE = 1000

export function supabaseSyncClient(sb: SupabaseClient): SyncClient {
  let uid: string | null = null
  sb.auth.onAuthStateChange((_event, session) => { uid = session?.user.id ?? null })
  return {
    async upsert(table, rows) {
      const { error } = await sb.from(table).upsert(rows, { onConflict: conflict[table] })
      if (error) throw error
    },
    async pullSince(table, sinceISO) {
      const out: Row[] = []
      for (let from = 0; ; from += PAGE) {
        const base = sb.from(table).select('*')
        const { data, error } = await (sinceISO ? base.gt('updated_at', sinceISO) : base).order('updated_at').range(from, from + PAGE - 1)
        if (error) throw error
        out.push(...data)
        if (data.length < PAGE) return out
      }
    },
    userId: () => uid,
  }
}

// remote nulls become absent fields locally
const opt = <T,>(v: unknown) => (v ?? undefined) as T | undefined

export const toRow = {
  settings: (s: Settings): Row => ({ data: s, updated_at: s.updatedAt }),
  progress: (p: SkillProgress): Row => ({
    key: progressKey(p), tree_id: p.treeId, side: p.side ?? null, step_index: p.stepIndex, hits: p.hits, misses: p.misses,
    dropped_until: p.droppedUntil ?? null, check_pending: p.checkPending ?? false, updated_at: p.updatedAt,
  }),
  sessions: (r: SessionRecord): Row => ({
    id: r.plan.id, plan: r.plan, started_at: r.startedAt, ended_at: r.endedAt ?? null, completed: r.completed,
    pain_events: r.painEvents ?? null, too_hard_events: r.tooHardEvents ?? null, note: r.note ?? null, updated_at: r.updatedAt,
  }),
  set_logs: (l: SetLog): Row => ({
    id: l.id, session_id: l.sessionId, exercise_id: l.exerciseId, set_index: l.setIndex, reps: l.reps ?? null, seconds: l.seconds ?? null,
    side: l.side ?? null, reps_left: l.repsLeft, weight_kg: l.weightKg ?? null, band_ids: l.bandIds ?? null, setup: l.setup ?? null,
    cm_from_floor: l.cmFromFloor ?? null, note: l.note ?? null, mode: l.mode, at: l.at, updated_at: l.updatedAt,
  }),
  milestone_tests: (m: MilestoneResult): Row => ({ id: m.id, test_id: m.testId, side: m.side ?? null, value: m.value, week: m.week, date: m.date, updated_at: m.updatedAt }),
}

export const fromRow = {
  settings: (r: Row): Settings => ({ ...(r.data as Settings), updatedAt: r.updated_at as string }),
  progress: (r: Row): SkillProgress => ({
    treeId: r.tree_id as string, side: opt(r.side), stepIndex: r.step_index as number, hits: r.hits as number, misses: r.misses as number,
    droppedUntil: opt(r.dropped_until), ...(r.check_pending ? { checkPending: true } : {}), updatedAt: r.updated_at as string,
  }),
  sessions: (r: Row): SessionRecord => ({
    plan: r.plan as SessionRecord['plan'], startedAt: r.started_at as string, endedAt: opt(r.ended_at), completed: r.completed as boolean,
    painEvents: opt(r.pain_events), tooHardEvents: opt(r.too_hard_events), note: opt(r.note), updatedAt: r.updated_at as string,
  }),
  set_logs: (r: Row): SetLog => ({
    id: r.id as string, sessionId: r.session_id as string, exerciseId: r.exercise_id as string, setIndex: r.set_index as number,
    reps: opt(r.reps), seconds: opt(r.seconds), side: opt(r.side), repsLeft: r.reps_left as SetLog['repsLeft'], weightKg: opt(r.weight_kg),
    bandIds: opt(r.band_ids), setup: opt(r.setup), cmFromFloor: opt(r.cm_from_floor), note: opt(r.note), mode: r.mode as SetLog['mode'],
    at: r.at as string, updatedAt: r.updated_at as string,
  }),
  // numeric columns can come back as strings
  milestone_tests: (r: Row): MilestoneResult => ({
    id: r.id as string, testId: r.test_id as string, side: opt(r.side), value: Number(r.value), week: r.week as number, date: r.date as string, updatedAt: r.updated_at as string,
  }),
}

// tries every table; failed entries stay in the outbox and the first error is rethrown at the end
export async function push(client: SyncClient): Promise<number> {
  const entries = await listOutbox()
  let pushed = 0
  let failed: unknown
  for (const table of tables) {
    const batch = entries.filter((e) => e.table === table)
    if (!batch.length) continue
    try {
      await client.upsert(table, batch.map((e) => toRow[table](e.row as never)))
      await clearOutbox(batch)
      pushed += batch.length
    } catch (e) {
      failed ??= e
    }
  }
  if (failed) throw failed
  return pushed
}

async function localUpdatedAt(table: Table): Promise<Map<string, string | undefined>> {
  if (table === 'settings') return new Map([['settings', (await getSettings()).updatedAt]])
  if (table === 'progress') return new Map((await getProgress()).map((p) => [progressKey(p), p.updatedAt]))
  if (table === 'sessions') return new Map((await listAllSessions()).map((s) => [s.plan.id, s.updatedAt]))
  if (table === 'milestone_tests') return new Map((await listTestResults()).map((t) => [t.id, t.updatedAt]))
  return new Map((await listAllSetLogs()).map((l) => [l.id, l.updatedAt]))
}

const remoteKey = (table: Table, r: Row) => (table === 'settings' ? 'settings' : String(table === 'progress' ? r.key : r.id))
const store = { progress: 'progress', sessions: 'sessions', set_logs: 'setLogs', milestone_tests: 'tests' } as const

// last write wins on updated_at; remote deletes remove the local row
export async function pull(client: SyncClient): Promise<number> {
  const since = (await getMeta('lastPull')) ?? null
  let last = since
  let pulled = 0
  // queued local edits win; they get pushed on the next sync
  const queued = new Set((await listOutbox()).map((e) => e.id))
  for (const table of tables) {
    const rows = await client.pullSince(table, since)
    const local = await localUpdatedAt(table)
    for (const r of rows) {
      const at = r.updated_at as string
      if (!last || at > last) last = at
      const key = remoteKey(table, r)
      if (queued.has(`${table}:${key}`)) continue
      if (r.deleted && table !== 'settings') {
        if (!local.has(key)) continue
        await deleteLocal(store[table], key)
      } else {
        const mine = local.get(key)
        if (mine && Date.parse(at) <= Date.parse(mine)) continue
        if (table === 'settings') await putSettings(fromRow.settings(r))
        else if (table === 'progress') await putProgress(fromRow.progress(r))
        else if (table === 'sessions') await putSession(fromRow.sessions(r))
        else if (table === 'milestone_tests') await putTestResult(fromRow.milestone_tests(r))
        else await putSetLog(fromRow.set_logs(r))
      }
      pulled++
    }
  }
  if (last && last !== since) await setMeta('lastPull', last)
  return pulled
}

export async function sync(client: SyncClient): Promise<{ pushed: number; pulled: number }> {
  const pushed = await push(client)
  const pulled = await pull(client)
  await setMeta('lastSync', new Date().toISOString())
  return { pushed, pulled }
}

// first sign-in upload; keeps existing updatedAt so older local rows don't beat newer remote ones
export async function enqueueAll() {
  const at = new Date().toISOString()
  const stamp = <T extends { updatedAt?: string }>(x: T) => ({ ...x, updatedAt: x.updatedAt ?? at })
  await enqueue('settings', 'settings', stamp(await getSettings()))
  for (const p of await getProgress()) await enqueue('progress', progressKey(p), stamp(p))
  for (const s of await listAllSessions()) await enqueue('sessions', s.plan.id, stamp(s))
  for (const l of await listAllSetLogs()) await enqueue('set_logs', l.id, stamp(l))
  for (const t of await listTestResults()) await enqueue('milestone_tests', t.id, stamp(t))
}
