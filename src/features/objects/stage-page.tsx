import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Trash2, Upload, X } from 'lucide-react'
import { BackLink } from '@/components/back-link'
import { CompactProgress } from '@/components/dual-progress'
import { DatePicker } from '@/components/date-picker'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Money } from '@/components/money'
import { StageStatusBadge } from '@/components/status-badge'
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-provider'
import { useObjectStage, useProfiles } from '@/hooks/use-objects'
import { useAttachments, useExpenses, useSignedUrl } from '@/hooks/use-finance'
import type { StageStatus } from '@/lib/database.types'
import { STAGE_STATUS_LABELS, STAGE_TYPE_LABELS } from '@/lib/dictionaries'
import { humanizeError } from '@/lib/errors'
import { formatDate, formatDateTime } from '@/lib/format'
import { canManageStages, canUpdateInstallation, canUpdateProduction, isOwner } from '@/lib/roles'
import { formatStageVolume, resolveStageMetrics } from '@/lib/stage-progress'
import { supabase } from '@/lib/supabase'
import { uploadObjectFile } from '@/lib/upload'
import { cn } from '@/lib/utils'

export function StagePage() {
  const { id: objectId, stageId } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const { roles } = useAuth()
  const stageQuery = useObjectStage(stageId)
  const profiles = useProfiles()
  const media = useAttachments(objectId, ['photo', 'video'])
  const expenses = useExpenses({ objectId, stageId, pageSize: 100 })

  const stage = stageQuery.data
  const canEdit =
    Boolean(stage) &&
    (isOwner(roles) ||
      (stage?.stage_type === 'production' && canUpdateProduction(roles)) ||
      (stage?.stage_type === 'installation' && canUpdateInstallation(roles)))
  const canDelete = Boolean(stage) && canManageStages(roles)

  const [editing, setEditing] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [status, setStatus] = useState<StageStatus>('not_started')
  const [comment, setComment] = useState('')
  const [qtyPlan, setQtyPlan] = useState('')
  const [qtyFact, setQtyFact] = useState('')
  const [unit, setUnit] = useState('')
  const [dateStart, setDateStart] = useState('')
  const [datePlanEnd, setDatePlanEnd] = useState('')
  const [dateFactEnd, setDateFactEnd] = useState('')
  const [responsibleId, setResponsibleId] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (!stage || editing) return
    setStatus(stage.status)
    setComment(stage.comment ?? '')
    setQtyPlan(stage.qty_plan != null ? String(stage.qty_plan) : '')
    setQtyFact(stage.qty_fact != null ? String(stage.qty_fact) : '')
    setUnit(stage.unit ?? '')
    setDateStart(stage.date_start ?? '')
    setDatePlanEnd(stage.date_plan_end ?? '')
    setDateFactEnd(stage.date_fact_end ?? '')
    setResponsibleId(stage.responsible_id ?? '')
  }, [stage, editing])

  useEffect(() => {
    setEditing(false)
  }, [stageId])

  const stageMedia = useMemo(
    () => (media.data ?? []).filter((f) => f.stage_id === stageId),
    [media.data, stageId],
  )

  if (stageQuery.isLoading) return <Skeleton className="h-64 w-full rounded-xl" />
  if (stageQuery.isError) {
    return <ErrorState message={humanizeError(stageQuery.error)} onRetry={() => void stageQuery.refetch()} />
  }
  if (!stage || !objectId) {
    return <EmptyState title="Работа не найдена" description="Возможно, этап удалён или нет доступа." />
  }

  if (stage.object_id !== objectId) {
    navigate(`/objects/${stage.object_id}/stages/${stage.id}`, { replace: true })
    return null
  }

  const tab = stage.stage_type === 'production' ? 'production' : 'installation'
  const backTo = `/objects/${objectId}?tab=${tab}`
  const objectName = stage.object?.name ?? 'Объект'
  const responsibleName =
    (editing
      ? profiles.data?.find((p) => p.id === responsibleId)?.full_name
      : stage.responsible?.full_name) ?? 'Не назначен'

  const cancelEdit = () => {
    setStatus(stage.status)
    setComment(stage.comment ?? '')
    setQtyPlan(stage.qty_plan != null ? String(stage.qty_plan) : '')
    setQtyFact(stage.qty_fact != null ? String(stage.qty_fact) : '')
    setUnit(stage.unit ?? '')
    setDateStart(stage.date_start ?? '')
    setDatePlanEnd(stage.date_plan_end ?? '')
    setDateFactEnd(stage.date_fact_end ?? '')
    setResponsibleId(stage.responsible_id ?? '')
    setEditing(false)
  }

  const applyVolume = (nextPlan: string, nextFact: string, nextStatus: StageStatus = status) => {
    const resolved = resolveStageMetrics({
      status: nextStatus,
      qtyPlan: parseQty(nextPlan),
      qtyFact: parseQty(nextFact),
    })
    setQtyPlan(nextPlan)
    setQtyFact(nextFact)
    setStatus(resolved.status)
  }

  const save = async () => {
    setPending(true)
    try {
      const plan = parseQty(qtyPlan)
      const fact = parseQty(qtyFact)
      const resolved = resolveStageMetrics({ status, qtyPlan: plan, qtyFact: fact })
      const { error } = await supabase
        .from('object_stages')
        .update({
          status: resolved.status,
          progress_percent: resolved.progress,
          comment: comment.trim() || null,
          unit: unit.trim() || null,
          qty_plan: plan,
          qty_fact: fact,
          date_start: dateStart || null,
          date_plan_end: datePlanEnd || null,
          date_fact_end: dateFactEnd || null,
          responsible_id: responsibleId || null,
        })
        .eq('id', stage.id)
      if (error) throw error
      setStatus(resolved.status)
      toast.success('Сохранено')
      setEditing(false)
      void client.invalidateQueries({ queryKey: ['object-stage'] })
      void client.invalidateQueries({ queryKey: ['object-stages'] })
      void client.invalidateQueries({ queryKey: ['object-progress'] })
      void client.invalidateQueries({ queryKey: ['activity'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
      void stageQuery.refetch()
    } catch (error) {
      toast.error(humanizeError(error))
    } finally {
      setPending(false)
    }
  }

  const removeStage = async () => {
    setPending(true)
    try {
      const { error } = await supabase
        .from('object_stages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', stage.id)
      if (error) throw error
      toast.success('Работа удалена')
      void client.invalidateQueries({ queryKey: ['object-stages'] })
      void client.invalidateQueries({ queryKey: ['object-progress'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(backTo)
    } catch (error) {
      toast.error(humanizeError(error))
    } finally {
      setPending(false)
      setDeleteOpen(false)
    }
  }

  const onUpload = async (fileList: FileList | null) => {
    const list = fileList ? Array.from(fileList) : []
    if (list.length === 0) return
    let ok = 0
    try {
      for (const file of list) {
        await uploadObjectFile({ file, objectId, stageId: stage.id })
        ok += 1
      }
      toast.success(ok === 1 ? 'Файл загружен' : `Загружено файлов: ${ok}`)
      void media.refetch()
    } catch (error) {
      toast.error(ok > 0 ? `Загружено ${ok} из ${list.length}. ${humanizeError(error)}` : humanizeError(error))
      if (ok > 0) void media.refetch()
    }
  }

  const liveMetrics = resolveStageMetrics({
    status: editing ? status : stage.status,
    qtyPlan: editing ? parseQty(qtyPlan) : stage.qty_plan,
    qtyFact: editing ? parseQty(qtyFact) : stage.qty_fact,
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <BackLink to={backTo} label={STAGE_TYPE_LABELS[stage.stage_type]} />
          <h1 className="text-xl font-bold tracking-tight sm:text-[1.35rem]">{stage.name}</h1>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
            {objectName}
            {stage.object?.address ? ` · ${stage.object.address}` : ''}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {canDelete && !editing ? (
            <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 />
              Удалить
            </Button>
          ) : null}
          {canEdit ? (
            editing ? (
              <>
                <Button variant="outline" disabled={pending} onClick={cancelEdit}>
                  <X />
                  Отмена
                </Button>
                <Button disabled={pending} onClick={() => void save()}>
                  <Check />
                  Сохранить
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil />
                Редактировать
              </Button>
            )
          ) : null}
        </div>
      </div>

      <CompactProgress value={liveMetrics.progress} className="w-full" />

      <section className="overflow-hidden rounded-xl border border-border/80 bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-border/70 px-3.5 py-2.5">
          <h2 className="text-[13px] font-semibold tracking-tight">Параметры</h2>
          {editing ? (
            <Select
              value={status}
              onValueChange={(v) => {
                const next = v as StageStatus
                const resolved = resolveStageMetrics({
                  status: next,
                  qtyPlan: parseQty(qtyPlan),
                  qtyFact: parseQty(qtyFact),
                })
                // Honor explicit done/blocked; otherwise keep volume-derived status.
                setStatus(next === 'done' || next === 'blocked' ? next : resolved.status)
              }}
            >
              <SelectTrigger className="h-8 w-[10.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STAGE_STATUS_LABELS) as StageStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StageStatusBadge status={liveMetrics.status} />
          )}
        </div>

        <div className="grid gap-px bg-border/60 sm:grid-cols-2 lg:grid-cols-3">
          {editing ? (
            <>
              <ParamCell label="Ответственный">
                <Select
                  value={responsibleId || 'none'}
                  onValueChange={(v) => setResponsibleId(v === 'none' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не назначен</SelectItem>
                    {(profiles.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </ParamCell>
              <ParamCell label="Объём">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    step="0.01"
                    className="min-w-0 flex-1 tabular"
                    placeholder="Факт"
                    value={qtyFact}
                    onChange={(e) => applyVolume(qtyPlan, e.target.value)}
                    aria-label="Объём факт"
                  />
                  <span className="shrink-0 text-[12px] text-muted-foreground">из</span>
                  <Input
                    type="number"
                    step="0.01"
                    className="min-w-0 flex-1 tabular"
                    placeholder="План"
                    value={qtyPlan}
                    onChange={(e) => applyVolume(e.target.value, qtyFact)}
                    aria-label="Объём план"
                  />
                </div>
              </ParamCell>
              <ParamCell label="Ед. изм.">
                <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="шт, м, т…" />
              </ParamCell>
              <ParamCell label="Начало">
                <DatePicker value={dateStart} onChange={setDateStart} />
              </ParamCell>
              <ParamCell label="План завершения">
                <DatePicker value={datePlanEnd} onChange={setDatePlanEnd} />
              </ParamCell>
              <ParamCell label="Факт завершения">
                <DatePicker value={dateFactEnd} onChange={setDateFactEnd} />
              </ParamCell>
              <ParamCell label="Комментарий" className="sm:col-span-2 lg:col-span-3">
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="min-h-[76px] resize-y"
                />
              </ParamCell>
            </>
          ) : (
            <>
              <ViewRow label="Ответственный" value={responsibleName} />
              <ViewRow label="Объём" value={formatStageVolume(stage.qty_fact, stage.qty_plan, stage.unit) ?? '—'} />
              <ViewRow label="Ед. изм." value={stage.unit?.trim() || '—'} />
              <ViewRow label="Старт" value={formatDate(stage.date_start)} />
              <ViewRow label="План завершения" value={formatDate(stage.date_plan_end)} />
              <ViewRow label="Факт завершения" value={formatDate(stage.date_fact_end)} />
              <ViewRow
                label="Комментарий"
                value={stage.comment?.trim() || '—'}
                className="sm:col-span-2 lg:col-span-3"
              />
            </>
          )}
        </div>
      </section>

      <div className="grid items-stretch gap-3 lg:grid-cols-2">
        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="flex min-h-10 items-center justify-between gap-2 border-b border-border/70 px-3.5">
            <h2 className="text-[13px] font-semibold tracking-tight">Фото и видео</h2>
            {canEdit ? (
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void onUpload(e.target.files)
                    e.target.value = ''
                  }}
                />
                <span className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border/90 bg-card px-2.5 text-xs font-medium transition-colors hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" />
                  Загрузить
                </span>
              </label>
            ) : null}
          </div>
          <div className="flex flex-1 flex-col p-3.5">
            {stageMedia.length === 0 ? (
              <EmptyBlock text="Пока нет файлов по этой работе" />
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {stageMedia.map((file) => (
                  <StageMediaThumb key={file.id} path={file.storage_path} name={file.file_name} kind={file.kind} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex h-full flex-col overflow-hidden rounded-xl border border-border/80 bg-card">
          <div className="flex min-h-10 items-center justify-between gap-2 border-b border-border/70 px-3.5">
            <h2 className="text-[13px] font-semibold tracking-tight">Расходы</h2>
            {(expenses.data?.rows ?? []).length > 0 ? (
              <Money value={expenses.data?.pageTotal ?? 0} className="text-[13px] font-semibold" />
            ) : null}
          </div>
          <div className="flex flex-1 flex-col p-3.5">
            {(expenses.data?.rows ?? []).length === 0 ? (
              <EmptyBlock text="Расходов на эту работу нет" />
            ) : (
              <ul className="divide-y divide-border/70 rounded-lg border border-border/70">
                {(expenses.data?.rows ?? []).map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">
                        {row.description || row.category?.name || 'Расход'}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(row.expense_date)}
                        {row.category?.name ? ` · ${row.category.name}` : ''}
                      </p>
                    </div>
                    <Money value={row.amount} className="shrink-0 text-[13px] font-semibold" />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <p className="text-[11px] text-muted-foreground">Обновлено {formatDateTime(stage.updated_at)}</p>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить работу?</AlertDialogTitle>
            <AlertDialogDescription>
              «{stage.name}» будет убрана с объекта. Это действие можно отменить только через поддержку базы.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={() => void removeStage()}>
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function parseQty(value: string) {
  if (value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function ViewRow({
  label,
  value,
  className,
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-card px-3.5 py-2.5', className)}>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-[13px] font-medium leading-snug">{value}</dd>
    </div>
  )
}

function ParamCell({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('bg-card px-3.5 py-2.5', className)}>
      <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="flex min-h-[88px] flex-1 items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-6 text-center text-[13px] text-muted-foreground">
      {text}
    </div>
  )
}

function StageMediaThumb({ path, name, kind }: { path: string; name: string; kind: string }) {
  const url = useSignedUrl(path, true)
  return (
    <a
      href={url.data}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'group relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-muted/30',
        !url.data && 'pointer-events-none',
      )}
      title={name}
    >
      {kind === 'video' ? (
        <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">Видео</div>
      ) : url.data ? (
        <img src={url.data} alt={name} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.03]" />
      ) : (
        <Skeleton className="h-full w-full" />
      )}
    </a>
  )
}
