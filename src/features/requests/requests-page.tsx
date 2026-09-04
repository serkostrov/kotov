import { useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { DatePicker } from '@/components/date-picker'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { IconButton } from '@/components/icon-button'
import { ListPagination, useListPaging } from '@/components/list-pagination'
import { Field, PageHeader } from '@/components/page-header'
import { RequestStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/features/auth/auth-provider'
import { useMaterialRequests, useRequestMutations } from '@/hooks/use-finance'
import { useObjects } from '@/hooks/use-objects'
import { humanizeError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

export function RequestsPage() {
  const { user } = useAuth()
  const [showDone, setShowDone] = useState(false)
  const [objectId, setObjectId] = useState<string | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [formObjectId, setFormObjectId] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [needBy, setNeedBy] = useState('')
  const { page, setPage, pageSize, setPageSize } = useListPaging(`${showDone}:${objectId}`)
  const rows = useMaterialRequests({ objectId, done: showDone, page, pageSize })
  const objects = useObjects({ pageSize: 200 })
  const mut = useRequestMutations()

  const resetForm = () => {
    setFormObjectId('')
    setTitle('')
    setDetails('')
    setNeedBy('')
  }

  if (rows.isError) return <ErrorState message={humanizeError(rows.error)} onRetry={() => void rows.refetch()} />

  const list = rows.data?.rows ?? []
  const total = rows.data?.count ?? 0

  return (
    <div>
      <PageHeader
        title="Задачи"
        description="Простые задачи: выполнить или удалить."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Новая задача
          </Button>
        }
      />
      <FilterBar
        trailing={
          <Button
            type="button"
            variant={showDone ? 'default' : 'outline'}
            className={cn('h-9', !showDone && 'bg-background')}
            onClick={() => setShowDone((v) => !v)}
          >
            Выполненные
          </Button>
        }
      >
        <Select value={objectId} onValueChange={setObjectId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все объекты</SelectItem>
            {(objects.data?.rows ?? []).map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterBar>

      {rows.isLoading ? (
        <Skeleton className="h-40" />
      ) : list.length === 0 ? (
        <EmptyState title={showDone ? 'Выполненных задач нет' : 'Открытых задач нет'} />
      ) : (
        <>
          <div className="grid gap-1.5">
            {list.map((row) => (
              <Card key={row.id}>
                <CardContent className="space-y-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{row.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[row.object?.name, row.need_by ? `к ${formatDate(row.need_by)}` : null]
                          .filter(Boolean)
                          .join(' · ') || 'Без срока'}
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
                  {row.details ? <p className="whitespace-pre-wrap text-sm">{row.details}</p> : null}
                </CardContent>
              </Card>
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новая задача</DialogTitle>
          </DialogHeader>
          <Field label="Объект">
            <Select value={formObjectId || undefined} onValueChange={setFormObjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите объект" />
              </SelectTrigger>
              <SelectContent>
                {(objects.data?.rows ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
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
              disabled={!formObjectId || !title.trim() || mut.create.isPending}
              onClick={() =>
                mut.create.mutate(
                  {
                    object_id: formObjectId,
                    title: title.trim(),
                    details: details.trim() || null,
                    need_by: needBy || null,
                  },
                  {
                    onSuccess: () => {
                      toast.success('Задача создана')
                      setCreateOpen(false)
                      resetForm()
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
