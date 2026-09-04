import type {
  AppRole,
  AttachmentKind,
  ObjectStatus,
  RequestStatus,
  StageStatus,
  StageType,
  ToolMovementType,
  ToolStatus,
} from '@/lib/database.types'

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: 'Руководитель',
  prod_foreman: 'Бригадир производства',
  install_foreman: 'Бригадир монтажа',
  accountant: 'Документы / бухгалтерия',
}

export const OBJECT_STATUS_LABELS: Record<ObjectStatus, string> = {
  new: 'Новый',
  in_production: 'В производстве',
  in_installation: 'На монтаже',
  suspended: 'Приостановлен',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  production: 'Производство',
  installation: 'Монтаж',
}

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  not_started: 'Не начат',
  in_progress: 'В работе',
  done: 'Сдан',
  blocked: 'Блокер',
}

export const TOOL_STATUS_LABELS: Record<ToolStatus, string> = {
  free: 'Свободен',
  on_object: 'На объекте',
  repair: 'В ремонте',
  lost: 'Утерян',
  written_off: 'Списан',
}

export const TOOL_MOVEMENT_LABELS: Record<ToolMovementType, string> = {
  issue: 'Выдача',
  extra_delivery: 'Довоз',
  return: 'Возврат',
  transfer: 'Перемещение',
  to_repair: 'В ремонт',
  from_repair: 'Из ремонта',
  loss: 'Утеря',
  write_off: 'Списание',
}

export const ATTACHMENT_KIND_LABELS: Record<AttachmentKind, string> = {
  photo: 'Фото',
  video: 'Видео',
  document: 'Документ',
}

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  new: 'Новая',
  approved: 'Согласована',
  purchased: 'Закуплено',
  rejected: 'Отклонена',
}

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  create: 'Создано',
  update: 'Изменено',
  delete: 'Удалено',
  status_change: 'Смена статуса',
}

export const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  object: 'Объект',
  stage: 'Этап',
  expense: 'Расход',
  tool: 'Инструмент',
}

export const OBJECT_STATUS_TONE: Record<ObjectStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  new: 'neutral',
  in_production: 'info',
  in_installation: 'warning',
  suspended: 'danger',
  completed: 'success',
  cancelled: 'neutral',
}

export const STAGE_STATUS_TONE: Record<StageStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  not_started: 'neutral',
  in_progress: 'info',
  done: 'success',
  blocked: 'danger',
}

export const TOOL_STATUS_TONE: Record<ToolStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  free: 'success',
  on_object: 'info',
  repair: 'warning',
  lost: 'danger',
  written_off: 'neutral',
}

export const REQUEST_STATUS_TONE: Record<RequestStatus, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
  new: 'info',
  approved: 'warning',
  purchased: 'success',
  rejected: 'neutral',
}
