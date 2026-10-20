type Handlers = { toggle: () => void; next: () => void; previous: () => void }

// 0.1 s of 8 kHz 8-bit mono silence
const SILENT_WAV = (() => {
  const n = 800
  const bytes = new Uint8Array(44 + n)
  const v = new DataView(bytes.buffer)
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true)
  str(36, 'data'); v.setUint32(40, n, true)
  bytes.fill(128, 44)
  return 'data:audio/wav;base64,' + btoa(String.fromCharCode(...bytes))
})()

let audio: HTMLAudioElement | undefined

// call from a user gesture; iOS only routes headphone buttons to a page that is playing audio
export function startMediaSession(handlers: Handlers, title: string) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  audio ??= new Audio(SILENT_WAV)
  audio.loop = true
  audio.volume = 0.01
  void audio.play().catch(() => {})
  setMediaTitle(title)
  const ms = navigator.mediaSession
  ms.setActionHandler('play', handlers.toggle)
  ms.setActionHandler('pause', handlers.toggle)
  ms.setActionHandler('nexttrack', handlers.next)
  ms.setActionHandler('previoustrack', handlers.previous)
}

export function setMediaTitle(title: string) {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
  navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'my-gym' })
}

export function stopMediaSession() {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return
  audio?.pause()
  audio = undefined
  for (const a of ['play', 'pause', 'nexttrack', 'previoustrack'] as const) navigator.mediaSession.setActionHandler(a, null)
  navigator.mediaSession.metadata = null
}
