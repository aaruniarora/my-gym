// Downloads the photo frames for content/media/exdb-used.json into public/media/exdb/ (skips existing files).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const SOURCE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'
const root = join(import.meta.dirname, '..')
const out = join(root, 'public', 'media', 'exdb')
const used = JSON.parse(readFileSync(join(root, 'content', 'media', 'exdb-used.json'), 'utf8'))
const queue = used.flatMap((e) => e.images.slice(0, 2)).filter((path) => !existsSync(join(out, path)))

let fetched = 0, bytes = 0, failed = 0
async function worker() {
  for (let path; (path = queue.shift()); ) {
    try {
      const res = await fetch(SOURCE + path)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = Buffer.from(await res.arrayBuffer())
      mkdirSync(dirname(join(out, path)), { recursive: true })
      writeFileSync(join(out, path), data)
      fetched++, bytes += data.length
    } catch (err) {
      failed++
      console.error(`failed ${path}: ${err.message}`)
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker))
console.log(`fetched ${fetched} files (${(bytes / 1024).toFixed(0)} kB), ${failed} failed`)
if (failed) process.exit(1)
