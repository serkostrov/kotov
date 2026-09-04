-- Любой аутентифицированный пользователь с доступом к объекту может создавать заявки
drop policy if exists material_requests_insert on public.material_requests;
create policy material_requests_insert on public.material_requests
  for insert to authenticated
  with check (public.has_object_access(object_id));
