import type { ToolMovementType, ToolStatus } from '@/lib/database.types'

/** Which bulk/single movements make sense for a given tool status. */
export function movementsForStatus(status: ToolStatus): readonly ToolMovementType[] {
  switch (status) {
    case 'free':
      return ['issue', 'loss', 'write_off']
    case 'on_object':
      return ['return', 'extra_delivery', 'transfer', 'to_repair', 'loss', 'write_off']
    case 'repair':
      return ['from_repair', 'loss', 'write_off']
    case 'lost':
      return ['write_off']
    case 'written_off':
      return []
    default:
      return []
  }
}

/** Actions allowed for every selected tool (intersection). */
export function commonMovements(statuses: readonly ToolStatus[]): Set<ToolMovementType> {
  if (statuses.length === 0) return new Set()
  const [first, ...rest] = statuses
  const set = new Set(movementsForStatus(first!))
  for (const status of rest) {
    const allowed = new Set(movementsForStatus(status))
    for (const m of [...set]) {
      if (!allowed.has(m)) set.delete(m)
    }
  }
  return set
}
