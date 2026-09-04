import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import type { AppRole, ObjectStatus, StageType, TablesInsert, TablesUpdate } from '@/lib/database.types'

async function loadProfiles() {
  const { data, error } = await supabase.from('profiles').select('id, full_name, position, phone')
  if (error) throw error
  return new Map((data ?? []).map((p) => [p.id, p]))
}

export function useProfiles() {
  return useQuery({
    queryKey: qk.profiles,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return data
    },
  })
}

export function useStageTemplates() {
  return useQuery({
    queryKey: qk.stageTemplates,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stage_templates')
        .select('*')
        .order('stage_type')
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useToolCategories() {
  return useQuery({
    queryKey: qk.toolCategories,
    queryFn: async () => {
      const { data, error } = await supabase.from('tool_categories').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: qk.expenseCategories,
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_categories').select('*').order('sort_order')
      if (error) throw error
      return data
    },
  })
}

export function useContacts() {
  return useQuery({
    queryKey: qk.contacts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .is('deleted_at', null)
        .order('full_name')
      if (error) throw error

      const ids = (data ?? []).map((c) => c.id)
      const objectsByContact = new Map<string, { id: string; name: string }[]>()
      if (ids.length > 0) {
        const { data: linked, error: linkErr } = await supabase
          .from('objects')
          .select('id, name, customer_contact_id')
          .in('customer_contact_id', ids)
          .is('deleted_at', null)
          .order('name')
        if (linkErr) throw linkErr
        for (const row of linked ?? []) {
          if (!row.customer_contact_id) continue
          const list = objectsByContact.get(row.customer_contact_id) ?? []
          list.push({ id: row.id, name: row.name })
          objectsByContact.set(row.customer_contact_id, list)
        }
      }

      return (data ?? []).map((c) => ({
        ...c,
        objects: objectsByContact.get(c.id) ?? [],
      }))
    },
  })
}

export function useContactMutations() {
  const client = useQueryClient()
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: qk.contacts })
    void client.invalidateQueries({ queryKey: ['objects'] })
  }

  const create = useMutation({
    mutationFn: async (values: { full_name: string; phone?: string | null }) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert({
          full_name: values.full_name,
          phone: values.phone ?? null,
        })
        .select('id')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string
      values: { full_name: string; phone?: string | null }
    }) => {
      const { error } = await supabase
        .from('contacts')
        .update({
          full_name: values.full_name,
          phone: values.phone ?? null,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      await supabase.from('objects').update({ customer_contact_id: null }).eq('customer_contact_id', id)
    },
    onSuccess: invalidate,
  })

  return { create, update, softDelete }
}

