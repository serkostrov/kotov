import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { DatePicker } from '@/components/date-picker'
import { DateTimePicker } from '@/components/date-time-picker'
import { BackLink } from '@/components/back-link'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { IconButton } from '@/components/icon-button'
import { ListPagination, useListPaging } from '@/components/list-pagination'
import { Field, PageHeader } from '@/components/page-header'
import { ToolStatusBadge } from '@/components/status-badge'
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
import { commonMovements } from '@/lib/tool-actions'

type ToolListRow = NonNullable<ReturnType<typeof useTools>['data']>['rows'][number]

type ToolFormValues = {
  name: string
  inventory_number?: string | null
  category_id?: string | null
  purchase_price?: number | null
  purchase_date?: string | null
  comment?: string | null
}

export function ToolsPage() {
  const navigate = useNavigate()
  const { roles } = useAuth()
  const owner = isOwner(roles)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ToolStatus | 'all'>('all')
  const [categoryId, setCategoryId] = useState<string | 'all'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [moveType, setMoveType] = useState<ToolMovementType | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<ToolListRow | null>(null)
  const [deleting, setDeleting] = useState<ToolListRow | null>(null)
  const { page, setPage, pageSize, setPageSize } = useListPaging(`${search}:${status}:${categoryId}`)

  const tools = useTools({ search: search.trim() || undefined, status, categoryId, page, pageSize })
  const categories = useToolCategories()
  const objects = useObjects({ pageSize: 200 })
  const profiles = useProfiles()
  const mut = useToolMutations()

  const selectedRows = useMemo(
    () => (tools.data?.rows ?? []).filter((t) => selected.includes(t.id)),
    [tools.data?.rows, selected],
  )
  const allowed = useMemo(
    () => commonMovements(selectedRows.map((t) => t.status)),
    [selectedRows],
  )
  const canWriteOff = canWriteOffTools(roles)

  const stopRowNav = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

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
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
          <span className="self-center px-2 text-sm">{selected.length} выбрано</span>
          {allowed.has('issue') ? (
            <Button size="sm" onClick={() => setMoveType('issue')}>
              Выдать
            </Button>
          ) : null}
          {allowed.has('return') ? (
            <Button size="sm" variant="outline" onClick={() => setMoveType('return')}>
              Вернуть
            </Button>
          ) : null}
          {allowed.has('to_repair') ? (
            <Button size="sm" variant="outline" onClick={() => setMoveType('to_repair')}>
              В ремонт
            </Button>
          ) : null}
          {allowed.has('from_repair') ? (
            <Button size="sm" variant="outline" onClick={() => setMoveType('from_repair')}>
              Из ремонта
            </Button>
          ) : null}
          {allowed.has('transfer') ? (
            <Button size="sm" variant="outline" onClick={() => setMoveType('transfer')}>
              Переместить
            </Button>
          ) : null}
          {canWriteOff && allowed.has('loss') ? (
            <Button size="sm" variant="outline" onClick={() => setMoveType('loss')}>
              Утеря
            </Button>
          ) : null}
          {canWriteOff && allowed.has('write_off') ? (
            <Button size="sm" variant="destructive" onClick={() => setMoveType('write_off')}>
              Списать
            </Button>
          ) : null}
          {!(
            allowed.has('issue') ||
            allowed.has('return') ||
            allowed.has('to_repair') ||
            allowed.has('from_repair') ||
            allowed.has('transfer') ||
            (canWriteOff && (allowed.has('loss') || allowed.has('write_off')))
          ) ? (
            <span className="px-2 text-xs text-muted-foreground">
              Для выбранных статусов общих действий нет — выберите позиции с одним статусом.
            </span>
          ) : null}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSelected([])}>
            Сбросить
          </Button>
        </div>
      ) : null}

      {tools.isLoading ? (
        <Skeleton className="h-40" />
      ) : (tools.data?.rows ?? []).length === 0 ? (
        <EmptyState title="Инструмента нет" description={owner ? 'Заведите первую позицию в справочник.' : undefined} />
      ) : (
        <div className="grid gap-2 md:hidden">
          {(tools.data?.rows ?? []).map((tool) => (
            <Card
              key={tool.id}
              className="cursor-pointer transition-colors hover:bg-muted/20"
              onClick={() => navigate(`/tools/${tool.id}`)}
            >
              <CardContent className="flex items-start gap-3 p-3">
                <div onClick={stopRowNav}>
                  <Checkbox
                    checked={selected.includes(tool.id)}
                    onCheckedChange={(v) =>
                      setSelected((prev) => (v ? [...prev, tool.id] : prev.filter((id) => id !== tool.id)))
                    }
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{tool.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {tool.inventory_number ?? 'без номера'} · {tool.object?.name ?? 'склад'}
                  </p>
                </div>
                <ToolStatusBadge status={tool.status} />
                {owner ? (
                  <div className="flex shrink-0 gap-1" onClick={stopRowNav}>
                    <IconButton icon={Pencil} label="Изменить" onClick={() => setEditing(tool)} />
                    <IconButton
                      icon={Trash2}
                      label="Удалить"
                      variant="destructive"
                      onClick={() => setDeleting(tool)}
                    />
                  </div>
                ) : null}
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
                {owner ? <th className="w-20 px-3 py-3 font-medium" /> : null}
              </tr>
            </thead>
            <tbody>
              {(tools.data?.rows ?? []).map((tool) => (
                <tr
                  key={tool.id}
                  role="link"
                  tabIndex={0}
                  className="group cursor-pointer border-b last:border-0 hover:bg-muted/30"
                  onClick={() => navigate(`/tools/${tool.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/tools/${tool.id}`)
                    }
                  }}
                >
                  <td className="px-3 py-2" onClick={stopRowNav}>
                    <Checkbox
                      checked={selected.includes(tool.id)}
                      onCheckedChange={(v) =>
                        setSelected((prev) => (v ? [...prev, tool.id] : prev.filter((id) => id !== tool.id)))
                      }
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{tool.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{tool.inventory_number ?? '—'}</td>
                  <td className="px-3 py-2">{tool.category?.name ?? '—'}</td>
                  <td className="px-3 py-2">
                    <ToolStatusBadge status={tool.status} />
                  </td>
                  <td className="px-3 py-2">{tool.object?.name ?? '—'}</td>
                  <td className="px-3 py-2">{tool.holder?.full_name ?? '—'}</td>
                  {owner ? (
                    <td className="px-2 py-2" onClick={stopRowNav}>
                      <div className="flex justify-end gap-1 opacity-70 transition group-hover:opacity-100">
                        <IconButton icon={Pencil} label="Изменить" onClick={() => setEditing(tool)} />
                        <IconButton
                          icon={Trash2}
                          label="Удалить"
                          variant="destructive"
                          onClick={() => setDeleting(tool)}
                        />
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!tools.isLoading && (tools.data?.count ?? 0) > 0 ? (
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={tools.data?.count ?? 0}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
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

      <ToolFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        categories={categories.data ?? []}
        pending={mut.create.isPending}
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

      <ToolFormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        mode="edit"
        categories={categories.data ?? []}
        defaults={editing}
        pending={mut.update.isPending}
        onSubmit={(values) => {
          if (!editing) return
          mut.update.mutate(
            { id: editing.id, values },
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
            <AlertDialogTitle>Удалить инструмент?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `«${deleting.name}» будет скрыт из реестра. История движений сохранится.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mut.softDelete.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              disabled={mut.softDelete.isPending}
              onClick={() => {
                if (!deleting) return
                mut.softDelete.mutate(deleting.id, {
                  onSuccess: () => {
                    toast.success('Инструмент удалён')
                    setDeleting(null)
                    setSelected((prev) => prev.filter((id) => id !== deleting.id))
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

function MoveDialog({
  type,
  toolIds,
  objects,
  people,
  defaultObjectId,
  onClose,
  onSubmit,
}: {
  type: ToolMovementType
  toolIds: string[]
  objects: { id: string; name: string }[]
  people: { id: string; full_name: string }[]
  defaultObjectId?: string | null
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
  const [objectId, setObjectId] = useState(defaultObjectId ?? '')
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
                objectId: objectId || defaultObjectId || null,
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

function ToolFormDialog({
  open,
  onOpenChange,
  mode,
  categories,
  defaults,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  categories: { id: string; name: string }[]
  defaults?: Partial<ToolFormValues> | null
  pending?: boolean
  onSubmit: (values: ToolFormValues) => void
}) {
  const [name, setName] = useState('')
  const [inv, setInv] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [price, setPrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [comment, setComment] = useState('')

  useEffect(() => {
    if (!open) return
    setName(defaults?.name ?? '')
    setInv(defaults?.inventory_number ?? '')
    setCategoryId(defaults?.category_id ?? '')
    setPrice(defaults?.purchase_price != null ? String(defaults.purchase_price) : '')
    setPurchaseDate(defaults?.purchase_date ?? '')
    setComment(defaults?.comment ?? '')
  }, [open, defaults])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Новый инструмент' : 'Изменить инструмент'}</DialogTitle>
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
            disabled={!name.trim() || pending}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                inventory_number: inv.trim() || null,
                category_id: categoryId || null,
                purchase_price: price ? Number(price) : null,
                purchase_date: purchaseDate || null,
                comment: comment.trim() || null,
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
  const navigate = useNavigate()
  const { id } = useParams()
  const { roles } = useAuth()
  const owner = isOwner(roles)
  const canWriteOff = canWriteOffTools(roles)
  const tool = useTool(id)
  const movements = useToolMovements(id)
  const names = useProfileMap()
  const objects = useObjects({ pageSize: 200 })
  const profiles = useProfiles()
  const categories = useToolCategories()
  const mut = useToolMutations()
  const [moveType, setMoveType] = useState<ToolMovementType | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (tool.isLoading) return <Skeleton className="h-48" />
  if (tool.isError) return <ErrorState message={humanizeError(tool.error)} onRetry={() => void tool.refetch()} />
  if (!tool.data) return <EmptyState title="Инструмент не найден" />

  const item = tool.data
  const allowed = commonMovements([item.status])
  const actionButtons: { type: ToolMovementType; label: string; variant?: 'default' | 'outline' | 'destructive' }[] = []
  if (allowed.has('issue')) actionButtons.push({ type: 'issue', label: 'Выдать' })
  if (allowed.has('return')) actionButtons.push({ type: 'return', label: 'Вернуть', variant: 'outline' })
  if (allowed.has('transfer')) actionButtons.push({ type: 'transfer', label: 'Переместить', variant: 'outline' })
  if (allowed.has('to_repair')) actionButtons.push({ type: 'to_repair', label: 'В ремонт', variant: 'outline' })
  if (allowed.has('from_repair')) actionButtons.push({ type: 'from_repair', label: 'Из ремонта', variant: 'outline' })
  if (canWriteOff && allowed.has('loss')) actionButtons.push({ type: 'loss', label: 'Утеря', variant: 'outline' })
  if (canWriteOff && allowed.has('write_off')) {
    actionButtons.push({ type: 'write_off', label: 'Списать', variant: 'destructive' })
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <BackLink to="/tools" label="К реестру" className="mb-0" />
          <ToolStatusBadge status={item.status} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{item.name}</h1>
            <p className="text-sm text-muted-foreground">
              {item.inventory_number ? `Инв. № ${item.inventory_number}` : 'без инвентарного номера'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {owner ? (
              <>
                <IconButton icon={Pencil} label="Изменить" onClick={() => setEditOpen(true)} />
                <IconButton
                  icon={Trash2}
                  label="Удалить"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                />
              </>
            ) : null}
            {actionButtons.map((a) => (
              <Button key={a.type} size="sm" variant={a.variant ?? 'default'} onClick={() => setMoveType(a.type)}>
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Meta label="Статус" value={TOOL_STATUS_LABELS[item.status]} />
        <Meta label="Категория" value={item.category?.name ?? '—'} />
        <Meta label="Сейчас на объекте" value={item.object?.name ?? 'склад / не на объекте'} />
        <Meta label="Держатель" value={item.holder?.full_name ?? '—'} />
        <Meta label="Цена покупки" value={item.purchase_price != null ? formatMoney(item.purchase_price) : '—'} />
        <Meta label="Дата покупки" value={formatDate(item.purchase_date)} />
        <Meta label="Создан" value={formatDateTime(item.created_at)} />
        <Meta label="Обновлён" value={formatDateTime(item.updated_at)} />
        {item.created_by ? (
          <Meta label="Кто завёл" value={names.data?.get(item.created_by)?.full_name ?? '—'} />
        ) : null}
      </div>

      {item.comment ? (
        <div className="rounded-xl border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Комментарий</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{item.comment}</p>
        </div>
      ) : null}

      <div>
        <h2 className="mb-2 text-base font-semibold">История: где был и когда</h2>
        {movements.isLoading ? (
          <Skeleton className="h-32" />
        ) : (movements.data ?? []).length === 0 ? (
          <EmptyState title="Движений ещё не было" description="Выдача, возврат и ремонт появятся здесь автоматически." />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="divide-y divide-border/70 md:hidden">
              {(movements.data ?? []).map((m) => (
                <div key={m.id} className="space-y-1 px-3.5 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium">{TOOL_MOVEMENT_LABELS[m.movement_type]}</p>
                    <p className="shrink-0 text-xs text-muted-foreground">{formatDateTime(m.moved_at)}</p>
                  </div>
                  <p className="text-sm">{formatMovementPlace(m)}</p>
                  {(m.from_holder || m.to_holder) ? (
                    <p className="text-xs text-muted-foreground">
                      {[m.from_holder?.full_name, m.to_holder?.full_name].filter(Boolean).join(' → ') || '—'}
                    </p>
                  ) : null}
                  {m.comment ? <p className="text-xs text-muted-foreground">{m.comment}</p> : null}
                  {m.created_by ? (
                    <p className="text-[11px] text-muted-foreground">
                      оформил: {names.data?.get(m.created_by)?.full_name ?? '—'}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
            <table className="hidden w-full text-sm md:table">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Когда</th>
                  <th className="px-3 py-2 font-medium">Событие</th>
                  <th className="px-3 py-2 font-medium">Где</th>
                  <th className="px-3 py-2 font-medium">Держатель</th>
                  <th className="px-3 py-2 font-medium">Комментарий</th>
                </tr>
              </thead>
              <tbody>
                {(movements.data ?? []).map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(m.moved_at)}</td>
                    <td className="px-3 py-2 font-medium">{TOOL_MOVEMENT_LABELS[m.movement_type]}</td>
                    <td className="px-3 py-2">{formatMovementPlace(m)}</td>
                    <td className="px-3 py-2">
                      {m.from_holder?.full_name || m.to_holder?.full_name
                        ? `${m.from_holder?.full_name ?? '—'} → ${m.to_holder?.full_name ?? '—'}`
                        : '—'}
                      {m.created_by ? (
                        <span className="block text-xs text-muted-foreground">
                          {names.data?.get(m.created_by)?.full_name}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{m.comment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {moveType ? (
        <MoveDialog
          type={moveType}
          toolIds={[item.id]}
          objects={objects.data?.rows ?? []}
          people={profiles.data ?? []}
          defaultObjectId={item.current_object_id}
          onClose={() => setMoveType(null)}
          onSubmit={(payload) =>
            mut.move.mutate(payload, {
              onSuccess: () => {
                toast.success('Движение оформлено')
                setMoveType(null)
                void tool.refetch()
                void movements.refetch()
              },
              onError: (e) => toast.error(humanizeError(e)),
            })
          }
        />
      ) : null}

      {owner ? (
        <>
          <ToolFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            mode="edit"
            categories={categories.data ?? []}
            defaults={item}
            pending={mut.update.isPending}
            onSubmit={(values) =>
              mut.update.mutate(
                { id: item.id, values },
                {
                  onSuccess: () => {
                    toast.success('Сохранено')
                    setEditOpen(false)
                    void tool.refetch()
                  },
                  onError: (e) => toast.error(humanizeError(e)),
                },
              )
            }
          />
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить инструмент?</AlertDialogTitle>
                <AlertDialogDescription>
                  «{item.name}» будет скрыт из реестра. История движений сохранится.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={mut.softDelete.isPending}>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  disabled={mut.softDelete.isPending}
                  onClick={() =>
                    mut.softDelete.mutate(item.id, {
                      onSuccess: () => {
                        toast.success('Инструмент удалён')
                        navigate('/tools')
                      },
                      onError: (e) => toast.error(humanizeError(e)),
                    })
                  }
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </div>
  )
}

function formatMovementPlace(m: {
  movement_type: ToolMovementType
  object?: { name: string } | null
  from_object?: { name: string } | null
}) {
  const to = m.object?.name
  const from = m.from_object?.name
  switch (m.movement_type) {
    case 'issue':
    case 'extra_delivery':
      return to ? `на объект «${to}»` : 'на объект'
    case 'return':
      return from || to ? `с объекта «${from ?? to}» → склад` : 'возврат на склад'
    case 'transfer':
      if (from && to) return `«${from}» → «${to}»`
      return to ? `на объект «${to}»` : 'перемещение'
    case 'to_repair':
      return from || to ? `в ремонт${from || to ? ` (с «${from ?? to}»)` : ''}` : 'в ремонт'
    case 'from_repair':
      return 'из ремонта → склад'
    case 'loss':
      return from || to ? `утеря${from || to ? ` (на «${from ?? to}»)` : ''}` : 'утеря'
    case 'write_off':
      return from || to ? `списание${from || to ? ` (с «${from ?? to}»)` : ''}` : 'списание'
    default:
      return to ?? from ?? '—'
  }
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  )
}
