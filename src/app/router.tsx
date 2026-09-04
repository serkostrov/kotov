import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { ForgotPasswordPage, LoginPage, NoAccessPage } from '@/features/auth/login-page'
import { GuestOnly, RequireAuth, RequireRoles } from '@/features/auth/guards'
import { useAuth } from '@/features/auth/auth-provider'
import { DashboardPage } from '@/features/dashboard/dashboard-page'
import { ExpensesPage } from '@/features/expenses/expenses-page'
import { MyObjectPage, MyObjectsPage } from '@/features/my/my-page'
import { ObjectCardPage } from '@/features/objects/object-card-page'
import { ObjectsPage } from '@/features/objects/objects-page'
import { StagePage } from '@/features/objects/stage-page'
import { RequestsPage } from '@/features/requests/requests-page'
import { SettingsPage } from '@/features/settings/settings-page'
import { ToolCardPage, ToolsPage } from '@/features/tools/tools-page'
import { homePath } from '@/lib/roles'

function HomeRedirect() {
  const { user, roles, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homePath(roles)} replace />
}

export function AppRouter() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/no-access" element={<NoAccessPage />} />
        <Route element={<AppShell />}>
          <Route element={<RequireRoles allow={['owner']} />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route element={<RequireRoles allow={['owner', 'prod_foreman', 'install_foreman', 'accountant']} />}>
            <Route path="/objects" element={<ObjectsPage />} />
            <Route path="/objects/:id" element={<ObjectCardPage />} />
            <Route path="/objects/:id/stages/:stageId" element={<StagePage />} />
          </Route>
          <Route element={<RequireRoles allow={['prod_foreman', 'install_foreman', 'owner']} />}>
            <Route path="/my" element={<MyObjectsPage />} />
            <Route path="/my/:id" element={<MyObjectPage />} />
            <Route path="/tools" element={<ToolsPage />} />
            <Route path="/tools/:id" element={<ToolCardPage />} />
          </Route>
          <Route element={<RequireRoles allow={['owner', 'accountant', 'prod_foreman', 'install_foreman']} />}>
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/requests" element={<RequestsPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  )
}
