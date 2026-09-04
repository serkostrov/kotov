import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/query-keys'
import { supabase } from '@/lib/supabase'
import { todayISO } from '@/lib/format'

export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: async () => {
      const today = todayISO()
      const monthStart = `${today.slice(0, 7)}-01`

      const [
        objectsRes,
        stagesRes,
        toolsRes,
        expensesRes,
        requestsRes,
        progressRes,
        economicsRes,
      ] = await Promise.all([
        supabase
          .from('objects')
          .select('id, name, status, date_plan_end, responsible_id, contract_amount')
          .is('deleted_at', null)
          .order('date_plan_end', { ascending: true, nullsFirst: false }),
        supabase
          .from('object_stages')
          .select('id, name, status, date_plan_end, object_id, stage_type, progress_percent')
          .is('deleted_at', null)
          .neq('status', 'done')
          .lt('date_plan_end', today)
          .order('date_plan_end'),
        supabase.from('tools').select('id, status').is('deleted_at', null),
        supabase
          .from('expenses')
          .select('amount')
          .is('deleted_at', null)
          .gte('expense_date', monthStart)
          .lte('expense_date', today),
        supabase
          .from('material_requests')
          .select('id, title, status, created_at, object_id')
          .is('deleted_at', null)
          .eq('status', 'new')
          .order('created_at', { ascending: false }),
        supabase.from('v_object_progress').select('*'),
        supabase.from('v_object_economics').select('*'),
      ])

      for (const res of [objectsRes, stagesRes, toolsRes, expensesRes, requestsRes, progressRes, economicsRes]) {
        if (res.error) throw res.error
      }

      const objects = objectsRes.data ?? []
      const { data: profiles } = await supabase.from('profiles').select('id, full_name')
      const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))
      const objectName = new Map(objects.map((o) => [o.id, o.name]))
      const active = objects.filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
      const tools = toolsRes.data ?? []
      const monthExpenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const ecoMap = new Map((economicsRes.data ?? []).map((e) => [e.object_id, e]))
      const progressMap = new Map((progressRes.data ?? []).map((p) => [p.object_id, p]))
      const activeProfit = active.reduce((s, o) => s + Number(ecoMap.get(o.id)?.profit ?? 0), 0)

      return {
        kpi: {
          activeObjects: active.length,
          overdueStages: (stagesRes.data ?? []).length,
          toolsOnObjects: tools.filter((t) => t.status === 'on_object').length,
          toolsAttention: tools.filter((t) => t.status === 'repair' || t.status === 'lost').length,
          monthExpenses,
          activeProfit,
        },
        objectsInWork: active.map((o) => ({
          ...o,
          responsible: o.responsible_id ? profileMap.get(o.responsible_id) ?? null : null,
          progress: progressMap.get(o.id) ?? null,
          economics: ecoMap.get(o.id) ?? null,
        })),
        overdue: (stagesRes.data ?? []).map((s) => ({
          ...s,
          object: { name: objectName.get(s.object_id) ?? null },
        })),
        requests: (requestsRes.data ?? []).map((r) => ({
          ...r,
          object: { name: objectName.get(r.object_id) ?? null },
        })),
        toolsAttention: tools.filter((t) => t.status === 'repair' || t.status === 'lost'),
      }
    },
  })
}
