import type { Settings } from './types'

let ctx: AudioContext | undefined

// iOS only allows audio after a user gesture, so call this from the Start tap
export function unlockAudio() {
  if (typeof AudioContext === 'undefined') return
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
}

function tone(freq: number, ms: number, delayMs = 0) {
  if (!ctx) return
  const start = ctx.currentTime + delayMs / 1000
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.3, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + ms / 1000)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + ms / 1000)
}

export function beep(kind: 'tick' | 'go' | 'switch' | 'done', settings: Settings) {
  if (!settings.beeps) return
  if (kind === 'tick') tone(880, 100)
  if (kind === 'go') tone(1320, 300)
  if (kind === 'switch') [0, 200].forEach((d) => tone(880, 100, d))
  if (kind === 'done') [1320, 1100, 880].forEach((f, i) => tone(f, 200, i * 250))
}

export function speak(text: string, settings: Settings) {
  if (!settings.voice || typeof speechSynthesis === 'undefined') return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.rate = settings.voiceRate
  speechSynthesis.speak(u)
}
