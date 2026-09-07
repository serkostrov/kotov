import type { AttachmentKind } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

const PHOTO_MAX = 25 * 1024 * 1024
const VIDEO_MAX = 100 * 1024 * 1024
const DOC_MAX = 25 * 1024 * 1024

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', '3gp', '3gpp', 'm4v'])
const DOC_EXTS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'heic', 'heif', 'webp'])

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  '3gpp': 'video/3gpp',
  m4v: 'video/mp4',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/heic-sequence': 'image/heic',
  'image/heif-sequence': 'image/heif',
  'video/x-m4v': 'video/mp4',
}

export function extensionOf(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5 && /^[a-z0-9]+$/.test(fromName)) return fromName
  const mime = normalizeMime(file.type)
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/heic') return 'heic'
  if (mime === 'image/heif') return 'heif'
  if (mime === 'video/mp4') return 'mp4'
  if (mime === 'video/quicktime') return 'mov'
  if (mime === 'video/webm') return 'webm'
  if (mime === 'video/3gpp') return '3gp'
  if (mime === 'application/pdf') return 'pdf'
  return 'bin'
}

export function kindFromFile(file: File): AttachmentKind {
  const mime = normalizeMime(file.type)
  if (mime.startsWith('image/')) return 'photo'
  if (mime.startsWith('video/')) return 'video'
  const ext = extensionOf(file)
  if (IMAGE_EXTS.has(ext)) return 'photo'
  if (VIDEO_EXTS.has(ext)) return 'video'
  return 'document'
}

function normalizeMime(value: string | null | undefined): string {
  const raw = (value ?? '').trim().toLowerCase()
  if (!raw) return ''
  return MIME_ALIASES[raw] ?? raw
}

function resolveMime(file: File, ext: string, fallback = 'application/octet-stream'): string {
  const fromFile = normalizeMime(file.type)
  if (fromFile && fromFile !== 'application/octet-stream') return fromFile
  return MIME_BY_EXT[ext] ?? fallback
}

export function assertUploadLimits(file: File, kind: AttachmentKind): string | null {
  if (kind === 'photo' && file.size > PHOTO_MAX) {
    return 'Фото больше 25 МБ. Выберите файл меньшего размера.'
  }
  if (kind === 'video' && file.size > VIDEO_MAX) {
    return 'Видео больше 100 МБ. Выберите файл меньшего размера.'
  }
  if (kind === 'document') {
    if (file.size > DOC_MAX) return 'Документ больше 25 МБ.'
    const ext = extensionOf(file)
    const mime = normalizeMime(file.type)
    if (!DOC_EXTS.has(ext) && !mime.startsWith('image/')) {
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
    // Worker часто ломается (CSP / Vite / мобильные браузеры) и роняет всю загрузку.
    useWebWorker: false,
    fileType: 'image/jpeg',
  })
}

async function preparePhoto(file: File): Promise<{ payload: File; ext: string; mime: string }> {
  try {
    const compressed = await compressPhoto(file)
    const blob = compressed instanceof Blob ? compressed : new Blob([compressed], { type: 'image/jpeg' })
    const mime = normalizeMime(blob.type) || 'image/jpeg'
    const payload =
      compressed instanceof File
        ? new File([compressed], renameExt(file.name, 'jpg'), { type: mime, lastModified: Date.now() })
        : new File([blob], renameExt(file.name, 'jpg'), { type: mime, lastModified: Date.now() })
    return { payload, ext: 'jpg', mime: 'image/jpeg' }
  } catch {
    // HEIC и часть камерных снимков не сжимаются в браузере — грузим оригинал.
    if (file.size > PHOTO_MAX) {
      throw new Error('Не удалось сжать фото, а оригинал больше 25 МБ.')
    }
    const ext = extensionOf(file)
    const mime = resolveMime(file, ext, 'image/jpeg')
    if (!mime.startsWith('image/')) {
      throw new Error('Не удалось определить тип изображения.')
    }
    return {
      payload: new File([file], renameExt(file.name, ext), { type: mime, lastModified: file.lastModified }),
      ext,
      mime,
    }
  }
}

function renameExt(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, '') || 'file'
  return `${base}.${ext}`
}

export async function uploadObjectFile(params: {
  file: File
  objectId: string
  stageId?: string | null
  expenseId?: string | null
  comment?: string
  /** Если задан — не угадываем вид файла (нужно для картинок во вкладке «Документы»). */
  kind?: AttachmentKind
}): Promise<void> {
  const kind = params.kind ?? kindFromFile(params.file)
  const limitError = assertUploadLimits(params.file, kind)
  if (limitError) throw new Error(limitError)

  let payload: File
  let ext: string
  let mime: string

  if (kind === 'photo') {
    ;({ payload, ext, mime } = await preparePhoto(params.file))
  } else {
    ext = extensionOf(params.file)
    mime = resolveMime(
      params.file,
      ext,
      kind === 'video' ? 'video/mp4' : 'application/octet-stream',
    )
    if (!mime || mime === 'application/octet-stream') {
      throw new Error(
        kind === 'video'
          ? 'Не удалось определить тип видео. Попробуйте mp4 или mov.'
          : 'Не удалось определить тип файла.',
      )
    }
    payload =
      params.file.type === mime
        ? params.file
        : new File([params.file], renameExt(params.file.name, ext), {
            type: mime,
            lastModified: params.file.lastModified,
          })
  }

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
    contentType: mime,
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
    mime_type: mime,
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
