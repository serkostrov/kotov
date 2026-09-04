import type { AttachmentKind } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

const VIDEO_MAX = 100 * 1024 * 1024
const DOC_MAX = 25 * 1024 * 1024
const DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'heic', 'heif'])

export function kindFromFile(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'photo'
  if (file.type.startsWith('video/')) return 'video'
  return 'document'
}

export function extensionOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5) return fromName
  if (file.type === 'image/jpeg') return 'jpg'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/heic') return 'heic'
  if (file.type === 'video/mp4') return 'mp4'
  if (file.type === 'application/pdf') return 'pdf'
  return 'bin'
}

export function assertUploadLimits(file: File, kind: AttachmentKind): string | null {
  if (kind === 'video' && file.size > VIDEO_MAX) {
    return 'Видео больше 100 МБ. Выберите файл меньшего размера.'
  }
  if (kind === 'document') {
    if (file.size > DOC_MAX) return 'Документ больше 25 МБ.'
    const ext = extensionOf(file)
    if (!DOC_EXTS.has(ext) && !file.type.startsWith('image/')) {
      return 'Допустимы pdf, doc(x), xls(x), jpg, png, heic.'
    }
  }
  return null
}

export async function compressPhoto(file: File): Promise<File> {
  const { default: imageCompression } = await import('browser-image-compression')
  return imageCompression(file, {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 1920,
    initialQuality: 0.8,
    useWebWorker: true,
  })
}

export async function uploadObjectFile(params: {
  file: File
  objectId: string
  stageId?: string | null
  expenseId?: string | null
  comment?: string
}): Promise<void> {
  const kind = kindFromFile(params.file)
  const limitError = assertUploadLimits(params.file, kind)
  if (limitError) throw new Error(limitError)

  const payload = kind === 'photo' ? await compressPhoto(params.file) : params.file
  const ext = extensionOf(params.file)
  const id = crypto.randomUUID()
  const folder = params.expenseId
    ? `expenses/${params.expenseId}`
    : kind === 'photo'
      ? 'photos'
      : kind === 'video'
        ? 'videos'
        : 'docs'
  const storagePath = `objects/${params.objectId}/${folder}/${id}.${ext}`

  const { error: uploadError } = await supabase.storage.from('object-files').upload(storagePath, payload, {
    contentType: payload.type || params.file.type,
    upsert: false,
  })
  if (uploadError) throw uploadError

  const { error: dbError } = await supabase.from('attachments').insert({
    object_id: params.objectId,
    stage_id: params.stageId ?? null,
    expense_id: params.expenseId ?? null,
    kind,
    storage_path: storagePath,
    file_name: params.file.name,
    mime_type: payload.type || params.file.type,
    file_size: payload.size,
    comment: params.comment ?? null,
  })

  if (dbError) {
    await supabase.storage.from('object-files').remove([storagePath])
    throw dbError
  }
}

export async function signedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('object-files').createSignedUrl(path, 3600)
  if (error || !data.signedUrl) throw error ?? new Error('Не удалось получить ссылку на файл')
  return data.signedUrl
}
