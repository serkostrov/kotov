type PublicEnv = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

declare global {
  interface Window {
    __ENV__?: PublicEnv
  }
}

/** Runtime env (Dokploy) with Vite build-time fallback for local `npm run dev`. */
export function getPublicEnv(): Required<PublicEnv> {
  const runtime = typeof window !== 'undefined' ? window.__ENV__ : undefined
  return {
    VITE_SUPABASE_URL: runtime?.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: runtime?.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  }
}
