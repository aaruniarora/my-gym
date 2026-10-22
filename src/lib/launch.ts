export function launchScreen(s: { canSync: boolean; hasSession: boolean; offlineChoice: boolean; placed: boolean }): 'signin' | 'placement' | 'today' {
  if (s.canSync && !s.hasSession && !s.offlineChoice) return 'signin'
  return s.placed ? 'today' : 'placement'
}

export function afterSignIn(placed: boolean): 'placement' | 'today' {
  return placed ? 'today' : 'placement'
}
