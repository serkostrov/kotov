import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number]

/** 0-based page + page size; resets to first page when resetKey changes. */
export function useListPaging(resetKey: string, initialSize: PageSize = 50) {
  const [page, setPage] = useState(0)
  const [pageSize, setPageSizeState] = useState<PageSize>(initialSize)

  useEffect(() => {
    setPage(0)
  }, [resetKey])

  const setPageSize = (size: PageSize) => {
    setPageSizeState(size)
    setPage(0)
  }

  return { page, setPage, pageSize, setPageSize }
}

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number
  pageSize: PageSize
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: PageSize) => void
  className?: string
}) {
  if (total <= 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(page, totalPages - 1)
  const from = current * pageSize + 1
  const to = Math.min(total, (current + 1) * pageSize)

  return (
    <div
      className={cn(
        'mt-3 flex flex-col gap-2 rounded-xl border border-border/70 bg-card/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <p className="text-xs text-muted-foreground">
        {from}–{to} из {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">На странице</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v) as PageSize)}>
            <SelectTrigger className="h-8 w-[4.5rem]" aria-label="Размер страницы">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={current <= 0}
            aria-label="Предыдущая страница"
            onClick={() => onPageChange(current - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-[4.5rem] text-center text-xs tabular text-muted-foreground">
            {current + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            disabled={current >= totalPages - 1}
            aria-label="Следующая страница"
            onClick={() => onPageChange(current + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  )
}
