import type { StageStatus } from '@/lib/database.types'
import { formatNumber } from '@/lib/format'

/**
 * Progress: fact/plan when plan is set; otherwise 100% if done, else 0.
 * Status "done"/"blocked" are kept; fact > 0 upgrades not_started → in_progress.
 */
export function resolveStageMetrics(input: {
  status: StageStatus
  qtyPlan: number | null | undefined
  qtyFact: number | null | undefined
}): { status: StageStatus; progress: number } {
  const plan = input.qtyPlan != null && Number.isFinite(input.qtyPlan) ? input.qtyPlan : null
  const factRaw = input.qtyFact != null && Number.isFinite(input.qtyFact) ? input.qtyFact : null
  const fact = factRaw ?? 0

  const progress =
    plan != null && plan > 0
      ? progressFromVolume(plan, fact)
      : input.status === 'done'
        ? 100
        : 0

  if (input.status === 'done' || input.status === 'blocked') {
    return { status: input.status, progress }
  }

  if (fact > 0) {
    return { status: 'in_progress', progress }
  }

  return { status: 'not_started', progress }
}

export function calcStageProgress(input: {
  status: StageStatus
  qtyPlan: number | null | undefined
  qtyFact: number | null | undefined
}): number {
  return resolveStageMetrics(input).progress
}

export function stageProgressOf(stage: {
  status: StageStatus
  qty_plan: number | null
  qty_fact: number | null
}): number {
  return resolveStageMetrics({
    status: stage.status,
    qtyPlan: stage.qty_plan,
    qtyFact: stage.qty_fact,
  }).progress
}

export function formatStageVolume(
  fact: number | null | undefined,
  plan: number | null | undefined,
  unit?: string | null,
): string | null {
  if (fact == null && plan == null) return null
  const factText = fact == null ? '—' : formatNumber(fact)
  const planText = plan == null ? '—' : formatNumber(plan)
  const unitText = unit?.trim() ? ` ${unit.trim()}` : ''
  return `${factText} из ${planText}${unitText}`
}

function progressFromVolume(plan: number, fact: number): number {
  return Math.min(100, Math.max(0, Math.round((fact / plan) * 100)))
}
