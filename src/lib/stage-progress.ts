import type { StageStatus } from '@/lib/database.types'
import { formatNumber } from '@/lib/format'

/**
 * Mode A (qty_plan > 0): progress = fact/plan; status from volume (except done/blocked).
 * Mode B (no plan): status is user-driven; progress from progressManual (clamped).
 * Status "done" always forces progress 100 in both modes.
 */
export function resolveStageMetrics(input: {
  status: StageStatus
  qtyPlan: number | null | undefined
  qtyFact: number | null | undefined
  progressManual?: number | null | undefined
}): { status: StageStatus; progress: number } {
  const plan = input.qtyPlan != null && Number.isFinite(input.qtyPlan) ? input.qtyPlan : null
  const factRaw = input.qtyFact != null && Number.isFinite(input.qtyFact) ? input.qtyFact : null
  const fact = factRaw ?? 0
  const volumeMode = plan != null && plan > 0

  if (volumeMode) {
    let progress = progressFromVolume(plan, fact)
    if (input.status === 'done') progress = 100
    if (input.status === 'done' || input.status === 'blocked') {
      return { status: input.status, progress }
    }
    if (fact > 0) return { status: 'in_progress', progress }
    return { status: 'not_started', progress }
  }

  // Manual mode
  let progress = clampPercent(input.progressManual)
  if (input.status === 'not_started') progress = 0
  if (input.status === 'done') progress = 100
  return { status: input.status, progress }
}

export function calcStageProgress(input: {
  status: StageStatus
  qtyPlan: number | null | undefined
  qtyFact: number | null | undefined
  progressManual?: number | null | undefined
}): number {
  return resolveStageMetrics(input).progress
}

export function stageProgressOf(stage: {
  status: StageStatus
  qty_plan: number | null
  qty_fact: number | null
  progress_percent?: number | null
}): number {
  return resolveStageMetrics({
    status: stage.status,
    qtyPlan: stage.qty_plan,
    qtyFact: stage.qty_fact,
    progressManual: stage.progress_percent,
  }).progress
}

export function isVolumeProgressMode(qtyPlan: number | null | undefined): boolean {
  return qtyPlan != null && Number.isFinite(qtyPlan) && qtyPlan > 0
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

function clampPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}
