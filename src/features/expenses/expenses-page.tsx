import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download } from 'lucide-react'
import { DatePicker } from '@/components/date-picker'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { FilterBar, FilterStat } from '@/components/filter-bar'
import { IconButton } from '@/components/icon-button'
import { Money } from '@/components/money'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useExpenseCategories, useObjects, useProfiles } from '@/hooks/use-objects'
import { useExpenses } from '@/hooks/use-finance'
import { useProfileMap } from '@/hooks/use-profile-map'
import { downloadCsv, toCsv } from '@/lib/csv'
import { STAGE_TYPE_LABELS } from '@/lib/dictionaries'
import { humanizeError } from '@/lib/errors'
import { formatDate, todayISO } from '@/lib/format'

export function ExpensesPage() {
  const [objectId, setObjectId] = useState<string | 'all'>('all')
  const [categoryId, setCategoryId] = useState<string | 'all'>('all')
  const [authorId, setAuthorId] = useState<string | 'all'>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const expenses = useExpenses({ objectId, categoryId, authorId, from: from || undefined, to: to || undefined, pageSize: 200 })
  const objects = useObjects({ pageSize: 200 })
  const cats = useExpenseCategories()
  const people = useProfiles()
  const names = useProfileMap()

  const total = useMemo(
    () => (expenses.data?.rows ?? []).reduce((s, r) => s + Number(r.amount), 0),
    [expenses.data],
  )
  const count = expenses.data?.rows.length ?? 0

  if (expenses.isError) return <ErrorState message={humanizeError(expenses.error)} onRetry={() => void expenses.refetch()} />

  return (
    <div>
      <PageHeader
        title="Расходы"
        description="Сквозной реестр по всем доступным объектам"
        actions={
          <IconButton
            icon={Download}
            label="Экспорт CSV"
            size="default"
            onClick={() => {
              const csv = toCsv(
                (expenses.data?.rows ?? []).map((r) => ({
                  date: r.expense_date,
                  object: r.object?.name,
                  category: r.category?.name,
                  stage: r.stage?.name ?? 'Общие',
                  contour: r.stage?.stage_type ? STAGE_TYPE_LABELS[r.stage.stage_type] : 'Общие',
                  vendor: r.vendor,
                  description: r.description,
                  amount: r.amount,
                  author: r.created_by ? names.data?.get(r.created_by)?.full_name : '',
                })),
                [
                  { key: 'date', header: 'Дата' },
                  { key: 'object', header: 'Объект' },
                  { key: 'category', header: 'Категория' },
                  { key: 'stage', header: 'Этап' },
                  { key: 'contour', header: 'Контур' },
                  { key: 'vendor', header: 'Контрагент' },
                  { key: 'description', header: 'Описание' },
                  { key: 'amount', header: 'Сумма' },
                  { key: 'author', header: 'Автор' },
                ],
              )
              downloadCsv(`rashody-${todayISO()}.csv`, csv)
            }}
          />
        }
      />

      <FilterBar
        trailing={
          <FilterStat label="Итог">
            <Money value={total} />
          </FilterStat>
        }
      >
        <Select value={objectId} onValueChange={setObjectId}>
          <SelectTrigger aria-label="Объект">
            <SelectValue placeholder="Объект" />
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
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger aria-label="Категория">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {(cats.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={authorId} onValueChange={setAuthorId}>
          <SelectTrigger aria-label="Автор">
            <SelectValue placeholder="Автор" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все авторы</SelectItem>
            {(people.data ?? []).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <DatePicker value={from} onChange={setFrom} placeholder="С даты" aria-label="С даты" />
        <DatePicker value={to} onChange={setTo} placeholder="По дату" aria-label="По дату" />
      </FilterBar>

      {expenses.isLoading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : count === 0 ? (
        <EmptyState title="Расходов нет" description="Измените фильтры или добавьте расход в карточке объекта." />
      ) : (
        <>
          <p className="mb-2 text-xs text-muted-foreground">
            Найдено: <span className="font-medium text-foreground">{count}</span>
          </p>
          <div className="grid gap-1.5 md:hidden">
            {(expenses.data?.rows ?? []).map((row) => (
              <Link key={row.id} to={`/objects/${row.object_id}?tab=expenses`} className="block">
                <Card className="transition-colors hover:border-primary/30 hover:bg-accent/30">
                  <CardContent className="space-y-1 p-3">
                    <div className="flex justify-between gap-2">
                      <p className="truncate text-[13px] font-medium">{row.object?.name}</p>
                      <Money value={row.amount} className="shrink-0 font-semibold" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(row.expense_date)} · {row.category?.name}
                      {row.stage?.name ? ` · ${row.stage.name}` : ''}
                    </p>
                    {row.description || row.vendor ? (
                      <p className="truncate text-[13px] text-muted-foreground">{row.description ?? row.vendor}</p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card/90 md:block">
            <table className="w-full text-[13px]">
              <thead className="border-b bg-muted/35 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">Дата</th>
                  <th className="px-3 py-2.5 font-medium">Объект</th>
                  <th className="px-3 py-2.5 font-medium">Категория</th>
                  <th className="px-3 py-2.5 font-medium">Этап</th>
                  <th className="px-3 py-2.5 font-medium">Описание</th>
                  <th className="px-3 py-2.5 text-right font-medium">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {(expenses.data?.rows ?? []).map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/30"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(row.expense_date)}</td>
                    <td className="px-3 py-2">
                      <Link to={`/objects/${row.object_id}?tab=expenses`} className="font-medium hover:text-primary hover:underline">
                        {row.object?.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{row.category?.name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.stage?.name ?? 'Общие'}</td>
                    <td className="max-w-[14rem] truncate px-3 py-2 text-muted-foreground">{row.description ?? row.vendor ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Money value={row.amount} className="font-medium" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
