let lock: WakeLockSentinel | undefined

export async function acquire() {
  try {
    lock = await navigator.wakeLock.request('screen')
  } catch {
    // unsupported or denied: the screen may sleep
  }
}

export async function release() {
  await lock?.release().catch(() => {})
  lock = undefined
}
