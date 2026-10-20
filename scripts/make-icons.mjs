// Writes the app icons as PNG + SVG with no dependencies: rounded square + "mg" made of rectangles.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [0x11, 0x11, 0x11]
const FG = [0x4a, 0x9d, 0xf5]
const RADIUS = 20 // on a 100-unit grid
// Glyph rectangles [x, y, w, h] on the 100-unit grid: "m" then "g"; kept within the central 80% for maskable.
const RECTS = [
  [18, 34, 6, 32], [18, 34, 28, 6], [30, 34, 5, 32], [41, 34, 5, 32],
  [54, 34, 28, 6], [54, 34, 6, 20], [76, 34, 6, 40], [54, 48, 28, 6], [54, 68, 28, 6],
]

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function pixel(u, v, rounded) {
  const inGlyph = RECTS.some(([x, y, w, h]) => u >= x && u < x + w && v >= y && v < y + h)
  if (inGlyph) return [...FG, 255]
  if (!rounded) return [...BG, 255]
  const cx = Math.min(Math.max(u, RADIUS), 100 - RADIUS)
  const cy = Math.min(Math.max(v, RADIUS), 100 - RADIUS)
  return (u - cx) ** 2 + (v - cy) ** 2 <= RADIUS ** 2 ? [...BG, 255] : [0, 0, 0, 0]
}

function png(size, rounded = true) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1) // first byte per row is filter type 0
    for (let x = 0; x < size; x++) {
      const p = pixel(((x + 0.5) * 100) / size, ((y + 0.5) * 100) / size, rounded)
      raw.set(p, row + 1 + x * 4)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr.set([8, 6, 0, 0, 0], 8) // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (c) => '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<rect width="100" height="100" rx="${RADIUS}" fill="${hex(BG)}"/>
${RECTS.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hex(FG)}"/>`).join('\n')}
</svg>
`

const dir = new URL('../public/icons/', import.meta.url)
mkdirSync(dir, { recursive: true })
writeFileSync(new URL('icon-192.png', dir), png(192))
writeFileSync(new URL('icon-512.png', dir), png(512, false)) // full-bleed for maskable
writeFileSync(new URL('apple-touch-icon.png', dir), png(180))
writeFileSync(new URL('icon.svg', dir), svg)
