import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  GripVertical,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import { DualProgress } from '@/components/dual-progress'
import { DatePicker } from '@/components/date-picker'
import { BackLink } from '@/components/back-link'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { IconButton } from '@/components/icon-button'
import { ListPagination, useListPaging } from '@/components/list-pagination'
import { Money } from '@/components/money'
import { Field } from '@/components/page-header'
import { ObjectStatusBadge, RequestStatusBadge, StageStatusBadge, ToolStatusBadge } from '@/components/status-badge'
import { TabsBar } from '@/components/tabs-bar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-provider'
import { ObjectFormDialog, toObjectPayload } from '@/features/objects/object-form-dialog'
import {
  useActivity,
  useAddStageFromTemplate,
  useObject,
  useObjectEconomics,
  useObjectExpensesByCategory,
  useObjectExpensesByContour,
  useObjectMembers,
  useObjectMutations,
  useObjectProgress,
  useObjectStages,
  useProfiles,
  useContacts,
  useStageTemplates,
  useExpenseCategories,
} from '@/hooks/use-objects'
import { useAttachments, useExpenseMutations, useExpenses, useMaterialRequests, useRequestMutations, useSignedUrl } from '@/hooks/use-finance'
import { useObjectTools, useToolMutations, useTools } from '@/hooks/use-tools'
import { useProfileMap } from '@/hooks/use-profile-map'
import type { ObjectStatus, StageType } from '@/lib/database.types'
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_ENTITY_LABELS,
  OBJECT_STATUS_LABELS,
  STAGE_TYPE_LABELS,
} from '@/lib/dictionaries'
import { humanizeError } from '@/lib/errors'
import { fileSizeLabel, formatDate, formatDateTime, formatPercent, todayISO } from '@/lib/format'
import { canManageStages, canSeeEconomics, canUpdateInstallation, canUpdateProduction, isOwner } from '@/lib/roles'
import { formatStageVolume, stageProgressOf } from '@/lib/stage-progress'
import { supabase } from '@/lib/supabase'
import { signedUrl, uploadObjectFile } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { useQueryClient } from '@tanstack/react-query'

const TABS = [
  { value: 'production', label: 'Производство' },
  { value: 'installation', label: 'Монтаж' },
  { value: 'tools', label: 'Инструмент' },
  { value: 'media', label: 'Фото и видео' },
  { value: 'docs', label: 'Документы' },
  { value: 'expenses', label: 'Расходы' },
  { value: 'requests', label: 'Задачи' },
  { value: 'members', label: 'Участники' },
  { value: 'history', label: 'История' },
] as const

