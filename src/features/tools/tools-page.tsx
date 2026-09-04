import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import { DatePicker } from '@/components/date-picker'
import { DateTimePicker } from '@/components/date-time-picker'
import { BackLink } from '@/components/back-link'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { Field, PageHeader } from '@/components/page-header'
import { ToolStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-provider'
import { useObjects, useProfiles, useToolCategories } from '@/hooks/use-objects'
import { useTool, useToolMovements, useToolMutations, useTools } from '@/hooks/use-tools'
import { useProfileMap } from '@/hooks/use-profile-map'
import type { ToolMovementType, ToolStatus } from '@/lib/database.types'
import { TOOL_MOVEMENT_LABELS, TOOL_STATUS_LABELS } from '@/lib/dictionaries'
import { humanizeError } from '@/lib/errors'
import { formatDate, formatDateTime, formatMoney, nowTimeISO, todayISO } from '@/lib/format'
import { canWriteOffTools, isOwner } from '@/lib/roles'

export function ToolsPage() {
  const { roles } = useAuth()
  const owner = isOwner(roles)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ToolStatus | 'all'>('all')
  const [categoryId, setCategoryId] = useState<string | 'all'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [moveType, setMoveType] = useState<ToolMovementType | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  const tools = useTools({ search: search.trim() || undefined, status, categoryId })
  const categories = useToolCategories()
  const objects = useObjects({ pageSize: 200 })
  const profiles = useProfiles()
  const mut = useToolMutations()

  if (tools.isError) return <ErrorState message={humanizeError(tools.error)} onRetry={() => void tools.refetch()} />

  return (
    <div>
      <PageHeader
        title="Инструмент"
        description="Реестр, выдача на объект и история движений"
        actions={
          owner ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Добавить
            </Button>
          ) : null
        }
      />

      <FilterBar>
        <div className="relative min-w-0 sm:col-span-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Название или инвентарный номер"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as ToolStatus | 'all')}>
          <SelectTrigger>
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {(Object.keys(TOOL_STATUS_LABELS) as ToolStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {TOOL_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {(categories.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {selected.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2 rounded-lg border bg-card p-2">
          <span className="self-center px-2 text-sm">{selected.length} выбрано</span>
          <Button size="sm" onClick={() => setMoveType('issue')}>Выдать</Button>
          <Button size="sm" variant="outline" onClick={() => setMoveType('return')}>Вернуть</Button>
          <Button size="sm" variant="outline" onClick={() => setMoveType('to_repair')}>В ремонт</Button>
          <Button size="sm" variant="outline" onClick={() => setMoveType('from_repair')}>Из ремонта</Button>
          {canWriteOffTools(roles) ? (
            <>
              <Button size="sm" variant="outline" onClick={() => setMoveType('loss')}>Утеря</Button>
              <Button size="sm" variant="destructive" onClick={() => setMoveType('write_off')}>Списать</Button>
            </>
          ) : null}
        </div>
      ) : null}

      {tools.isLoading ? (
        <Skeleton className="h-40" />
      ) : (tools.data?.rows ?? []).length === 0 ? (
        <EmptyState title="Инструмента нет" description={owner ? 'Заведите первую позицию в справочник.' : undefined} />
      ) : (
        <div className="grid gap-2 md:hidden">
          {(tools.data?.rows ?? []).map((tool) => (
            <Card key={tool.id}>
              <CardContent className="flex items-start gap-3 p-3">
                <Checkbox
                  checked={selected.includes(tool.id)}
                  onCheckedChange={(v) =>
                    setSelected((prev) => (v ? [...prev, tool.id] : prev.filter((id) => id !== tool.id)))
                  }
                />
                <Link to={`/tools/${tool.id}`} className="min-w-0 flex-1">
                  <p className="font-medium">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.inventory_number ?? 'без номера'} · {tool.object?.name ?? 'склад'}</p>
                </Link>
                <ToolStatusBadge status={tool.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!tools.isLoading && (tools.data?.rows ?? []).length > 0 ? (
        <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card/90 md:block">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="px-3 py-3 font-medium">Название</th>
                <th className="px-3 py-3 font-medium">Инв. №</th>
                <th className="px-3 py-3 font-medium">Категория</th>
                <th className="px-3 py-3 font-medium">Статус</th>
                <th className="px-3 py-3 font-medium">Объект</th>
                <th className="px-3 py-3 font-medium">Держатель</th>
              </tr>
            </thead>
            <tbody>
              {(tools.data?.rows ?? []).map((tool) => (
                <tr key={tool.id} className="border-b last:border-0">
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={selected.includes(tool.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => (v ? [...prev, tool.id] : prev.filter((id) => id !== tool.id)))
                      }
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/tools/${tool.id}`} className="font-medium hover:underline">
                      {tool.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{tool.inventory_number ?? '—'}</td>
                  <td className="px-3 py-2">{tool.category?.name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <ToolStatusBadge status={tool.status} />
                  </td>
                  <td className="px-3 py-2">{tool.object?.name ?? '—'}</td>
                  <td className="px-3 py-2">{tool.holder?.full_name ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {moveType ? (
        <MoveDialog
          type={moveType}
          toolIds={selected}
          objects={objects.data?.rows ?? []}
          people={profiles.data ?? []}
          onClose={() => setMoveType(null)}
          onSubmit={(payload) =>
            mut.move.mutate(payload, {
              onSuccess: () => {
                toast.success('Движение оформлено')
                setMoveType(null)
                setSelected([])
              },
              onError: (e) => toast.error(humanizeError(e)),
            })
          }
        />
      ) : null}

      <ToolCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={categories.data ?? []}
        onSubmit={(values) =>
          mut.create.mutate(values, {
            onSuccess: () => {
              toast.success('Инструмент добавлен')
              setCreateOpen(false)
            },
            onError: (e) => toast.error(humanizeError(e)),
          })
        }
      />
    </div>
  )
}

function MoveDialog({
  type,
  toolIds,
  objects,
  people,
  onClose,
  onSubmit,
}: {
  type: ToolMovementType
  toolIds: string[]
  objects: { id: string; name: string }[]
  people: { id: string; full_name: string }[]
  onClose: () => void
  onSubmit: (payload: {
    toolIds: string[]
    movementType: ToolMovementType
    objectId?: string | null
    holderId?: string | null
    comment?: string
    movedAt?: string | null
  }) => void
}) {
  const [objectId, setObjectId] = useState('')
  const [holderId, setHolderId] = useState('')
  const [comment, setComment] = useState('')
  const [movedDate, setMovedDate] = useState(todayISO())
  const [movedTime, setMovedTime] = useState(nowTimeISO())
  const needsObject = type === 'issue' || type === 'extra_delivery' || type === 'transfer'

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{TOOL_MOVEMENT_LABELS[type]}</DialogTitle>
        </DialogHeader>
        {needsObject ? (
          <Field label="Объект">
            <Select value={objectId || undefined} onValueChange={setObjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите объект" />
              </SelectTrigger>
              <SelectContent>
                {objects.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        {needsObject ? (
          <Field label="Кому">
            <Select value={holderId || 'none'} onValueChange={(v) => setHolderId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Не указан" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не указан</SelectItem>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <Field label="Дата и время">
          <DateTimePicker
            date={movedDate}
            time={movedTime}
            onDateChange={setMovedDate}
            onTimeChange={setMovedTime}
            clearable={false}
          />
        </Field>
        <Field label="Комментарий">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button
            onClick={() =>
              onSubmit({
                toolIds,
                movementType: type,
                objectId: objectId || null,
                holderId: holderId || null,
                comment,
                movedAt: movedDate && movedTime ? `${movedDate}T${movedTime}:00+03:00` : null,
              })
            }
          >
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ToolCreateDialog({
  open,
  onOpenChange,
  categories,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: { id: string; name: string }[]
  onSubmit: (values: {
    name: string
    inventory_number?: string | null
    category_id?: string | null
    purchase_price?: number | null
    purchase_date?: string | null
    comment?: string | null
  }) => void
}) {
  const [name, setName] = useState('')
  const [inv, setInv] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [comment, setComment] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый инструмент</DialogTitle>
        </DialogHeader>
        <Field label="Название">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Инвентарный номер">
          <Input value={inv} onChange={(e) => setInv(e.target.value)} />
        </Field>
        <Field label="Категория">
          <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="Без категории" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без категории</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Цена покупки, ₽">
            <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Дата покупки">
            <DatePicker value={purchaseDate} onChange={setPurchaseDate} />
          </Field>
        </div>
        <Field label="Комментарий">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button
            disabled={!name}
            onClick={() =>
              onSubmit({
                name,
                inventory_number: inv || null,
                category_id: categoryId || null,
                purchase_price: price ? Number(price) : null,
                purchase_date: purchaseDate || null,
                comment: comment || null,
              })
            }
          >
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ToolCardPage() {
  const { id } = useParams()
  const tool = useTool(id)
  const movements = useToolMovements(id)
  const names = useProfileMap()

  if (tool.isLoading) return <Skeleton className="h-48" />
  if (tool.isError) return <ErrorState message={humanizeError(tool.error)} onRetry={() => void tool.refetch()} />
  if (!tool.data) return <EmptyState title="Инструмент не найден" />

  const item = tool.data
  return (
    <div className="space-y-5">
      <div>
        <BackLink to="/tools" label="К инструменту" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{item.name}</h1>
            <p className="text-sm text-muted-foreground">{item.inventory_number ?? 'без инвентарного номера'}</p>
          </div>
          <ToolStatusBadge status={item.status} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Meta label="Категория" value={item.category?.name ?? '—'} />
        <Meta label="Объект" value={item.object?.name ?? '—'} />
        <Meta label="Держатель" value={item.holder?.full_name ?? '—'} />
        <Meta label="Цена" value={item.purchase_price ? formatMoney(item.purchase_price) : '—'} />
        <Meta label="Дата покупки" value={formatDate(item.purchase_date)} />
      </div>
      <div>
        <h2 className="mb-2 text-base font-semibold">История движений</h2>
        {(movements.data ?? []).length === 0 ? (
          <EmptyState title="Движений ещё не было" />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Тип</th>
                  <th className="px-3 py-2 font-medium">Дата</th>
                  <th className="px-3 py-2 font-medium">Объект</th>
                  <th className="px-3 py-2 font-medium">От → кому</th>
                  <th className="px-3 py-2 font-medium">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {(movements.data ?? []).map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="px-3 py-2">{TOOL_MOVEMENT_LABELS[m.movement_type]}</td>
                    <td className="px-3 py-2">{formatDateTime(m.moved_at)}</td>
                    <td className="px-3 py-2">{m.object?.name ?? '—'}</td>
                    <td className="px-3 py-2">
                      {m.from_holder?.full_name ?? '—'} → {m.to_holder?.full_name ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      {m.comment ?? '—'}
                      <span className="block text-xs text-muted-foreground">
                        {m.created_by ? names.data?.get(m.created_by)?.full_name : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}