export function useOrganization() {
  return useQuery({
    queryKey: qk.organization,
    queryFn: async () => {
      const { data, error } = await supabase.from('organization_profile').select('*').limit(1).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export type ObjectFilters = {
  search?: string
  status?: ObjectStatus | 'all'
  responsibleId?: string | 'all'
  sort?: 'created_at' | 'date_plan_end' | 'contract_amount'
  page?: number
  pageSize?: number
}

export function useObjects(filters: ObjectFilters) {
  const page = filters.page ?? 0
  const pageSize = filters.pageSize ?? 50
  return useQuery({
    queryKey: qk.objects(filters),
    queryFn: async () => {
      let query = supabase
        .from('objects')
        .select('*', { count: 'exact' })
        .is('deleted_at', null)

      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
      if (filters.responsibleId && filters.responsibleId !== 'all') {
        query = query.eq('responsible_id', filters.responsibleId)
      }
      if (filters.search) {
        const s = `%${filters.search}%`
        query = query.or(`name.ilike.${s},address.ilike.${s},customer_name.ilike.${s}`)
      }

      const sort = filters.sort ?? 'created_at'
      query = query.order(sort, { ascending: sort === 'date_plan_end' }).range(page * pageSize, page * pageSize + pageSize - 1)

      const { data, error, count } = await query
      if (error) throw error

      const ids = (data ?? []).map((o) => o.id)
      const [progress, economics] = await Promise.all([
        ids.length
          ? supabase.from('v_object_progress').select('*')
          : Promise.resolve({ data: [], error: null }),
        ids.length
          ? supabase.from('v_object_economics').select('*')
          : Promise.resolve({ data: [], error: null }),
      ])
      if (progress.error) throw progress.error
      if (economics.error) throw economics.error

      const { data: profiles } = await supabase.from('profiles').select('id, full_name')
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      const progressMap = new Map((progress.data ?? []).map((p) => [p.object_id, p]))
      const ecoMap = new Map((economics.data ?? []).map((e) => [e.object_id, e]))

      return {
        rows: (data ?? []).map((row) => ({
          ...row,
          responsible: row.responsible_id ? profileMap.get(row.responsible_id) ?? null : null,
          progress: progressMap.get(row.id) ?? null,
          economics: ecoMap.get(row.id) ?? null,
        })),
        count: count ?? 0,
      }
    },
  })
}

export function useObject(id: string | undefined) {
  return useQuery({
    queryKey: qk.object(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('objects')
        .select('*')
        .eq('id', id!)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const profiles = await loadProfiles()
      return {
        ...data,
        responsible: data.responsible_id ? profiles.get(data.responsible_id) ?? null : null,
      }
    },
  })
}

export function useObjectProgress(id: string | undefined) {
  return useQuery({
    queryKey: qk.objectProgress(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('v_object_progress').select('*').eq('object_id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useObjectEconomics(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.objectEconomics(id ?? ''),
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_object_economics').select('*').eq('object_id', id!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useObjectExpensesByCategory(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.objectExpensesByCategory(id ?? ''),
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_object_expenses_by_category')
        .select('*')
        .eq('object_id', id!)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useObjectExpensesByContour(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: qk.objectExpensesByContour(id ?? ''),
    enabled: Boolean(id) && enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_object_expenses_by_contour')
        .select('*')
        .eq('object_id', id!)
      if (error) throw error
      return data ?? []
    },
  })
}

export function useObjectMembers(id: string | undefined) {
  return useQuery({
    queryKey: qk.objectMembers(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from('object_members').select('*').eq('object_id', id!)
      if (error) throw error
      const profiles = await loadProfiles()
      return (data ?? []).map((row) => ({
        ...row,
        profile: profiles.get(row.user_id) ?? null,
      }))
    },
  })
}

export function useObjectStages(id: string | undefined, type?: StageType) {
  return useQuery({
    queryKey: qk.objectStages(id ?? '', type),
    enabled: Boolean(id),
    queryFn: async () => {
      let query = supabase
        .from('object_stages')
        .select('*')
        .eq('object_id', id!)
        .is('deleted_at', null)
        .order('sort_order')
      if (type) query = query.eq('stage_type', type)
      const { data, error } = await query
      if (error) throw error
      const profiles = await loadProfiles()
      return (data ?? []).map((row) => ({
        ...row,
        responsible: row.responsible_id ? profiles.get(row.responsible_id) ?? null : null,
      }))
    },
  })
}

export function useObjectStage(stageId: string | undefined) {
  return useQuery({
    queryKey: qk.objectStage(stageId ?? ''),
    enabled: Boolean(stageId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('object_stages')
        .select('*')
        .eq('id', stageId!)
        .is('deleted_at', null)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const [{ data: object }, profiles] = await Promise.all([
        supabase.from('objects').select('id, name, address, status').eq('id', data.object_id).maybeSingle(),
        loadProfiles(),
      ])
      return {
        ...data,
        object: object ?? null,
        responsible: data.responsible_id ? profiles.get(data.responsible_id) ?? null : null,
      }
    },
  })
}

export function useActivity(
  id: string | undefined,
  opts?: { page?: number; pageSize?: number },
) {
  const page = opts?.page ?? 0
  const pageSize = opts?.pageSize ?? 50
  return useQuery({
    queryKey: qk.activity(id ?? '', { page, pageSize }),
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error, count } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .eq('object_id', id!)
        .order('created_at', { ascending: false })
        .range(page * pageSize, page * pageSize + pageSize - 1)
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },
  })
}

export function useObjectMutations() {
  const client = useQueryClient()
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: ['objects'] })
    void client.invalidateQueries({ queryKey: ['object'] })
    void client.invalidateQueries({ queryKey: ['dashboard'] })
    void client.invalidateQueries({ queryKey: qk.contacts })
  }

  const create = useMutation({
    mutationFn: async (values: TablesInsert<'objects'>) => {
      const { data, error } = await supabase.from('objects').insert(values).select('id').single()
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: TablesUpdate<'objects'> }) => {
      const { error } = await supabase.from('objects').update(values).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('soft_delete_object', { _id: id })
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  return { create, update, softDelete }
}

export function useAddStageFromTemplate() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      objectId,
      templateId,
    }: {
      objectId: string
      templateId: string
    }) => {
      const { data: template, error: tErr } = await supabase
        .from('stage_templates')
        .select('*')
        .eq('id', templateId)
        .eq('is_active', true)
        .maybeSingle()
      if (tErr) throw tErr
      if (!template) throw new Error('Шаблон не найден')

      const { data: existing, error: eErr } = await supabase
        .from('object_stages')
        .select('id, sort_order')
        .eq('object_id', objectId)
        .eq('stage_type', template.stage_type)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1)
      if (eErr) throw eErr

      const nextOrder = (existing?.[0]?.sort_order ?? 0) + 10
      const { error } = await supabase.from('object_stages').insert({
        object_id: objectId,
        stage_type: template.stage_type,
        template_id: template.id,
        name: template.name,
        unit: template.unit,
        sort_order: nextOrder,
      })
      if (error) throw error
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['object-stages'] })
      void client.invalidateQueries({ queryKey: ['object-progress'] })
      void client.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUsersAdmin() {
  return useQuery({
    queryKey: qk.users,
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from('profiles').select('*').order('full_name')
      if (error) throw error
      const { data: roles, error: rErr } = await supabase.from('user_roles').select('*')
      if (rErr) throw rErr
      const { data: authEmails } = await supabase.rpc('list_auth_emails')
      const emailById = new Map((authEmails ?? []).map((row) => [row.id, row.email]))
      const byUser = new Map<string, AppRole[]>()
      for (const row of roles ?? []) {
        const list = byUser.get(row.user_id) ?? []
        list.push(row.role)
        byUser.set(row.user_id, list)
      }
      return (profiles ?? []).map((p) => ({
        ...p,
        email: emailById.get(p.id) ?? p.email,
        roles: byUser.get(p.id) ?? [],
      }))
    },
  })
}
