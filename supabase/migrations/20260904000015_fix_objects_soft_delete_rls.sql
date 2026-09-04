-- Soft-delete объектов: политика UPDATE не должна требовать deleted_at is null
-- (иначе руководитель не может удалить объект). Добавляем RPC на случай обхода.

drop policy if exists objects_select on public.objects;
create policy objects_select on public.objects
  for select to authenticated
  using (
    public.has_object_access(id)
    and (deleted_at is null or public.is_owner())
  );

drop policy if exists objects_update on public.objects;
create policy objects_update on public.objects
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

create or replace function public.soft_delete_object(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_owner() then
    raise exception 'Недостаточно прав для удаления объекта';
  end if;

  update public.objects
  set deleted_at = coalesce(deleted_at, now())
  where id = _id;

  if not found then
    raise exception 'Объект не найден';
  end if;
end;
$$;

revoke all on function public.soft_delete_object(uuid) from public, anon;
grant execute on function public.soft_delete_object(uuid) to authenticated;
