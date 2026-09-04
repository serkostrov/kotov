import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { AppRole, Tables } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type Profile = Tables<'profiles'>

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  roles: AppRole[]
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load(next: Session | null) {
      setSession(next)
      const user = next?.user ?? null
      if (!user) {
        setProfile(null)
        setRoles([])
        setLoading(false)
        return
      }

      const [{ data: profileRow }, { data: roleRows }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
      ])

      if (cancelled) return
      setProfile(profileRow ?? null)
      setRoles((roleRows ?? []).map((r) => r.role))
      setLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setLoading(true)
      void load(next)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      roles,
      loading,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, profile, roles, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth вне AuthProvider')
  return ctx
}
