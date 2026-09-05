-- Soft-delete: SELECT после UPDATE должен пропускать строку с deleted_at,
-- иначе PostgREST/Postgres даёт «new row violates row-level security».
-- Тот же приём, что в 00015 для objects.

drop policy if exists tools_select on public.tools;
create policy tools_select on public.tools
  for select to authenticated
  using (
    (deleted_at is null or public.is_owner())
    and (
      public.is_owner()
      or public.has_role('prod_foreman')
      or public.has_role('install_foreman')
    )
  );

drop policy if exists material_requests_select on public.material_requests;
create policy material_requests_select on public.material_requests
  for select to authenticated
  using (public.has_object_access(object_id));

drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    public.has_object_access(object_id)
    and (
      deleted_at is null
      or public.is_owner()
      or public.has_role('accountant')
    )
  );

drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select to authenticated
  using (
    public.has_object_access(object_id)
    and (
      deleted_at is null
      or public.is_owner()
      or created_by = auth.uid()
    )
  );

drop policy if exists object_stages_select on public.object_stages;
create policy object_stages_select on public.object_stages
  for select to authenticated
  using (
    (deleted_at is null or public.is_owner())
    and public.has_object_access(object_id)
    and (
      public.is_owner()
      or public.has_role('prod_foreman')
      or public.has_role('install_foreman')
    )
  );

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select to authenticated
  using (
    public.has_any_role()
    and (deleted_at is null or public.is_owner())
  );
