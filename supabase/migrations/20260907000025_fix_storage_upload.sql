-- Расширяем MIME для камерных снимков и укрепляем политики storage.

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png',
  'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'image/heic-sequence', 'image/heif-sequence',
  'video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp', 'video/x-m4v',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet'
]
where id = 'object-files';

-- Безопасное извлечение object_id из пути objects/<uuid>/...
create or replace function public.storage_object_id(object_name text)
returns uuid
language plpgsql
stable
security definer
set search_path = public, storage
as $$
declare
  parts text[];
  candidate text;
begin
  parts := storage.foldername(object_name);
  if parts is null or array_length(parts, 1) < 2 then
    return null;
  end if;
  candidate := parts[2];
  if candidate is null or candidate !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return candidate::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.storage_object_id(text) from public, anon;
grant execute on function public.storage_object_id(text) to authenticated;

drop policy if exists "object files read" on storage.objects;
create policy "object files read"
on storage.objects for select to authenticated
using (
  bucket_id = 'object-files'
  and public.storage_object_id(name) is not null
  and public.has_object_access(public.storage_object_id(name))
);

drop policy if exists "object files insert" on storage.objects;
create policy "object files insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'object-files'
  and public.storage_object_id(name) is not null
  and public.has_object_access(public.storage_object_id(name))
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
