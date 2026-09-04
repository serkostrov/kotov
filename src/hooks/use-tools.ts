import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { TablesInsert, TablesUpdate, ToolMovementType, ToolStatus } from '@/lib/database.types'

export type ToolFilters = {
  search?: string
  status?: ToolStatus | 'all'
  categoryId?: string | 'all'
  objectId?: string | 'all'
  holderId?: string | 'all'
  page?: number
  pageSize?: number
}

async function toolLookups() {
  const [{ data: categories }, { data: objects }, { data: profiles }] = await Promise.all([
    supabase.from('tool_categories').select('id, name'),
    supabase.from('objects').select('id, name').is('deleted_at', null),
    supabase.from('profiles').select('id, full_name'),
  ])
  return {
    categories: new Map((categories ?? []).map((c) => [c.id, c])),
    objects: new Map((objects ?? []).map((o) => [o.id, o])),
    profiles: new Map((profiles ?? []).map((p) => [p.id, p])),
  }
}

function hydrateTool<
  T extends {
    category_id: string | null
    current_object_id: string | null
    current_holder_id: string | null
  },
>(row: T, lookups: Awaited<ReturnType<typeof toolLookups>>) {
  return {
    ...row,
    category: row.category_id ? lookups.categories.get(row.category_id) ?? null : null,
    object: row.current_object_id ? lookups.objects.get(row.current_object_id) ?? null : null,
    holder: row.current_holder_id ? lookups.profiles.get(row.current_holder_id) ?? null : null,
  }
}

export function useTools(filters: ToolFilters) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 50
  return useQuery({
    queryKey: qk.tools(filters),
    queryFn: async () => {
      let query = supabase.from('tools').select('*', { count: 'exact' }).is('deleted_at', null)

      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
      if (filters.categoryId && filters.categoryId !== 'all') query = query.eq('category_id', filters.categoryId)
      if (filters.objectId && filters.objectId !== 'all') query = query.eq('current_object_id', filters.objectId)
      if (filters.holderId && filters.holderId !== 'all') query = query.eq('current_holder_id', filters.holderId)
      if (filters.search) {
        const s = `%${filters.search}%`
        query = query.or(`name.ilike.${s},inventory_number.ilike.${s}`)
      }

      const { data, error, count } = await query
        .order('name')
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error
      const lookups = await toolLookups()
      return { rows: (data ?? []).map((row) => hydrateTool(row, lookups)), count: count ?? 0 }
    },
  })
}

export function useTool(id: string | undefined) {
  return useQuery({
    queryKey: qk.tool(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('tools').select('*').eq('id', id!).is('deleted_at', null).maybeSingle()
      if (error) throw error
      if (!data) return null
      const lookups = await toolLookups()
      return hydrateTool(data, lookups)
    },
  })
}

export function useToolMovements(toolId: string | undefined) {
  return useQuery({
    queryKey: qk.toolMovements(toolId ?? ''),
    enabled: Boolean(toolId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tool_movements')
        .select('*')
        .eq('tool_id', toolId!)
        .order('moved_at', { ascending: false })
      if (error) throw error
      const lookups = await toolLookups()
      return (data ?? []).map((row) => ({
        ...row,
        object: row.object_id ? lookups.objects.get(row.object_id) ?? null : null,
        from_holder: row.from_holder_id ? lookups.profiles.get(row.from_holder_id) ?? null : null,
        to_holder: row.to_holder_id ? lookups.profiles.get(row.to_holder_id) ?? null : null,
      }))
    },
  })
}

export function useObjectTools(objectId: string | undefined) {
  return useQuery({
    queryKey: ['object-tools', objectId],
    enabled: Boolean(objectId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tools')
        .select('*')
        .eq('current_object_id', objectId!)
        .is('deleted_at', null)
        .order('name')
      if (error) throw error
      const lookups = await toolLookups()
      return (data ?? []).map((row) => hydrateTool(row, lookups))
    },
  })
}

export function useToolMutations() {
  const client = useQueryClient()
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['tools'] })
    void client.invalidateQueries({ queryKey: ['tool'] })
    void client.invalidateQueries({ queryKey: ['object-tools'] })
    void client.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const create = useMutation({
    mutationFn: async (values: TablesInsert<'tools'>) => {
      const { error } = await supabase.from('tools').insert(values)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'tools'> }) => {
      const { error } = await supabase.from('tools').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tools').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const move = useMutation({
    mutationFn: async (params: {
      toolIds: string[]
      movementType: ToolMovementType
      objectId?: string | null
      holderId?: string | null
      comment?: string
      movedAt?: string | null
    }) => {
      const { error } = await supabase.rpc('create_tool_movements_bulk', {
        _tool_ids: params.toolIds,
        _movement_type: params.movementType,
        _object_id: params.objectId ?? null,
        _to_holder_id: params.holderId ?? null,
        _comment: params.comment ?? null,
        _moved_at: params.movedAt ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidate()
      void client.invalidateQueries({ queryKey: ['tool-movements'] })
    },
  })

  return { create, update, softDelete, move }
}
