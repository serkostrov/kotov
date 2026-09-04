import { BackLink } from '@/components/back-link'
import { DualProgress } from '@/components/dual-progress'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { ObjectStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-provider'
import { useObject, useObjectProgress, useObjects } from '@/hooks/use-objects'
import { humanizeError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { Camera, ClipboardList, Receipt, Wrench } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'

export function MyObjectsPage() {
  const { data, isLoading, isError, error, refetch } = useObjects({})
  const { profile } = useAuth()

  if (isLoading) {
    return (
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState message={humanizeError(error)} onRetry={() => void refetch()} />

  return (
    <div>
      <PageHeader
        title={`Здравствуйте, ${profile?.full_name.split(' ')[0] ?? ''}`}
        description="Ваши объекты — дальше в один-два тапа."
      />
      {(data?.rows ?? []).length === 0 ? (
        <EmptyState
          title="Пока нет объектов"
          description="Когда руководитель добавит вас в участники, они появятся здесь."
        />
      ) : (
        <div className="grid gap-3">
          {(data?.rows ?? []).map((object, index) => (
            <Link key={object.id} to={`/my/${object.id}`} className="block animate-rise" style={{ animationDelay: `${index * 50}ms` }}>
              <Card className="transition-[border-color,transform] duration-200 hover:border-primary/35 active:scale-[0.99]">
                <CardContent className="space-y-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-lg font-bold tracking-tight">{object.name}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{object.address ?? 'Адрес не указан'}</p>
                    </div>
                    <ObjectStatusBadge status={object.status} />
                  </div>
                  <DualProgress
                    production={object.progress?.progress_production ?? null}
                    installation={object.progress?.progress_installation ?? null}
                  />
                  <p className="text-xs font-medium text-muted-foreground">до {formatDate(object.date_plan_end)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function MyObjectPage() {
  const { id } = useParams()
  const object = useObject(id)
  const progress = useObjectProgress(id)

  if (object.isLoading) return <Skeleton className="h-52" />
  if (object.isError) return <ErrorState message={humanizeError(object.error)} onRetry={() => void object.refetch()} />
  if (!object.data) return <EmptyState title="Объект не найден" />

  const actions = [
    { to: `/objects/${id}?tab=production`, label: 'Отметить этап', icon: Wrench, hint: 'Статус, процент, фото' },
    { to: `/objects/${id}?tab=media`, label: 'Загрузить фото', icon: Camera, hint: 'Камера телефона' },
    { to: `/objects/${id}?tab=expenses`, label: 'Добавить расход', icon: Receipt, hint: 'Сумма и категория' },
    { to: `/objects/${id}?tab=requests`, label: 'Создать заявку', icon: ClipboardList, hint: 'Расходники на объект' },
  ]

  return (
    <div className="space-y-5 animate-rise">
      <BackLink to="/my" label="Мои объекты" />
      <div>
        <div className="mb-2">
          <ObjectStatusBadge status={object.data.status} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{object.data.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{object.data.address}</p>
      </div>
      <Card>
        <CardContent className="p-4">
          <DualProgress
            production={progress.data?.progress_production ?? null}
            installation={progress.data?.progress_installation ?? null}
          />
        </CardContent>
      </Card>
      <div className="grid gap-3">
        {actions.map((action) => (
          <Button key={action.to} asChild size="xl" className="h-auto justify-start gap-3 py-4 shadow-none">
            <Link to={action.to}>
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-foreground/15">
                <action.icon className="h-5 w-5" />
              </span>
              <span className="grid text-left">
                <span className="text-base">{action.label}</span>
                <span className="text-xs font-normal text-primary-foreground/75">{action.hint}</span>
              </span>
            </Link>
          </Button>
        ))}
      </div>
    </div>
  )
}
