import { Badge } from '@/components/ui/badge'
import {
  OBJECT_STATUS_LABELS,
  OBJECT_STATUS_TONE,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONE,
  STAGE_STATUS_LABELS,
  STAGE_STATUS_TONE,
  TOOL_STATUS_LABELS,
  TOOL_STATUS_TONE,
} from '@/lib/dictionaries'
import type { ObjectStatus, RequestStatus, StageStatus, ToolStatus } from '@/lib/database.types'

export function ObjectStatusBadge({ status }: { status: ObjectStatus }) {
  return <Badge tone={OBJECT_STATUS_TONE[status]}>{OBJECT_STATUS_LABELS[status]}</Badge>
}

export function StageStatusBadge({ status }: { status: StageStatus }) {
  return <Badge tone={STAGE_STATUS_TONE[status]}>{STAGE_STATUS_LABELS[status]}</Badge>
}

export function ToolStatusBadge({ status }: { status: ToolStatus }) {
  return <Badge tone={TOOL_STATUS_TONE[status]}>{TOOL_STATUS_LABELS[status]}</Badge>
}

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return <Badge tone={REQUEST_STATUS_TONE[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>
}
