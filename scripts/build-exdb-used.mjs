// Writes content/media/exdb-used.json: the catalog entries referenced by content/exercises/*.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const content = join(import.meta.dirname, '..', 'content')
const read = (path) => JSON.parse(readFileSync(path, 'utf8'))
const dir = join(content, 'exercises')
const ids = new Set(readdirSync(dir).filter((f) => f.endsWith('.json'))
  .flatMap((f) => read(join(dir, f))).filter((e) => e.media?.kind === 'exdb').map((e) => e.media.exdbId))

const used = read(join(content, 'media', 'exdb-catalog.json')).filter((e) => ids.has(e.id)).sort((a, b) => (a.id < b.id ? -1 : 1))
const missing = [...ids].filter((id) => !used.some((e) => e.id === id))
if (missing.length) throw new Error(`not in catalog: ${missing.join(', ')}`)

writeFileSync(join(content, 'media', 'exdb-used.json'), JSON.stringify(used, null, 1) + '\n')
console.log(`wrote ${used.length} exercises to content/media/exdb-used.json`)
