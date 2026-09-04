import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { DualProgress } from '@/components/dual-progress'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { IconButton } from '@/components/icon-button'
import { ContractSpendLine } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { ObjectStatusBadge } from '@/components/status-badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-provider'
import { ObjectFormDialog, toObjectPayload } from '@/features/objects/object-form-dialog'
import { useObjectMutations, useObjects, useProfiles, useContacts } from '@/hooks/use-objects'
import type { ObjectStatus } from '@/lib/database.types'
import { OBJECT_STATUS_LABELS } from '@/lib/dictionaries'
import { humanizeError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { canSeeEconomics, isOwner } from '@/lib/roles'

const STATUSES = Object.keys(OBJECT_STATUS_LABELS) as ObjectStatus[]

type ObjectRow = NonNullable<ReturnType<typeof useObjects>['data']>['rows'][number]

export function ObjectsPage() {
  const navigate = useNavigate()
  const { roles } = useAuth()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ObjectStatus | 'all'>('all')
  const [responsibleId, setResponsibleId] = useState<string | 'all'>('all')
  const [sort, setSort] = useState<'created_at' | 'date_plan_end' | 'contract_amount'>('created_at')
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ObjectRow | null>(null)
  const [deleting, setDeleting] = useState<ObjectRow | null>(null)
  const showEco = canSeeEconomics(roles)
  const owner = isOwner(roles)

  const { data, isLoading, isError, error, refetch } = useObjects({
    search: search.trim() || undefined,
    status,
    responsibleId,
    sort,
  })
  const profiles = useProfiles()
  const contacts = useContacts()
  const mutations = useObjectMutations()

  const people = useMemo(() => profiles.data ?? [], [profiles.data])
  const contactList = useMemo(() => contacts.data ?? [], [contacts.data])

  const stopRowNav = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <div>
      <PageHeader
        title="Объекты"
        description="Реестр площадок и договоров"
        actions={
          owner ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Новый объект
            </Button>
          ) : null
        }
      />

      <FilterBar>
        <div className="relative min-w-0 sm:col-span-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Поиск по названию, адресу, заказчику"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as ObjectStatus | 'all')}>
          <SelectTrigger>
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {OBJECT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger>
            <SelectValue placeholder="Сортировка" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">По дате создания</SelectItem>
            <SelectItem value="date_plan_end">По сроку</SelectItem>
            {showEco ? <SelectItem value="contract_amount">По сумме</SelectItem> : null}
          </SelectContent>
        </Select>
        <Select value={responsibleId} onValueChange={setResponsibleId}>
          <SelectTrigger>
            <SelectValue placeholder="Ответственный" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все ответственные</SelectItem>
            {people.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {isLoading ? (
        <div className="grid gap-3 md:hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState message={humanizeError(error)} onRetry={() => void refetch()} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState
          title="Объектов пока нет"
          description={owner ? 'Создайте первый объект — карточку, этапы и экономику.' : 'Вас ещё не добавили ни на один объект.'}
          action={
            owner ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Новый объект
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="grid gap-3 md:hidden">
            {data.rows.map((object) => (
              <Card key={object.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/objects/${object.id}`} className="min-w-0 flex-1">
                      <p className="font-medium hover:underline">{object.name}</p>
                    </Link>
                    <ObjectStatusBadge status={object.status} />
                  </div>
                  <Link to={`/objects/${object.id}`} className="block">
                    <p className="text-sm text-muted-foreground">{object.address ?? 'Адрес не указан'}</p>
                    <DualProgress
                      production={object.progress?.progress_production ?? null}
                      installation={object.progress?.progress_installation ?? null}
                    />
                    {showEco && object.economics ? (
                      <ContractSpendLine
                        contractAmount={object.economics.contract_amount}
                        expensesTotal={object.economics.expenses_total}
                      />
                    ) : null}
                  </Link>
                  {owner ? (
                    <div className="flex justify-end gap-1 pt-1">
                      <IconButton icon={Pencil} label="Изменить" onClick={() => setEditing(object)} />
                      <IconButton
                        icon={Trash2}
                        label="Удалить"
                        variant="destructive"
                        onClick={() => setDeleting(object)}
                      />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="hidden w-full overflow-hidden rounded-lg border border-border/80 bg-card md:block">
            <table className="w-full text-[13px]">
              <thead className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Объект</th>
                  <th className="px-3 py-2 font-medium">Статус</th>
                  <th className="px-3 py-2 font-medium">Прогресс</th>
                  <th className="px-3 py-2 font-medium">Срок</th>
                  <th className="px-3 py-2 font-medium">Ответственный</th>
                  {showEco ? <th className="px-3 py-2 font-medium">Средства</th> : null}
                  {owner ? <th className="w-20 px-3 py-2 font-medium" /> : null}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((object) => (
                  <tr
                    key={object.id}
                    role="link"
                    tabIndex={0}
                    className="group cursor-pointer border-b last:border-0 hover:bg-muted/30"
                    onClick={() => navigate(`/objects/${object.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigate(`/objects/${object.id}`)
                      }
                    }}
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{object.name}</p>
                      <p className="text-xs text-muted-foreground">{object.customer_name ?? object.address}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <ObjectStatusBadge status={object.status} />
                    </td>
                    <td className="min-w-[160px] px-3 py-2.5">
                      <DualProgress
                        production={object.progress?.progress_production ?? null}
                        installation={object.progress?.progress_installation ?? null}
                      />
                    </td>
                    <td className="px-3 py-2.5">{formatDate(object.date_plan_end)}</td>
                    <td className="px-3 py-2.5">{object.responsible?.full_name ?? '—'}</td>
                    {showEco ? (
                      <td className="px-3 py-2.5">
                        {object.economics ? (
                          <ContractSpendLine
                            compact
                            contractAmount={object.economics.contract_amount}
                            expensesTotal={object.economics.expenses_total}
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                    ) : null}
                    {owner ? (
                      <td className="px-2 py-2.5" onClick={stopRowNav}>
                        <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                          <IconButton icon={Pencil} label="Изменить" onClick={() => setEditing(object)} />
                          <IconButton
                            icon={Trash2}
                            label="Удалить"
                            variant="destructive"
                            onClick={() => setDeleting(object)}
                          />
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ObjectFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        people={people}
        contacts={contactList}
        pending={mutations.create.isPending}
        onSubmit={(values) =>
          mutations.create.mutate(toObjectPayload(values, contactList), {
            onSuccess: () => {
              toast.success('Объект создан')
              setCreateOpen(false)
            },
            onError: (e) => toast.error(humanizeError(e)),
          })
        }
      />

      <ObjectFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        mode="edit"
        people={people}
        contacts={contactList}
        defaults={editing}
        pending={mutations.update.isPending}
        onSubmit={(values) => {
          if (!editing) return
          mutations.update.mutate(
            { id: editing.id, values: toObjectPayload(values, contactList) },
            {
              onSuccess: () => {
                toast.success('Сохранено')
                setEditing(null)
              },
              onError: (e) => toast.error(humanizeError(e)),
            },
          )
        }}
      />

      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить объект?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `«${deleting.name}» будет скрыт из реестра. Этапы и файлы останутся в базе, но объект перестанет отображаться.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutations.softDelete.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutations.softDelete.isPending}
              onClick={() => {
                if (!deleting) return
                mutations.softDelete.mutate(deleting.id, {
                  onSuccess: () => {
                    toast.success('Объект удалён')
                    setDeleting(null)
                  },
                  onError: (e) => toast.error(humanizeError(e)),
                })
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
