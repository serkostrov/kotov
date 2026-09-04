import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-provider'
import { homePath } from '@/lib/roles'
import type { AppRole } from '@/lib/database.types'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Skeleton className="h-24 w-full max-w-md" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function RequireRoles({ allow }: { allow: AppRole[] }) {
  const { roles, loading, profile } = useAuth()
  if (loading) return <Skeleton className="h-40 w-full" />
  if (!profile?.is_active || roles.length === 0) return <Navigate to="/no-access" replace />
  if (!allow.some((r) => roles.includes(r))) return <Navigate to={homePath(roles)} replace />
  return <Outlet />
}

export function GuestOnly() {
  const { user, roles, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Skeleton className="h-24 w-full max-w-md" />
      </div>
    )
  }
  if (user) return <Navigate to={homePath(roles)} replace />
  return <Outlet />
}
