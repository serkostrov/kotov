type PublicEnv = {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

/**
 * Placeholders replaced by docker/entrypoint.sh at container start.
 * Keep these exact literal strings — they are searched in the built JS.
 */
const RUNTIME_URL = '__KOTOV_SUPABASE_URL__'
const RUNTIME_KEY = '__KOTOV_SUPABASE_ANON_KEY__'

function resolved(runtime: string, fallback: string | undefined): string {
  if (runtime && !runtime.includes('__KOTOV_')) return runtime
  return fallback || ''
}

/** Dokploy runtime (entrypoint) with Vite `.env` fallback for local `npm run dev`. */
export function getPublicEnv(): Required<PublicEnv> {
  return {
    VITE_SUPABASE_URL: resolved(RUNTIME_URL, import.meta.env.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: resolved(RUNTIME_KEY, import.meta.env.VITE_SUPABASE_ANON_KEY),
  }
}
