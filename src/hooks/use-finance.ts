import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { RequestStatus, TablesInsert, TablesUpdate } from '@/lib/database.types'

export type ExpenseFilters = {
  objectId?: string | 'all'
  categoryId?: string | 'all'
  from?: string
  to?: string
  authorId?: string | 'all'
  stageId?: string | 'all'
  page?: number
  pageSize?: number
}

export function useExpenses(filters: ExpenseFilters) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 50
  return useQuery({
    queryKey: qk.expenses(filters),
    queryFn: async () => {
      let query = supabase.from('expenses').select('*', { count: 'exact' }).is('deleted_at', null)

      if (filters.objectId && filters.objectId !== 'all') query = query.eq('object_id', filters.objectId)
      if (filters.categoryId && filters.categoryId !== 'all') query = query.eq('category_id', filters.categoryId)
      if (filters.authorId && filters.authorId !== 'all') query = query.eq('created_by', filters.authorId)
      if (filters.stageId && filters.stageId !== 'all') query = query.eq('stage_id', filters.stageId)
      if (filters.from) query = query.gte('expense_date', filters.from)
      if (filters.to) query = query.lte('expense_date', filters.to)

      const { data, error, count } = await query
        .order('expense_date', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error

      const [{ data: objects }, { data: categories }, { data: stages }] = await Promise.all([
        supabase.from('objects').select('id, name').is('deleted_at', null),
        supabase.from('expense_categories').select('id, name'),
        supabase.from('object_stages').select('id, name, stage_type').is('deleted_at', null),
      ])
      const objectMap = new Map((objects ?? []).map((o) => [o.id, o]))
      const catMap = new Map((categories ?? []).map((c) => [c.id, c]))
      const stageMap = new Map((stages ?? []).map((s) => [s.id, s]))
      const rows = (data ?? []).map((row) => ({
        ...row,
        object: objectMap.get(row.object_id) ?? null,
        category: catMap.get(row.category_id) ?? null,
        stage: row.stage_id ? stageMap.get(row.stage_id) ?? null : null,
      }))
      const total = rows.reduce((sum, row) => sum + Number(row.amount), 0)
      return { rows, count: count ?? 0, pageTotal: total }
    },
  })
}

export function useExpenseMutations() {
  const client = useQueryClient()
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['expenses'] })
    void client.invalidateQueries({ queryKey: ['object-economics'] })
    void client.invalidateQueries({ queryKey: ['object-expenses-cat'] })
    void client.invalidateQueries({ queryKey: ['object-expenses-contour'] })
    void client.invalidateQueries({ queryKey: ['activity'] })
    void client.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const create = useMutation({
    mutationFn: async (values: TablesInsert<'expenses'>) => {
      const { data, error } = await supabase.from('expenses').insert(values).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'expenses'> }) => {
      const { error } = await supabase.from('expenses').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, update, softDelete }
}

export type RequestFilters = {
  objectId?: string | 'all'
  /** false = open tasks, true = completed (purchased) */
  done?: boolean
  status?: RequestStatus | 'all'
  page?: number
  pageSize?: number
}

export function useMaterialRequests(filters: RequestFilters) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 50
  return useQuery({
    queryKey: qk.requests(filters),
    queryFn: async () => {
      let query = supabase
        .from('material_requests')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (filters.objectId && filters.objectId !== 'all') query = query.eq('object_id', filters.objectId)
      if (filters.done === true) {
        query = query.eq('status', 'purchased')
      } else if (filters.done === false) {
        query = query.in('status', ['new', 'approved'])
      } else if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error
      const { data: objects } = await supabase.from('objects').select('id, name').is('deleted_at', null)
      const objectMap = new Map((objects ?? []).map((o) => [o.id, o]))
      return {
        rows: (data ?? []).map((row) => ({ ...row, object: objectMap.get(row.object_id) ?? null })),
        count: count ?? 0,
      }
    },
  })
}

export function useRequestMutations() {
  const client = useQueryClient()
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['requests'] })
    void client.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const create = useMutation({
    mutationFn: async (values: TablesInsert<'material_requests'>) => {
      const { error } = await supabase.from('material_requests').insert(values)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'material_requests'> }) => {
      const { error } = await supabase.from('material_requests').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('material_requests')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const complete = useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId?: string }) => {
      const { error } = await supabase
        .from('material_requests')
        .update({
          status: 'purchased',
          resolved_at: new Date().toISOString(),
          resolved_by: userId ?? null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, update, softDelete, complete }
}

export function useAttachments(objectId: string | undefined, kinds: Array<'photo' | 'video' | 'document'>) {
  return useQuery({
    queryKey: qk.attachments(objectId ?? '', kinds.join(',')),
    enabled: Boolean(objectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attachments')
        .select('*')
        .eq('object_id', objectId!)
        .in('kind', kinds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      const { data: stages } = await supabase
        .from('object_stages')
        .select('id, name')
        .eq('object_id', objectId!)
        .is('deleted_at', null)
      const stageMap = new Map((stages ?? []).map((s) => [s.id, s]))
      return (data ?? []).map((row) => ({
        ...row,
        stage: row.stage_id ? stageMap.get(row.stage_id) ?? null : null,
      }))
    },
  })
}

export function useSignedUrl(path: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.signedUrl(path ?? ''),
    enabled: Boolean(path) && enabled,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('object-files').createSignedUrl(path!, 3600)
      if (error || !data.signedUrl) throw error ?? new Error('Не удалось получить ссылку')
      return data.signedUrl
    },
  })
}
