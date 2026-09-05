import {
  ClipboardList,
  Contact,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '@/components/logo'
import { AuthBackdrop } from '@/components/auth-backdrop'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-provider'
import { useOrganization } from '@/hooks/use-objects'
import { ROLE_LABELS } from '@/lib/dictionaries'
import { canSeeTools, isAccountant, isForeman, isOwner } from '@/lib/roles'
import { cn } from '@/lib/utils'

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean }

function navForRoles(roles: Parameters<typeof isOwner>[0]): NavItem[] {
  if (isOwner(roles)) {
    return [
      { to: '/', label: 'Дашборд', icon: LayoutDashboard, end: true },
      { to: '/objects', label: 'Объекты', icon: Warehouse },
      { to: '/contacts', label: 'Контакты', icon: Contact },
      { to: '/tools', label: 'Инструмент', icon: Wrench },
      { to: '/expenses', label: 'Расходы', icon: Receipt },
      { to: '/requests', label: 'Задачи', icon: ClipboardList },
      { to: '/settings', label: 'Настройки', icon: Settings },
    ]
  }
  if (isForeman(roles)) {
    return [
      { to: '/my', label: 'Мои объекты', icon: Warehouse },
      ...(canSeeTools(roles) ? [{ to: '/tools', label: 'Инструмент', icon: Wrench }] : []),
      { to: '/requests', label: 'Задачи', icon: ClipboardList },
    ]
  }
  if (isAccountant(roles)) {
    return [
      { to: '/objects', label: 'Объекты', icon: Warehouse },
      { to: '/expenses', label: 'Расходы', icon: Receipt },
    ]
  }
  return []
}

export function AppShell() {
  const { profile, roles, signOut, loading } = useAuth()
  const { data: org } = useOrganization()
  const items = navForRoles(roles)
  const [open, setOpen] = useState(false)
  const brandName = org?.name ?? 'Теплый контур'

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 z-40 hidden h-dvh w-[14.25rem] shrink-0 flex-col overflow-hidden text-sidebar-foreground lg:flex">
        <AuthBackdrop className="pointer-events-none absolute inset-0" />
        <div className="relative flex h-full flex-col">
          <Brand name={brandName} />
          <nav className="flex flex-1 flex-col gap-0.5 px-2.5 py-1">
            {items.map((item) => (
              <SideLink key={item.to} {...item} />
            ))}
          </nav>
          <UserBlock
            name={profile?.full_name ?? 'Пользователь'}
            roleLabel={roles.map((r) => ROLE_LABELS[r]).join(' · ')}
            onSignOut={() => void signOut()}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/70 bg-background/85 px-3 py-2 backdrop-blur-md lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Меню" className="shrink-0">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[15.5rem] overflow-hidden border-sidebar-border bg-transparent p-0 text-sidebar-foreground"
            >
              <AuthBackdrop className="pointer-events-none absolute inset-0" />
              <div className="relative flex h-full flex-col">
                <SheetHeader className="sr-only">
                  <SheetTitle>Меню</SheetTitle>
                </SheetHeader>
                <Brand name={brandName} />
                <nav className="flex flex-col gap-0.5 px-2.5 py-1">
                  {items.map((item) => (
                    <SideLink key={item.to} {...item} onClick={() => setOpen(false)} />
                  ))}
                </nav>
                <div className="mt-auto px-2.5 pb-4">
                  <UserBlock
                    name={profile?.full_name ?? 'Пользователь'}
                    roleLabel={roles.map((r) => ROLE_LABELS[r]).join(' · ')}
                    onSignOut={() => void signOut()}
                  />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Logo className="h-7 w-7 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-wide">ТЕПЛЫЙ КОНТУР</p>
              <p className="truncate text-[11px] text-muted-foreground">{brandName}</p>
            </div>
          </div>
        </header>

        <main className="animate-fade relative min-w-0 flex-1 px-3 py-3.5 pb-28 sm:px-4 sm:py-4 lg:px-5 lg:pb-5">
          {loading ? <Skeleton className="h-40 w-full rounded-xl" /> : <Outlet />}
        </main>
      </div>

      <MobileDock items={items} />
    </div>
  )
}

function Brand({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3.5 py-4">
      <Logo className="h-8 w-8 shrink-0 text-sidebar-primary" />
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold tracking-wide">ТЕПЛЫЙ КОНТУР</p>
        <p className="truncate text-[10px] leading-tight text-sidebar-foreground/50">{name}</p>
      </div>
    </div>
  )
}

function SideLink({
  to,
  label,
  icon: Icon,
  end,
  onClick,
}: NavItem & { onClick?: () => void }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_0_var(--sidebar-primary)]'
            : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span>{label}</span>
    </NavLink>
  )
}

function UserBlock({
  name,
  roleLabel,
  onSignOut,
}: {
  name: string
  roleLabel: string
  onSignOut: () => void
}) {
  return (
    <div className="mt-auto border-t border-sidebar-border/70 p-2.5">
      <div className="rounded-lg bg-sidebar-accent/35 px-2.5 py-2">
        <p className="truncate text-[13px] font-medium">{name}</p>
        <p className="truncate text-[10px] text-sidebar-foreground/50">{roleLabel || 'Роль не назначена'}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1.5 h-7 w-full justify-start px-1.5 text-[12px] text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={onSignOut}
        >
          <LogOut className="h-3.5 w-3.5" />
          Выйти
        </Button>
      </div>
    </div>
  )
}

function MobileDock({ items }: { items: NavItem[] }) {
  const location = useLocation()
  const navigate = useNavigate()
  const shown = items.slice(0, 5)
  if (shown.length === 0) return null

  return (
    <nav
      className="fixed inset-x-3 bottom-3 z-40 grid gap-1 rounded-2xl border border-border/80 bg-card/95 p-1.5 shadow-[0_8px_30px_-12px_oklch(0.3_0.03_250_/_0.35)] backdrop-blur-md lg:hidden"
      style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`, marginBottom: 'max(0px, env(safe-area-inset-bottom))' }}
    >
      {shown.map((item) => {
        const active = item.end
          ? location.pathname === item.to
          : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
        return (
          <button
            key={item.to}
            type="button"
            onClick={() => navigate(item.to)}
            className={cn(
              'flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-1 py-2 text-[10px] font-medium transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
            )}
          >
            <item.icon className={cn('h-5 w-5', active && 'stroke-[2.25]')} />
            <span className="truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
