import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { DatePicker } from '@/components/date-picker'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { FilterBar } from '@/components/filter-bar'
import { IconButton } from '@/components/icon-button'
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
import type { RequestStatus } from '@/lib/database.types'
import { REQUEST_STATUS_LABELS } from '@/lib/dictionaries'
import { humanizeError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { isOwner } from '@/lib/roles'

export function RequestsPage() {
  const { roles, user } = useAuth()
  const owner = isOwner(roles)
  const [status, setStatus] = useState<RequestStatus | 'all'>('all')
  const [objectId, setObjectId] = useState<string | 'all'>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [formObjectId, setFormObjectId] = useState('')
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [needBy, setNeedBy] = useState('')
  const rows = useMaterialRequests({ status, objectId })
  const objects = useObjects({ pageSize: 200 })
  const mut = useRequestMutations()

  const resetForm = () => {
    setFormObjectId('')
    setTitle('')
    setDetails('')
    setNeedBy('')
  }

  if (rows.isError) return <ErrorState message={humanizeError(rows.error)} onRetry={() => void rows.refetch()} />

  return (
    <div>
      <PageHeader
        title="Заявки"
        description="Любой сотрудник может создать заявку, руководитель согласовывает."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Новая заявка
          </Button>
        }
      />
      <FilterBar>
        <Select value={status} onValueChange={(v) => setStatus(v as RequestStatus | 'all')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {(Object.keys(REQUEST_STATUS_LABELS) as RequestStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {REQUEST_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      ) : (rows.data ?? []).length === 0 ? (
        <EmptyState title="Заявок нет" />
      ) : (
        <div className="grid gap-1.5">
          {(rows.data ?? []).map((row) => (
            <Card key={row.id}>
              <CardContent className="space-y-1.5 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{row.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.object?.name} · к {formatDate(row.need_by)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <RequestStatusBadge status={row.status} />
                    {owner && row.status === 'new' ? (
                      <>
                        <IconButton
                          icon={Check}
                          label="Согласовать"
                          onClick={() =>
                            mut.update.mutate(
                              {
                                id: row.id,
                                values: { status: 'approved', resolved_by: user?.id, resolved_at: new Date().toISOString() },
                              },
                              { onSuccess: () => toast.success('Согласовано'), onError: (e) => toast.error(humanizeError(e)) },
                            )
                          }
                        />
                        <IconButton
                          icon={X}
                          label="Отклонить"
                          onClick={() =>
                            mut.update.mutate(
                              {
                                id: row.id,
                                values: { status: 'rejected', resolved_by: user?.id, resolved_at: new Date().toISOString() },
                              },
                              { onSuccess: () => toast.success('Отклонено'), onError: (e) => toast.error(humanizeError(e)) },
                            )
                          }
                        />
                      </>
                    ) : null}
                  </div>
                </div>
                {row.details ? <p className="whitespace-pre-wrap text-sm">{row.details}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
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
            <DialogTitle>Новая заявка</DialogTitle>
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
          <Field label="Что нужно">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Список позиций">
            <Textarea value={details} onChange={(e) => setDetails(e.target.value)} />
          </Field>
          <Field label="Нужно к">
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
                      toast.success('Заявка создана')
                      setCreateOpen(false)
                      resetForm()
                    },
                    onError: (e) => toast.error(humanizeError(e)),
                  },
                )
              }
            >
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
