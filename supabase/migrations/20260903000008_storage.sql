-- Приватный бакет object-files. Публичных бакетов нет.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'object-files',
  'object-files',
  false,
  104857600,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
    'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.text',
    'application/vnd.oasis.opendocument.spreadsheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "object files read" on storage.objects;
create policy "object files read"
on storage.objects for select to authenticated
using (
  bucket_id = 'object-files'
  and public.has_object_access(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "object files insert" on storage.objects;
create policy "object files insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'object-files'
  and public.has_object_access(((storage.foldername(name))[2])::uuid)
);

drop policy if exists "object files update" on storage.objects;
create policy "object files update"
on storage.objects for update to authenticated
using (
  bucket_id = 'object-files'
  and (public.is_owner() or owner = auth.uid())
)
with check (
  bucket_id = 'object-files'
  and (public.is_owner() or owner = auth.uid())
);

drop policy if exists "object files delete" on storage.objects;
create policy "object files delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'object-files'
  and (public.is_owner() or owner = auth.uid())
);
