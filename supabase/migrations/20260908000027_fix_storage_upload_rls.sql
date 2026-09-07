-- Надёжная загрузка файлов: бакет без жёсткого MIME-фильтра,
-- политики через split_part (без хрупкого storage.foldername).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'object-files',
  'object-files',
  false,
  104857600,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_object_id(object_name text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select case
    when object_name is null or object_name = '' then null
    when split_part(object_name, '/', 1) <> 'objects' then null
    when split_part(object_name, '/', 2)
      !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then null
    else split_part(object_name, '/', 2)::uuid
  end;
$$;

revoke all on function public.storage_object_id(text) from public, anon;
grant execute on function public.storage_object_id(text) to authenticated, service_role;

-- Пересоздаём политики с зеркальным SELECT (нужен для INSERT … RETURNING)
drop policy if exists "object files read" on storage.objects;
drop policy if exists "object files insert" on storage.objects;
drop policy if exists "object files update" on storage.objects;
drop policy if exists "object files delete" on storage.objects;
drop policy if exists "object files select" on storage.objects;

create policy "object files select"
on storage.objects for select to authenticated
using (
  bucket_id = 'object-files'
  and public.storage_object_id(name) is not null
  and public.has_object_access(public.storage_object_id(name))
);

create policy "object files insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'object-files'
  and public.storage_object_id(name) is not null
  and public.has_object_access(public.storage_object_id(name))
);

create policy "object files update"
on storage.objects for update to authenticated
using (
  bucket_id = 'object-files'
  and (
    public.is_owner()
    or owner = auth.uid()
    or (
      public.storage_object_id(name) is not null
      and public.has_object_access(public.storage_object_id(name))
    )
  )
)
with check (
  bucket_id = 'object-files'
  and (
    public.is_owner()
    or owner = auth.uid()
    or (
      public.storage_object_id(name) is not null
      and public.has_object_access(public.storage_object_id(name))
    )
  )
);

create policy "object files delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'object-files'
  and (
    public.is_owner()
    or owner = auth.uid()
    or (
      public.storage_object_id(name) is not null
      and public.has_object_access(public.storage_object_id(name))
    )
  )
);
