import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'

export interface User {
  id: string
  email: string
  name: string
  createdAt: string
  onboardedAt: string | null
}

export type SignupMode = 'open' | 'invite' | 'closed'

export interface Session {
  authenticated: boolean
  user: User | null
  signup: SignupMode
  configured: boolean
}

export type AuthStatus = 'loading' | 'out' | 'in'

interface AuthValue {
  status: AuthStatus
  user: User | null
  session: Session | null
  signup: SignupMode
  login: (email: string, password: string) => Promise<User>
  signupWith: (input: { email: string; password: string; name?: string; inviteCode?: string }) => Promise<User>
  logout: () => Promise<void>
  update: (patch: { name?: string; onboarded?: true }) => Promise<User>
  refresh: () => Promise<void>
}

const SESSION_KEY = ['session'] as const

const Ctx = createContext<AuthValue | null>(null)

export function errorText(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string; error?: string }; status?: number }; message?: string }
  return e?.response?.data?.error || e?.response?.data?.message || (e?.response?.status ? fallback : e?.message || fallback)
}

/** Who is signed in, from one request the whole app shares. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const { data } = await axios.get('/api/auth/session')
      return data as Session
    },
    staleTime: 60_000,
    retry: false,
  })

  const setSession = useCallback(
    (user: User | null) => {
      qc.setQueryData<Session>(SESSION_KEY, (prev) => ({
        authenticated: Boolean(user),
        user,
        signup: prev?.signup ?? 'open',
        configured: prev?.configured ?? true,
      }))
    },
    [qc],
  )

  /** A new person means a new cache: nothing from the last session may show through. The session query itself stays mounted. */
  const resetData = useCallback(() => {
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== SESSION_KEY[0] })
  }, [qc])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await axios.post('/api/auth/login', { email, password })
      resetData()
      setSession(data.user as User)
      return data.user as User
    },
    [resetData, setSession],
  )

  const signupWith = useCallback(
    async (input: { email: string; password: string; name?: string; inviteCode?: string }) => {
      const { data } = await axios.post('/api/auth/signup', input)
      resetData()
      setSession(data.user as User)
      return data.user as User
    },
    [resetData, setSession],
  )

  const logout = useCallback(async () => {
    try {
      await axios.post('/api/auth/logout')
    } finally {
      setSession(null)
      resetData()
    }
  }, [resetData, setSession])

  const update = useCallback(
    async (patch: { name?: string; onboarded?: true }) => {
      const { data } = await axios.patch('/api/auth/me', patch)
      setSession(data.user as User)
      return data.user as User
    },
    [setSession],
  )

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: SESSION_KEY })
  }, [qc])

  const value = useMemo<AuthValue>(() => {
    const session = query.data ?? null
    const status: AuthStatus = query.isPending ? 'loading' : session?.authenticated && session.user ? 'in' : 'out'
    return {
      status,
      user: session?.user ?? null,
      session,
      signup: session?.signup ?? 'open',
      login,
      signupWith,
      logout,
      update,
      refresh,
    }
  }, [query.data, query.isPending, login, signupWith, logout, update, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth needs AuthProvider')
  return v
}

/** "AM" from "Alexandre Martinoli", "A" from "alex". */
export function initials(name?: string | null, email?: string | null): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[words.length - 1][0]).toUpperCase()
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase()
  return (email ?? '?').slice(0, 1).toUpperCase()
}
