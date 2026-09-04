-- Задачи: любой с доступом к объекту может выполнить или удалить
drop policy if exists material_requests_update_owner on public.material_requests;
drop policy if exists material_requests_update_author on public.material_requests;
drop policy if exists material_requests_update on public.material_requests;

create policy material_requests_update on public.material_requests
  for update to authenticated
  using (public.has_object_access(object_id))
  with check (public.has_object_access(object_id));