export function ObjectCardPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'overview' ? 'production' : (params.get('tab') ?? 'production')
  const { roles } = useAuth()
  const showEco = canSeeEconomics(roles)
  const owner = isOwner(roles)
  const objectQuery = useObject(id)
  const progress = useObjectProgress(id)
  const allStages = useObjectStages(id)
  const mutations = useObjectMutations()
  const object = objectQuery.data
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)
  const [addStageOpen, setAddStageOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const mediaInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  const client = useQueryClient()
  const profiles = useProfiles()
  const contacts = useContacts()
  const navigate = useNavigate()

  const liveProgress = useMemo(() => {
    const rows = allStages.data ?? []
    const avg = (type: StageType) => {
      const list = rows.filter((s) => s.stage_type === type)
      if (list.length === 0) return null
      return Math.round(list.reduce((sum, s) => sum + stageProgressOf(s), 0) / list.length)
    }
    return {
      production: avg('production'),
      installation: avg('installation'),
    }
  }, [allStages.data])

  if (objectQuery.isLoading) return <Skeleton className="h-64 w-full" />
  if (objectQuery.isError) return <ErrorState message={humanizeError(objectQuery.error)} onRetry={() => void objectQuery.refetch()} />
  if (!object || !id) return <EmptyState title="Объект не найден" description="Возможно, у вас нет доступа или он удалён." />

  const stageType: StageType | null =
    tab === 'production' ? 'production' : tab === 'installation' ? 'installation' : null
  const canMoveTools = owner || canUpdateInstallation(roles) || canUpdateProduction(roles)

  const uploadQuick = async (files: FileList | null, kind: 'media' | 'doc') => {
    const list = files ? Array.from(files) : []
    if (list.length === 0) return
    let ok = 0
    try {
      for (const file of list) {
        await uploadObjectFile({ file, objectId: id })
        ok += 1
      }
      toast.success(
        kind === 'media'
          ? ok === 1
            ? 'Файл загружен'
            : `Загружено файлов: ${ok}`
          : ok === 1
            ? 'Документ загружен'
            : `Загружено документов: ${ok}`,
      )
      void client.invalidateQueries({ queryKey: ['attachments'] })
      if (kind === 'media' && tab !== 'media') setParams({ tab: 'media' })
      if (kind === 'doc' && tab !== 'docs') setParams({ tab: 'docs' })
    } catch (error) {
      toast.error(
        ok > 0
          ? `Загружено ${ok} из ${list.length}. ${humanizeError(error)}`
          : humanizeError(error),
      )
      if (ok > 0) void client.invalidateQueries({ queryKey: ['attachments'] })
    }
  }

  const tabActions = (
    <>
      {tab === 'tools' && canMoveTools ? (
        <Button onClick={() => setIssueOpen(true)}>Выдать на объект</Button>
      ) : null}
      {tab === 'media' ? (
        <Button onClick={() => mediaInputRef.current?.click()}>
          <Upload />
          Загрузить фото
        </Button>
      ) : null}
      {tab === 'docs' ? (
        <Button onClick={() => docInputRef.current?.click()}>
          <Upload />
          Загрузить документы
        </Button>
      ) : null}
      {stageType && canManageStages(roles) ? (
        <Button onClick={() => setAddStageOpen(true)}>
          <Plus />
          Добавить
        </Button>
      ) : null}
      {tab === 'expenses' ? (
        <Button onClick={() => setExpenseOpen(true)}>
          <Plus />
          Расход
        </Button>
      ) : null}
      {tab === 'requests' ? (
        <Button onClick={() => setRequestOpen(true)}>
          <Plus />
          Задача
        </Button>
      ) : null}
    </>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <BackLink to="/objects" label="К объектам" />
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-[1.35rem]">{object.name}</h1>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {object.address ?? 'Адрес не указан'}
            {object.customer_name ? ` · ${object.customer_name}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {owner ? (
            <>
              <Button variant="outline" className="h-8" onClick={() => setEditOpen(true)}>
                <Pencil />
                Изменить
              </Button>
              <Button
                variant="outline"
                className="h-8 text-destructive hover:text-destructive"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 />
                Удалить
              </Button>
              <Select
                value={object.status}
                onValueChange={(status) =>
                  mutations.update.mutate(
                    { id, values: { status: status as ObjectStatus } },
                    { onError: (e) => toast.error(humanizeError(e)) },
                  )
                }
              >
                <SelectTrigger className="h-8 w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(OBJECT_STATUS_LABELS) as ObjectStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {OBJECT_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          ) : (
            <ObjectStatusBadge status={object.status} />
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[0_1px_0_oklch(0_0_0_/_0.02)]">
        <div
          className={cn(
            'grid divide-y divide-border/70',
            showEco ? 'sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4' : 'sm:grid-cols-3 sm:divide-y-0',
            'sm:divide-x sm:divide-border/70',
          )}
        >
          <Meta label="Ответственный" value={object.responsible?.full_name ?? '—'} />
          <Meta label="Сроки" value={`${formatDate(object.date_start)} — ${formatDate(object.date_plan_end)}`} />
          {showEco ? <Meta label="Сумма договора" value={<Money value={object.contract_amount} />} /> : null}
          <div className="flex min-w-0 flex-col justify-center gap-1.5 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Прогресс</p>
            <DualProgress
              dense
              production={liveProgress.production ?? progress.data?.progress_production ?? null}
              installation={liveProgress.installation ?? progress.data?.progress_installation ?? null}
            />
          </div>
        </div>
      </div>

      <input
        ref={mediaInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void uploadQuick(e.target.files, 'media')
          e.target.value = ''
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic"
        multiple
        className="hidden"
        onChange={(e) => {
          void uploadQuick(e.target.files, 'doc')
          e.target.value = ''
        }}
      />

      <Tabs value={tab} onValueChange={(value) => setParams({ tab: value })}>
        <TabsBar
          tabs={
            <TabsList>
              {TABS.map((item) => (
                <TabsTrigger key={item.value} value={item.value} className="px-2 text-[12px]">
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          }
          actions={tabActions}
        />

        <TabsContent value="production">
          <StagesTab objectId={id} type="production" canEdit={canUpdateProduction(roles)} canManage={canManageStages(roles)} />
        </TabsContent>
        <TabsContent value="installation">
          <StagesTab objectId={id} type="installation" canEdit={canUpdateInstallation(roles)} canManage={canManageStages(roles)} />
        </TabsContent>
        <TabsContent value="tools">
          <ToolsTab objectId={id} canMove={canMoveTools} issueOpen={issueOpen} onIssueOpenChange={setIssueOpen} />
        </TabsContent>
        <TabsContent value="media">
          <MediaTab objectId={id} />
        </TabsContent>
        <TabsContent value="docs">
          <DocsTab objectId={id} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesTab objectId={id} createOpen={expenseOpen} onCreateOpenChange={setExpenseOpen} />
        </TabsContent>
        <TabsContent value="requests">
          <RequestsTab objectId={id} createOpen={requestOpen} onCreateOpenChange={setRequestOpen} />
        </TabsContent>
        <TabsContent value="members">
          <MembersTab objectId={id} owner={owner} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab objectId={id} />
        </TabsContent>
      </Tabs>

      {stageType ? (
        <AddStageDialog
          open={addStageOpen}
          onOpenChange={setAddStageOpen}
          objectId={id}
          stageType={stageType}
        />
      ) : null}

      {owner ? (
        <>
          <ObjectFormDialog
            open={editOpen}
            onOpenChange={setEditOpen}
            mode="edit"
            people={profiles.data ?? []}
            contacts={contacts.data ?? []}
            defaults={object}
            pending={mutations.update.isPending}
            onSubmit={(values) =>
              mutations.update.mutate(
                { id, values: toObjectPayload(values, contacts.data ?? []) },
                {
                  onSuccess: () => {
                    toast.success('Сохранено')
                    setEditOpen(false)
                    void objectQuery.refetch()
                  },
                  onError: (e) => toast.error(humanizeError(e)),
                },
              )
            }
          />
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить объект?</AlertDialogTitle>
                <AlertDialogDescription>
                  «{object.name}» будет скрыт из реестра. Этапы и файлы останутся в базе, но объект перестанет отображаться.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={mutations.softDelete.isPending}>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  disabled={mutations.softDelete.isPending}
                  onClick={() =>
                    mutations.softDelete.mutate(id, {
                      onSuccess: () => {
                        toast.success('Объект удалён')
                        navigate('/objects')
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

function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-0.5 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="truncate text-[13px] font-medium leading-snug tracking-tight">{value}</div>
    </div>
  )
}

function AddStageDialog({
  open,
  onOpenChange,
  objectId,
  stageType,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  objectId: string
  stageType: StageType
}) {
  const templates = useStageTemplates()
  const stages = useObjectStages(objectId, stageType)
  const addStage = useAddStageFromTemplate()
  const [templateId, setTemplateId] = useState('')

  const usedTemplateIds = useMemo(
    () => new Set((stages.data ?? []).map((s) => s.template_id).filter(Boolean) as string[]),
    [stages.data],
  )

  const available = useMemo(
    () =>
      (templates.data ?? []).filter(
        (t) => t.is_active && t.stage_type === stageType && !usedTemplateIds.has(t.id),
      ),
    [templates.data, stageType, usedTemplateIds],
  )

  useEffect(() => {
    if (!open) setTemplateId('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить работу</DialogTitle>
        </DialogHeader>
        <Field label={`Шаблон · ${STAGE_TYPE_LABELS[stageType].toLowerCase()}`}>
          {templates.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : available.length === 0 ? (
            <div className="space-y-2 rounded-md border border-dashed px-3 py-2.5 text-[13px] text-muted-foreground">
              <p>Нет доступных шаблонов — добавьте их в настройках или все уже на объекте.</p>
              <Link
                to={`/settings?tab=stages&type=${stageType}`}
                className="inline-flex text-[13px] font-medium text-primary hover:underline"
                onClick={() => onOpenChange(false)}
              >
                Открыть шаблоны · {STAGE_TYPE_LABELS[stageType].toLowerCase()}
              </Link>
            </div>
          ) : (
            <Select value={templateId || undefined} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите работу" />
              </SelectTrigger>
              <SelectContent>
                {available.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                    {t.unit ? ` · ${t.unit}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
        <DialogFooter>
          <Button
            disabled={!templateId || addStage.isPending}
            onClick={() =>
              addStage.mutate(
                { objectId, templateId },
                {
                  onSuccess: () => {
                    toast.success('Работа добавлена')
                    onOpenChange(false)
                  },
                  onError: (e) => toast.error(humanizeError(e)),
                },
              )
            }
          >
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StagesTab({
  objectId,
  type,
  canEdit,
  canManage,
}: {
  objectId: string
  type: StageType
  canEdit: boolean
  canManage: boolean
}) {
  const stages = useObjectStages(objectId, type)
  const client = useQueryClient()

  if (stages.isLoading) return <Skeleton className="h-40" />
  if (stages.isError) return <ErrorState message={humanizeError(stages.error)} onRetry={() => void stages.refetch()} />

  const rows = stages.data ?? []
  const done = rows.filter((s) => s.status === 'done').length
  const avg =
    rows.length === 0
      ? 0
      : Math.round(rows.reduce((sum, s) => sum + stageProgressOf(s), 0) / rows.length)

  return (
    <div className="space-y-2.5">
      {rows.length === 0 ? (
        <EmptyState
          title={`Нет работ: ${STAGE_TYPE_LABELS[type].toLowerCase()}`}
          description={
            canManage
              ? 'Нажмите «Добавить» и выберите работу из шаблона.'
              : 'Работы появятся, когда руководитель их добавит.'
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                Работ: <span className="font-medium text-foreground">{rows.length}</span>
              </span>
              <span>
                Сдано: <span className="font-medium text-foreground">{done}</span>
              </span>
              <span className="inline-flex items-center gap-2">
                Средний прогресс
                <span className="font-mono font-medium tabular text-foreground">{avg}%</span>
                <Progress value={avg} className="h-1.5 w-20" />
              </span>
            </div>
            {canEdit ? (
              <p className="text-[11px] text-muted-foreground">Откройте работу, чтобы отметить прогресс</p>
            ) : null}
          </div>
          <StageList
            objectId={objectId}
            items={rows}
            canManage={canManage}
            onReorder={async (ordered) => {
              await Promise.all(
                ordered.map((stage, index) =>
                  supabase.from('object_stages').update({ sort_order: (index + 1) * 10 }).eq('id', stage.id),
                ),
              )
              void client.invalidateQueries({ queryKey: ['object-stages'] })
            }}
          />
        </>
      )}
    </div>
  )
}

type StageRow = NonNullable<ReturnType<typeof useObjectStages>['data']>[number]

function StageList({
  objectId,
  items,
  canManage,
  onReorder,
}: {
  objectId: string
  items: StageRow[]
  canManage: boolean
  onReorder: (items: StageRow[]) => Promise<void>
}) {
  const [local, setLocal] = useState(items)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    setLocal(items)
  }, [items])

  const onDragEnd = (event: DragEndEvent) => {
    if (!canManage) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = local.findIndex((s) => s.id === active.id)
    const newIndex = local.findIndex((s) => s.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(local, oldIndex, newIndex)
    setLocal(next)
    void onReorder(next)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={local.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[auto_minmax(0,1.6fr)_minmax(5.5rem,0.7fr)_minmax(5rem,0.55fr)_minmax(7rem,0.8fr)_auto] gap-2 border-b bg-muted/35 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground md:grid">
            <span className="w-6" />
            <span>Работа</span>
            <span>Прогресс</span>
            <span>Срок</span>
            <span>Ответственный</span>
            <span className="w-5" />
          </div>
          <div className="divide-y">
            {local.map((stage) => (
              <StageRowCard key={stage.id} objectId={objectId} stage={stage} canManage={canManage} />
            ))}
          </div>
        </div>
      </SortableContext>
    </DndContext>
  )
}

function StageRowCard({
  objectId,
  stage,
  canManage,
}: {
  objectId: string
  stage: StageRow
  canManage: boolean
}) {
  const sortable = useSortable({ id: stage.id, disabled: !canManage })
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }
  const href = `/objects/${objectId}/stages/${stage.id}`
  const progress = stageProgressOf(stage)
  const qty = formatStageVolume(stage.qty_fact, stage.qty_plan, stage.unit)

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-2.5 py-1.5 transition-colors hover:bg-accent/40 md:grid-cols-[auto_minmax(0,1.6fr)_minmax(5.5rem,0.7fr)_minmax(5rem,0.55fr)_minmax(7rem,0.8fr)_auto]"
    >
      {canManage ? (
        <button
          type="button"
          className="flex h-7 w-6 items-center justify-center text-muted-foreground/70 hover:text-foreground"
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label="Перетащить"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      ) : (
        <span className="w-6" />
      )}

      <Link to={href} className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-[13px] font-medium leading-tight group-hover:underline">{stage.name}</span>
          <StageStatusBadge status={stage.status} />
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground md:hidden">
          {progress}% · {formatDate(stage.date_plan_end)} · {stage.responsible?.full_name ?? '—'}
          {qty ? ` · ${qty}` : ''}
        </p>
        {qty ? <p className="mt-0.5 hidden text-[11px] text-muted-foreground md:block">{qty}</p> : null}
      </Link>

      <Link to={href} className="hidden min-w-0 md:block">
        <div className="flex items-center gap-1.5">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="w-8 text-right font-mono text-[11px] tabular text-muted-foreground">{progress}%</span>
        </div>
      </Link>

      <Link to={href} className="hidden text-[12px] tabular text-muted-foreground md:block">
        {formatDate(stage.date_plan_end)}
      </Link>

      <Link to={href} className="hidden truncate text-[12px] text-muted-foreground md:block">
        {stage.responsible?.full_name ?? '—'}
      </Link>

      <Link
        to={href}
        className="flex h-7 w-5 items-center justify-center text-muted-foreground opacity-60 transition group-hover:opacity-100"
        aria-label="Открыть работу"
      >
        <ChevronRight className="h-4 w-4" />
      </Link>
    </div>
  )
}

function ToolsTab({
  objectId,
  canMove,
  issueOpen,
  onIssueOpenChange,
}: {
  objectId: string
  canMove: boolean
  issueOpen: boolean
  onIssueOpenChange: (open: boolean) => void
}) {
  const tools = useObjectTools(objectId)
  const allTools = useTools({ status: 'free', pageSize: 100 })
  const move = useToolMutations().move
  const [selected, setSelected] = useState<string[]>([])

  return (
    <div className="space-y-3">
      {canMove && (tools.data ?? []).some((t) => t.status === 'on_object') ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              move.mutate(
                {
                  toolIds: (tools.data ?? []).filter((t) => t.status === 'on_object').map((t) => t.id),
                  movementType: 'extra_delivery',
                  objectId,
                },
                { onSuccess: () => toast.success('Довоз отмечен'), onError: (e) => toast.error(humanizeError(e)) },
              )
            }
          >
            Довоз всего
          </Button>
        </div>
      ) : null}
      {(tools.data ?? []).length === 0 ? (
        <EmptyState title="На объекте нет инструмента" description="Оформите выдачу из реестра." />
      ) : (
        <div className="grid gap-2">
          {(tools.data ?? []).map((tool) => (
            <div key={tool.id} className="flex items-center justify-between gap-2 rounded-xl border bg-card p-3">
              <Link to={`/tools/${tool.id}`} className="min-w-0 flex-1 hover:underline">
                <p className="truncate font-medium">{tool.name}</p>
                <p className="text-xs text-muted-foreground">
                  {tool.inventory_number ?? 'без номера'} · {tool.holder?.full_name ?? 'без держателя'}
                </p>
              </Link>
              <div className="flex items-center gap-2">
                <ToolStatusBadge status={tool.status} />
                {canMove && tool.status === 'on_object' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      move.mutate(
                        { toolIds: [tool.id], movementType: 'return', objectId },
                        { onSuccess: () => toast.success('Возвращён'), onError: (e) => toast.error(humanizeError(e)) },
                      )
                    }
                  >
                    Вернуть
                  </Button>
                ) : null}
                {canMove && tool.status === 'on_object' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      move.mutate(
                        { toolIds: [tool.id], movementType: 'to_repair', objectId },
                        {
                          onSuccess: () => toast.success('Отправлен в ремонт'),
                          onError: (e) => toast.error(humanizeError(e)),
                        },
                      )
                    }
                  >
                    В ремонт
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={issueOpen} onOpenChange={onIssueOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Выдать инструмент на объект</DialogTitle>
          </DialogHeader>
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
            {(allTools.data?.rows ?? []).map((tool) => {
              const checked = selected.includes(tool.id)
              return (
                <label
                  key={tool.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                    checked
                      ? 'border-primary/35 bg-primary/[0.06]'
                      : 'border-border/80 bg-card hover:bg-muted/30',
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      setSelected((prev) => (v ? [...prev, tool.id] : prev.filter((id) => id !== tool.id)))
                    }
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{tool.name}</span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                    {tool.inventory_number ?? '—'}
                  </span>
                </label>
              )
            })}
            {(allTools.data?.rows ?? []).length === 0 ? (
              <p className="rounded-xl border border-dashed px-3 py-6 text-center text-[13px] text-muted-foreground">
                Нет свободного инструмента для выдачи.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              disabled={selected.length === 0 || move.isPending}
              onClick={() =>
                move.mutate(
                  { toolIds: selected, movementType: 'issue', objectId },
                  {
                    onSuccess: () => {
                      toast.success('Инструмент выдан')
                      onIssueOpenChange(false)
                      setSelected([])
                    },
                    onError: (e) => toast.error(humanizeError(e)),
                  },
                )
              }
            >
              Выдать {selected.length ? `(${selected.length})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MediaTab({ objectId }: { objectId: string }) {
  const files = useAttachments(objectId, ['photo', 'video'])
  const stages = useObjectStages(objectId)
  const [active, setActive] = useState<string | null>(null)

  const grouped = useMemo(() => {
    const map = new Map<string, NonNullable<typeof files.data>>()
    for (const file of files.data ?? []) {
      const key = file.stage_id ?? 'none'
      const list = map.get(key) ?? []
      list.push(file)
      map.set(key, list)
    }
    return map
  }, [files.data])

  return (
    <div className="space-y-4">
      {files.isLoading ? (
        <Skeleton className="h-40" />
      ) : (files.data ?? []).length === 0 ? (
        <EmptyState title="Пока нет фото и видео" description="Загрузите несколько файлов с телефона или компьютера." />
      ) : (
        [...grouped.entries()].map(([key, items]) => (
          <div key={key} className="space-y-2">
            <p className="text-sm font-medium">
              {key === 'none' ? 'Без этапа' : stages.data?.find((s) => s.id === key)?.name ?? 'Этап'}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {items.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  className="overflow-hidden rounded-lg border bg-muted text-left"
                  onClick={() => setActive(file.storage_path)}
                >
                  <Thumb path={file.storage_path} kind={file.kind} name={file.file_name} />
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {active ? <Lightbox path={active} onClose={() => setActive(null)} /> : null}
    </div>
  )
}

function Thumb({ path, kind, name }: { path: string; kind: string; name: string }) {
  const url = useSignedUrl(path, kind !== 'video')
  if (kind === 'video') {
    return <div className="flex aspect-square items-center justify-center p-2 text-center text-xs text-muted-foreground">Видео · {name}</div>
  }
  if (!url.data) return <div className="aspect-square animate-pulse bg-muted" />
  return <img src={url.data} alt={name} className="aspect-square w-full object-cover" />
}

function Lightbox({ path, onClose }: { path: string; onClose: () => void }) {
  const url = useSignedUrl(path, true)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-2">
        {url.data ? <img src={url.data} alt="" className="max-h-[80dvh] w-full rounded-md object-contain" /> : <Skeleton className="h-64" />}
      </DialogContent>
    </Dialog>
  )
}

function DocsTab({ objectId }: { objectId: string }) {
  const files = useAttachments(objectId, ['document'], { excludeExpenseFiles: true })
  return (
    <div className="space-y-3">
      {(files.data ?? []).length === 0 ? (
        <EmptyState title="Документов нет" icon={FileText} />
      ) : (
        <div className="grid gap-2">
          {(files.data ?? []).map((file) => (
            <DocRow key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}

function DocRow({ file }: { file: NonNullable<ReturnType<typeof useAttachments>['data']>[number] }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-medium">{file.file_name}</p>
        <p className="text-xs text-muted-foreground">
          {fileSizeLabel(file.file_size)} · {formatDateTime(file.created_at)}
        </p>
      </div>
      <IconButton
        icon={Download}
        label="Скачать"
        onClick={async () => {
          try {
            const url = await signedUrl(file.storage_path)
            window.open(url, '_blank', 'noopener')
          } catch (error) {
            toast.error(humanizeError(error))
          }
        }}
      />
    </div>
  )
}

function ExpensesTab({
  objectId,
  createOpen,
  onCreateOpenChange,
}: {
  objectId: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}) {
  const { roles } = useAuth()
  const showEco = canSeeEconomics(roles)
  const { page, setPage, pageSize, setPageSize } = useListPaging(objectId)
  const expenses = useExpenses({ objectId, page, pageSize })
  const economics = useObjectEconomics(objectId, showEco)
  const byCategory = useObjectExpensesByCategory(objectId, showEco)
  const byContour = useObjectExpensesByContour(objectId, showEco)
  const cats = useExpenseCategories()
  const stages = useObjectStages(objectId)
  const create = useExpenseMutations().create
  const expenseFiles = useAttachments(objectId, ['document', 'photo'], { onlyExpenseFiles: true })
  const list = expenses.data?.rows ?? []
  const total = expenses.data?.count ?? 0
  const filesByExpense = useMemo(() => {
    const map = new Map<string, NonNullable<typeof expenseFiles.data>[number][]>()
    for (const file of expenseFiles.data ?? []) {
      if (!file.expense_id) continue
      const bucket = map.get(file.expense_id) ?? []
      bucket.push(file)
      map.set(file.expense_id, bucket)
    }
    return map
  }, [expenseFiles.data])
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null)

  const categoryRows = useMemo(() => {
    const rows = (byCategory.data ?? [])
      .map((r) => ({
        name: r.category_name ?? 'Без категории',
        amount: Number(r.amount_total ?? 0),
      }))
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount)
    const sum = rows.reduce((s, r) => s + r.amount, 0)
    return rows.map((r) => ({
      ...r,
      share: sum > 0 ? (r.amount / sum) * 100 : 0,
    }))
  }, [byCategory.data])

  const contourRows = useMemo(() => {
    const map = new Map<string | null, number>()
    for (const r of byContour.data ?? []) {
      map.set(r.stage_type, Number(r.amount_total ?? 0))
    }
    const order: Array<{ key: string | null; label: string }> = [
      { key: 'production', label: STAGE_TYPE_LABELS.production },
      { key: 'installation', label: STAGE_TYPE_LABELS.installation },
      { key: null, label: 'Общие по объекту' },
    ]
    const rows = order
      .map((o) => ({
        label: o.label,
        amount: map.get(o.key) ?? 0,
      }))
      .filter((r) => r.amount > 0)
    const sum = rows.reduce((s, r) => s + r.amount, 0)
    return rows.map((r) => ({
      ...r,
      share: sum > 0 ? (r.amount / sum) * 100 : 0,
    }))
  }, [byContour.data])

  return (
    <div className="space-y-3">
      {showEco ? (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="border-b border-border/70 px-3.5 py-2.5">
            <h2 className="text-[13px] font-semibold tracking-tight">Экономика объекта</h2>
          </div>
          <div className="space-y-3 p-3.5">
            {economics.isLoading || byCategory.isLoading || byContour.isLoading ? (
              <Skeleton className="h-28 w-full" />
            ) : economics.isError ? (
              <ErrorState
                message={humanizeError(economics.error)}
                onRetry={() => {
                  void economics.refetch()
                  void byCategory.refetch()
                  void byContour.refetch()
                }}
              />
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <EcoKpi label="Сумма договора">
                    <Money value={economics.data?.contract_amount ?? 0} />
                  </EcoKpi>
                  <EcoKpi label="Расходы всего">
                    <Money value={economics.data?.expenses_total ?? 0} />
                  </EcoKpi>
                  <EcoKpi label="Прибыль">
                    <Money value={economics.data?.profit ?? 0} signed />
                  </EcoKpi>
                  <EcoKpi label="Маржа">
                    {!Number(economics.data?.contract_amount ?? 0) ? (
                      <span className="text-[13px] text-muted-foreground">Сумма договора не указана</span>
                    ) : (
                      <span className="font-mono tabular text-[13px] font-medium">
                        {formatPercent(economics.data?.margin_percent)}
                      </span>
                    )}
                  </EcoKpi>
                </div>

                {categoryRows.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">По категориям</p>
                    <ul className="divide-y divide-border/70 rounded-lg border border-border/70">
                      {categoryRows.map((row) => (
                        <li key={row.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                          <span className="min-w-0 truncate">{row.name}</span>
                          <span className="flex shrink-0 items-baseline gap-2">
                            <Money value={row.amount} />
                            <span className="w-12 text-right font-mono text-xs tabular text-muted-foreground">
                              {formatPercent(row.share)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {contourRows.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[12px] font-medium text-muted-foreground">По контурам</p>
                    <ul className="divide-y divide-border/70 rounded-lg border border-border/70">
                      {contourRows.map((row) => (
                        <li key={row.label} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                          <span className="min-w-0 truncate">{row.label}</span>
                          <span className="flex shrink-0 items-baseline gap-2">
                            <Money value={row.amount} />
                            <span className="w-12 text-right font-mono text-xs tabular text-muted-foreground">
                              {formatPercent(row.share)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {list.length === 0 ? (
        <EmptyState title="Расходов пока нет" />
      ) : (
        <>
          <div className="grid gap-1.5">
            {list.map((row) => {
              const files = filesByExpense.get(row.id) ?? []
              const expanded = expandedExpenseId === row.id
              return (
                <div key={row.id} className="rounded-xl border bg-card px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{row.category?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(row.expense_date)} · {row.stage?.name ?? 'Общие'} · {row.vendor ?? '—'}
                      </p>
                      {row.description ? <p className="mt-0.5 text-sm">{row.description}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {files.length > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1 px-2 text-xs"
                          onClick={() => setExpandedExpenseId(expanded ? null : row.id)}
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          {files.length}
                          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </Button>
                      ) : null}
                      <Money value={row.amount} />
                    </div>
                  </div>
                  {expanded && files.length > 0 ? (
                    <div className="mt-2 grid gap-1.5 border-t border-border/70 pt-2">
                      {files.map((file) => (
                        <DocRow key={file.id} file={file} />
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
      <ExpenseDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        categories={cats.data ?? []}
        stages={stages.data ?? []}
        pending={create.isPending}
        onSubmit={async (values, files) => {
          try {
            const created = await create.mutateAsync({ ...values, object_id: objectId })
            let failed = 0
            for (const file of files) {
              try {
                await uploadObjectFile({ file, objectId, expenseId: created.id })
              } catch {
                failed += 1
              }
            }
            if (files.length > 0 && failed > 0) {
              toast.success('Расход добавлен, файл не загружен')
            } else {
              toast.success('Расход добавлен')
            }
            onCreateOpenChange(false)
            void expenseFiles.refetch()
          } catch (e) {
            toast.error(humanizeError(e))
          }
        }}
      />
    </div>
  )
}

function EcoKpi({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-0.5 font-medium">{children}</div>
    </div>
  )
}

function ExpenseDialog({
  open,
  onOpenChange,
  categories,
  stages,
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: { id: string; name: string; is_active: boolean }[]
  stages: { id: string; name: string }[]
  pending?: boolean
  onSubmit: (
    values: {
      category_id: string
      amount: number
      expense_date: string
      description?: string
      vendor?: string
      stage_id?: string | null
    },
    files: File[],
  ) => void | Promise<void>
}) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [stageId, setStageId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const busy = pending || saving

  useEffect(() => {
    if (!open) {
      setAmount('')
      setDate('')
      setDescription('')
      setVendor('')
      setStageId('')
      setFiles([])
      setCategoryId(categories[0]?.id ?? '')
    }
  }, [open, categories])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый расход</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Field label="Категория">
            <Select value={categoryId || undefined} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Категория" />
              </SelectTrigger>
              <SelectContent>
                {categories.filter((c) => c.is_active).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Сумма, ₽">
            <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Дата">
            <DatePicker value={date} onChange={setDate} clearable={false} />
          </Field>
          <Field label="Этап (необязательно)">
            <Select value={stageId || 'none'} onValueChange={(v) => setStageId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Общие по объекту" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Общие по объекту</SelectItem>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Кому оплачено">
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <Field label="Описание">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Чек или документ">
            <Input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic"
              disabled={busy}
              onChange={(e) => {
                setFiles(Array.from(e.target.files ?? []))
                e.target.value = ''
              }}
            />
            {files.length > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Выбрано: {files.map((f) => f.name).join(', ')}
              </p>
            ) : null}
          </Field>
        </div>
        <DialogFooter>
          <Button
            disabled={busy || !categoryId || !amount}
            onClick={() => {
              void (async () => {
                setSaving(true)
                try {
                  await onSubmit(
                    {
                      category_id: categoryId,
                      amount: Number(amount),
                      expense_date: date || todayISO(),
                      description: description || undefined,
                      vendor: vendor || undefined,
                      stage_id: stageId || null,
                    },
                    files,
                  )
                } finally {
                  setSaving(false)
                }
              })()
            }}
          >
            {busy ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RequestsTab({
  objectId,
  createOpen,
  onCreateOpenChange,
}: {
  objectId: string
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const [showDone, setShowDone] = useState(false)
  const { page, setPage, pageSize, setPageSize } = useListPaging(`${objectId}:${showDone}`)
  const rows = useMaterialRequests({ objectId, done: showDone, page, pageSize })
  const mut = useRequestMutations()
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [needBy, setNeedBy] = useState('')
  const list = rows.data?.rows ?? []
  const total = rows.data?.count ?? 0

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant={showDone ? 'default' : 'outline'}
          onClick={() => setShowDone((v) => !v)}
        >
          Выполненные
        </Button>
      </div>
      {list.length === 0 ? (
        <EmptyState title={showDone ? 'Выполненных задач нет' : 'Открытых задач нет'} />
      ) : (
        <>
          <div className="grid gap-1.5">
            {list.map((row) => (
              <div key={row.id} className="rounded-xl border bg-card px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.need_by ? `к ${formatDate(row.need_by)}` : 'Без срока'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {showDone ? <RequestStatusBadge status={row.status} /> : null}
                    {!showDone ? (
                      <IconButton
                        icon={Check}
                        label="Выполнить"
                        onClick={() =>
                          mut.complete.mutate(
                            { id: row.id, userId: user?.id },
                            {
                              onSuccess: () => toast.success('Выполнено'),
                              onError: (e) => toast.error(humanizeError(e)),
                            },
                          )
                        }
                      />
                    ) : null}
                    <IconButton
                      icon={Trash2}
                      label="Удалить"
                      variant="destructive"
                      onClick={() =>
                        mut.softDelete.mutate(row.id, {
                          onSuccess: () => toast.success('Удалено'),
                          onError: (e) => toast.error(humanizeError(e)),
                        })
                      }
                    />
                  </div>
                </div>
                {row.details ? <p className="mt-1 whitespace-pre-wrap text-sm">{row.details}</p> : null}
              </div>
            ))}
          </div>
          <ListPagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </>
      )}
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая задача</DialogTitle>
          </DialogHeader>
          <Field label="Что сделать">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Подробности">
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <Field label="Срок">
            <DatePicker value={needBy} onChange={setNeedBy} />
          </Field>
          <DialogFooter>
            <Button
              disabled={!title.trim() || mut.create.isPending}
              onClick={() =>
                mut.create.mutate(
                  {
                    object_id: objectId,
                    title: title.trim(),
                    details: details.trim() || null,
                    need_by: needBy || null,
                  },
                  {
                    onSuccess: () => {
                      toast.success('Задача создана')
                      onCreateOpenChange(false)
                      setTitle('')
                      setDetails('')
                      setNeedBy('')
                    },
                    onError: (e) => toast.error(humanizeError(e)),
                  },
                )
              }
            >
              Создать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MembersTab({ objectId, owner }: { objectId: string; owner: boolean }) {
  const members = useObjectMembers(objectId)
  const profiles = useProfiles()
  const [userId, setUserId] = useState('')

  return (
    <div className="space-y-2">
      {owner ? (
        <div className="flex gap-2">
          <Select value={userId || undefined} onValueChange={setUserId}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Выберите сотрудника" />
            </SelectTrigger>
            <SelectContent>
              {(profiles.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <IconButton
            icon={Plus}
            label="Добавить"
            variant="default"
            size="default"
            disabled={!userId}
            onClick={async () => {
              const { error } = await supabase.from('object_members').insert({ object_id: objectId, user_id: userId })
              if (error) toast.error(humanizeError(error))
              else {
                toast.success('Участник добавлен')
                void members.refetch()
                setUserId('')
              }
            }}
          />
        </div>
      ) : null}
      {(members.data ?? []).length === 0 ? (
        <EmptyState title="Участников нет" description="Бригадир видит объект только после добавления сюда." />
      ) : (
        <div className="grid gap-1.5">
          {(members.data ?? []).map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-xl border bg-card px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{m.profile?.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.profile?.position ?? m.profile?.phone}</p>
              </div>
              {owner ? (
                <IconButton
                  icon={Trash2}
                  label="Убрать"
                  variant="destructive"
                  onClick={async () => {
                    const { error } = await supabase.from('object_members').delete().eq('id', m.id)
                    if (error) toast.error(humanizeError(error))
                    else void members.refetch()
                  }}
                />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryTab({ objectId }: { objectId: string }) {
  const { page, setPage, pageSize, setPageSize } = useListPaging(objectId)
  const activity = useActivity(objectId, { page, pageSize })
  const profiles = useProfileMap()
  if (activity.isLoading) return <Skeleton className="h-40" />
  const rows = activity.data?.rows ?? []
  const total = activity.data?.count ?? 0
  return (
    <div>
      <ActivityList rows={rows} names={profiles.data} />
      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  )
}

function ActivityList({
  rows,
  names,
}: {
  rows: { id: string; action: string; entity_type: string; created_at: string; created_by: string | null; payload: unknown }[]
  names?: Map<string, { full_name: string }>
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Пока нет событий.</p>
  return (
    <ol className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="border-l-2 border-primary/30 pl-3">
          <p className="text-sm font-medium">
            {ACTIVITY_ACTION_LABELS[row.action] ?? row.action} · {ACTIVITY_ENTITY_LABELS[row.entity_type] ?? row.entity_type}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(row.created_at)} ·{' '}
            {row.created_by
              ? (names instanceof Map ? names.get(row.created_by)?.full_name : undefined) ?? 'сотрудник'
              : 'система'}
          </p>
        </li>
      ))}
    </ol>
  )
}
