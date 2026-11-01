import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  recovering: boolean // user arrived from a password-reset email
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'USER_UPDATED' || event === 'SIGNED_OUT') setRecovering(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase?.auth.signOut()
  }

  return <Ctx.Provider value={{ session, user: session?.user ?? null, loading, recovering, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth must be used inside AuthProvider')
  return v
}

export function displayName(user: User | null) {
  const m = user?.user_metadata ?? {}
  return (m.full_name as string) || (m.name as string) || user?.email?.split('@')[0] || 'Trader'
}

export function initials(user: User | null) {
  return displayName(user)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

/** Turns Supabase auth errors into plain instructions. */
export function authErrorMessage(message: string) {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'That email and password don’t match. Check both and try again.'
  if (m.includes('email not confirmed')) return 'Confirm your email first. We sent a link to your inbox when you signed up.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists. Log in instead.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts. Wait a minute, then try again.'
  if (m.includes('password should be') || m.includes('weak')) return 'Choose a stronger password: at least 8 characters with letters and numbers.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Can’t reach the login server. Check your connection.'
  return message
}
