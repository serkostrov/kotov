-- RLS на всех таблицах. Политики только для authenticated; anon не видит ничего.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.objects enable row level security;
alter table public.object_members enable row level security;
alter table public.stage_templates enable row level security;
alter table public.object_stages enable row level security;
alter table public.tool_categories enable row level security;
alter table public.tools enable row level security;
alter table public.tool_movements enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.attachments enable row level security;
alter table public.material_requests enable row level security;
alter table public.activity_log enable row level security;
alter table public.organization_profile enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_owner on public.profiles;
create policy profiles_update_owner on public.profiles
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists profiles_insert_owner on public.profiles;
create policy profiles_insert_owner on public.profiles
  for insert to authenticated
  with check (public.is_owner() or id = auth.uid());

-- user_roles
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select on public.user_roles
  for select to authenticated
  using (public.is_owner() or user_id = auth.uid());

drop policy if exists user_roles_write on public.user_roles;
create policy user_roles_write on public.user_roles
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- objects
drop policy if exists objects_select on public.objects;
create policy objects_select on public.objects
  for select to authenticated
  using (deleted_at is null and public.has_object_access(id));

drop policy if exists objects_insert on public.objects;
create policy objects_insert on public.objects
  for insert to authenticated
  with check (public.is_owner());

drop policy if exists objects_update on public.objects;
create policy objects_update on public.objects
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- object_members
drop policy if exists object_members_select on public.object_members;
create policy object_members_select on public.object_members
  for select to authenticated
  using (public.has_object_access(object_id));

drop policy if exists object_members_write on public.object_members;
create policy object_members_write on public.object_members
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- object_stages
drop policy if exists object_stages_select on public.object_stages;
create policy object_stages_select on public.object_stages
  for select to authenticated
  using (
    deleted_at is null
    and public.has_object_access(object_id)
    and (public.is_owner() or public.has_role('prod_foreman') or public.has_role('install_foreman'))
  );

drop policy if exists object_stages_insert on public.object_stages;
create policy object_stages_insert on public.object_stages
  for insert to authenticated
  with check (public.is_owner());

drop policy if exists object_stages_update_owner on public.object_stages;
create policy object_stages_update_owner on public.object_stages
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists object_stages_update_foreman on public.object_stages;
create policy object_stages_update_foreman on public.object_stages
  for update to authenticated
  using (
    deleted_at is null
    and public.has_object_access(object_id)
    and (
      (stage_type = 'production' and public.has_role('prod_foreman'))
      or (stage_type = 'installation' and public.has_role('install_foreman'))
    )
  )
  with check (
    deleted_at is null
    and public.has_object_access(object_id)
    and (
      (stage_type = 'production' and public.has_role('prod_foreman'))
      or (stage_type = 'installation' and public.has_role('install_foreman'))
    )
  );

-- tools: бухгалтер не видит
drop policy if exists tools_select on public.tools;
create policy tools_select on public.tools
  for select to authenticated
  using (
    deleted_at is null
    and (
      public.is_owner()
      or public.has_role('prod_foreman')
      or public.has_role('install_foreman')
    )
  );

drop policy if exists tools_insert on public.tools;
create policy tools_insert on public.tools
  for insert to authenticated
  with check (public.is_owner());

drop policy if exists tools_update on public.tools;
create policy tools_update on public.tools
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

-- tool_movements: insert только через RPC (security definer)
drop policy if exists tool_movements_select on public.tool_movements;
create policy tool_movements_select on public.tool_movements
  for select to authenticated
  using (
    public.is_owner()
    or public.has_role('prod_foreman')
    or public.has_role('install_foreman')
  );

-- expenses
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (deleted_at is null and public.has_object_access(object_id));

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (
    public.has_object_access(object_id)
    and (
      public.is_owner()
      or public.has_role('accountant')
      or public.has_role('prod_foreman')
      or public.has_role('install_foreman')
    )
  );

drop policy if exists expenses_update_privileged on public.expenses;
create policy expenses_update_privileged on public.expenses
  for update to authenticated
  using (public.is_owner() or public.has_role('accountant'))
  with check (public.is_owner() or public.has_role('accountant'));

drop policy if exists expenses_update_foreman on public.expenses;
create policy expenses_update_foreman on public.expenses
  for update to authenticated
  using (
    created_by = auth.uid()
    and public.has_object_access(object_id)
    and (public.has_role('prod_foreman') or public.has_role('install_foreman'))
  )
  with check (
    created_by = auth.uid()
    and public.has_object_access(object_id)
    and (public.has_role('prod_foreman') or public.has_role('install_foreman'))
  );

-- attachments
drop policy if exists attachments_select on public.attachments;
create policy attachments_select on public.attachments
  for select to authenticated
  using (deleted_at is null and public.has_object_access(object_id));

drop policy if exists attachments_insert on public.attachments;
create policy attachments_insert on public.attachments
  for insert to authenticated
  with check (public.has_object_access(object_id));

drop policy if exists attachments_update on public.attachments;
create policy attachments_update on public.attachments
  for update to authenticated
  using (public.is_owner() or created_by = auth.uid())
  with check (public.is_owner() or created_by = auth.uid());

-- material_requests
drop policy if exists material_requests_select on public.material_requests;
create policy material_requests_select on public.material_requests
  for select to authenticated
  using (deleted_at is null and public.has_object_access(object_id));

drop policy if exists material_requests_insert on public.material_requests;
create policy material_requests_insert on public.material_requests
  for insert to authenticated
  with check (
    public.has_object_access(object_id)
    and (
      public.is_owner()
      or public.has_role('prod_foreman')
      or public.has_role('install_foreman')
    )
  );

drop policy if exists material_requests_update_owner on public.material_requests;
create policy material_requests_update_owner on public.material_requests
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists material_requests_update_author on public.material_requests;
create policy material_requests_update_author on public.material_requests
  for update to authenticated
  using (created_by = auth.uid() and status = 'new')
  with check (created_by = auth.uid());

-- activity_log: пишет триггер security definer
drop policy if exists activity_log_select on public.activity_log;
create policy activity_log_select on public.activity_log
  for select to authenticated
  using (object_id is not null and public.has_object_access(object_id));

-- справочники
drop policy if exists stage_templates_select on public.stage_templates;
create policy stage_templates_select on public.stage_templates
  for select to authenticated
  using (public.has_any_role());

drop policy if exists stage_templates_write on public.stage_templates;
create policy stage_templates_write on public.stage_templates
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists tool_categories_select on public.tool_categories;
create policy tool_categories_select on public.tool_categories
  for select to authenticated
  using (
    public.is_owner()
    or public.has_role('prod_foreman')
    or public.has_role('install_foreman')
  );

drop policy if exists tool_categories_write on public.tool_categories;
create policy tool_categories_write on public.tool_categories
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists expense_categories_select on public.expense_categories;
create policy expense_categories_select on public.expense_categories
  for select to authenticated
  using (public.has_any_role());

drop policy if exists expense_categories_write on public.expense_categories;
create policy expense_categories_write on public.expense_categories
  for all to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists organization_profile_select on public.organization_profile;
create policy organization_profile_select on public.organization_profile
  for select to authenticated
  using (public.has_any_role());

drop policy if exists organization_profile_update on public.organization_profile;
create policy organization_profile_update on public.organization_profile
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists organization_profile_insert on public.organization_profile;
create policy organization_profile_insert on public.organization_profile
  for insert to authenticated
  with check (public.is_owner());
