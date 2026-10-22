import { useState } from 'react'
import { setMeta } from '../lib/db'
import { supabase } from '../lib/supabase'
import { enqueueAll } from '../lib/sync'

type Props = { onSignedIn: () => void; onOffline: () => void }

function friendly(msg: string) {
  if (msg.includes('Invalid login credentials')) return 'Wrong email or password'
  if (/signups not allowed|signups are disabled/i.test(msg)) return 'Sign-ups are closed'
  return msg
}

export default function SignIn({ onSignedIn, onOffline }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!supabase) return null
  const sb = supabase

  const submit = async () => {
    setBusy(true)
    setError('')
    try {
      const { data, error } = creating
        ? await sb.auth.signUp({ email, password })
        : await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (!data.session) {
        setError('Check your email to confirm, then sign in')
        setCreating(false)
      } else {
        await setMeta('userEmail', email)
        await enqueueAll()
        onSignedIn()
      }
    } catch (e) { setError(friendly(e instanceof Error ? e.message : String(e))) }
    setBusy(false)
  }

  return (
    <main>
      <h2>{creating ? 'Create account' : 'Sign in'}</h2>
      <p className="muted">Sign in to back up and sync your training.</p>
      <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value.trim())} />
      <input type="password" autoComplete={creating ? 'new-password' : 'current-password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button className="primary wide" disabled={busy || !email || !password} onClick={submit}>{creating ? 'Create account' : 'Sign in'}</button>
      <button className="wide" disabled={busy} onClick={() => { setCreating(!creating); setError('') }}>{creating ? 'Sign in instead' : 'Create account instead'}</button>
      {error && <p className="muted">{error}</p>}
      <button className="wide" disabled={busy} onClick={onOffline}>Use offline without an account</button>
    </main>
  )
}
