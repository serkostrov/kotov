import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Building2, Package, Receipt, TrendingUp, Wrench } from 'lucide-react'
import { DualProgress } from '@/components/dual-progress'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { ProfitLine } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { ObjectStatusBadge, RequestStatusBadge, ToolStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-provider'
import { useDashboard } from '@/hooks/use-dashboard'
import { useRequestMutations } from '@/hooks/use-finance'
import { humanizeError } from '@/lib/errors'
import { daysOverdue, formatDate, formatMoney } from '@/lib/format'
import { canSeeEconomics } from '@/lib/roles'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { roles } = useAuth()
  const { data, isLoading, isError, error, refetch } = useDashboard()
  const requests = useRequestMutations()
  const showEco = canSeeEconomics(roles)

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-56" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    )
  }

  if (isError) return <ErrorState message={humanizeError(error)} onRetry={() => void refetch()} />
  if (!data) return null

  const kpis = [
    { label: 'Активных объектов', value: String(data.kpi.activeObjects), icon: Building2, warn: false },
    {
      label: 'Этапов с просрочкой',
      value: String(data.kpi.overdueStages),
      icon: AlertTriangle,
      warn: data.kpi.overdueStages > 0,
    },
    { label: 'Инструмента на объектах', value: String(data.kpi.toolsOnObjects), icon: Package, warn: false },
    {
      label: 'Ремонт / утеря',
      value: String(data.kpi.toolsAttention),
      icon: Wrench,
      warn: data.kpi.toolsAttention > 0,
    },
    { label: 'Расходы за месяц', value: formatMoney(data.kpi.monthExpenses), icon: Receipt, warn: false },
    {
      label: 'Прибыль по активным',
      value: showEco ? formatMoney(data.kpi.activeProfit) : '—',
      icon: TrendingUp,
      warn: false,
    },
  ]

  return (
    <div>
      <PageHeader title="Дашборд" description="Сводка по объектам, просрочкам, заявкам и инструменту" />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi, index) => (
          <Card
            key={kpi.label}
            className="animate-rise overflow-hidden"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            <CardContent className="relative flex items-center gap-3 p-3">
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  kpi.warn ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
                )}
              >
                <kpi.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{kpi.label}</p>
                <p className="truncate font-mono text-lg font-semibold tabular tracking-tight">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-5">
        <Card className="animate-rise xl:col-span-3" style={{ animationDelay: '120ms' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Объекты в работе</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/objects">Все объекты</Link>
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {data.objectsInWork.length === 0 ? (
              <EmptyState title="Нет активных объектов" description="Создайте объект, чтобы появилась сводка." />
            ) : (
              data.objectsInWork.map((object) => (
                <Link
                  key={object.id}
                  to={`/objects/${object.id}`}
                  className="block rounded-xl border border-border/70 bg-background/40 p-3.5 transition-colors hover:border-primary/30 hover:bg-accent/40"
                >
                  <div className="mb-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{object.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {object.responsible?.full_name ?? 'Без ответственного'} · до {formatDate(object.date_plan_end)}
                      </p>
                    </div>
                    <ObjectStatusBadge status={object.status} />
                  </div>
                  <DualProgress
                    production={object.progress?.progress_production ?? null}
                    installation={object.progress?.progress_installation ?? null}
                  />
                  {showEco && object.economics ? (
                    <div className="mt-2.5 text-sm">
                      <ProfitLine
                        profit={Number(object.economics.profit)}
                        margin={object.economics.margin_percent}
                        contractAmount={Number(object.economics.contract_amount)}
                      />
                    </div>
                  ) : null}
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:col-span-2">
          <Card className="animate-rise" style={{ animationDelay: '160ms' }}>
            <CardHeader>
              <CardTitle>Просрочки</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.overdue.length === 0 ? (
                <p className="text-sm text-muted-foreground">Просроченных этапов нет.</p>
              ) : (
                data.overdue.map((stage) => {
                  const days = daysOverdue(stage.date_plan_end, stage.status) ?? 0
                  return (
                    <Link
                      key={stage.id}
                      to={`/objects/${stage.object_id}`}
                      className="flex items-start justify-between gap-2 rounded-xl border border-destructive/15 bg-destructive/[0.03] p-3 transition-colors hover:bg-destructive/[0.06]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{stage.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{stage.object?.name}</p>
                      </div>
                      <span className="shrink-0 rounded-md bg-destructive/10 px-2 py-0.5 font-mono text-xs font-semibold text-destructive">
                        +{days} дн.
                      </span>
                    </Link>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card className="animate-rise" style={{ animationDelay: '200ms' }}>
            <CardHeader>
              <CardTitle>Новые заявки</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {data.requests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Новых заявок нет.</p>
              ) : (
                data.requests.map((req) => (
                  <div key={req.id} className="rounded-xl border border-border/70 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{req.title}</p>
                        <p className="truncate text-xs text-muted-foreground">{req.object?.name}</p>
                      </div>
                      <RequestStatusBadge status={req.status} />
                    </div>
                    <div className="mt-2.5 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          requests.update.mutate(
                            { id: req.id, values: { status: 'approved', resolved_at: new Date().toISOString() } },
                            {
                              onError: (e) => toast.error(humanizeError(e)),
                              onSuccess: () => toast.success('Согласовано'),
                            },
                          )
                        }
                      >
                        Согласовать
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          requests.update.mutate(
                            { id: req.id, values: { status: 'rejected', resolved_at: new Date().toISOString() } },
                            {
                              onError: (e) => toast.error(humanizeError(e)),
                              onSuccess: () => toast.success('Отклонено'),
                            },
                          )
                        }
                      >
                        Отклонить
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="animate-rise" style={{ animationDelay: '240ms' }}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Инструмент</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/tools">Все</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {data.toolsAttention.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ремонта и утери нет.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>
                    {data.toolsAttention.filter((t) => t.status === 'repair').length} в ремонте,
                    {' '}
                    {data.toolsAttention.filter((t) => t.status === 'lost').length} утеряно
                  </span>
                  <ToolStatusBadge status="repair" />
                  <ToolStatusBadge status="lost" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
