// Usage: node scripts/build-exdb-catalog.mjs <path to free-exercise-db exercises.json>
// The source is untrusted: parsed as data only, and only whitelisted fields are kept.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/build-exdb-catalog.mjs <exercises.json>')

const catalog = JSON.parse(readFileSync(source, 'utf8')).map((e) => ({
  id: String(e.id),
  name: String(e.name),
  equipment: e.equipment == null ? null : String(e.equipment),
  category: String(e.category),
  primaryMuscles: (e.primaryMuscles ?? []).map(String),
  images: (e.images ?? []).map(String),
}))

writeFileSync(join(import.meta.dirname, '..', 'content', 'media', 'exdb-catalog.json'), JSON.stringify(catalog, null, 1) + '\n')
console.log(`wrote ${catalog.length} exercises to content/media/exdb-catalog.json`)
