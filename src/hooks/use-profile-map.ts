import { useMemo } from 'react'
import { useProfiles } from '@/hooks/use-objects'

/** Map id → profile, derived from the shared profiles query (array). */
export function useProfileMap() {
  const profiles = useProfiles()
  const data = useMemo(
    () => new Map((profiles.data ?? []).map((p) => [p.id, p])),
    [profiles.data],
  )
  return { ...profiles, data }
}
