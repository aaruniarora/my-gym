import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

// null when the build has no env, which keeps the app offline-only
export const supabase = url && key ? createClient(url, key) : null
export const canSync = supabase !== null
