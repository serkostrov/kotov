-- Триггеры: профиль при регистрации, метки, синхронизация этапов, охрана полей, журнал.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Пользователь'),
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- set_updated_at
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists objects_set_updated_at on public.objects;
create trigger objects_set_updated_at
  before update on public.objects
  for each row execute function public.set_updated_at();

drop trigger if exists stage_templates_set_updated_at on public.stage_templates;
create trigger stage_templates_set_updated_at
  before update on public.stage_templates
  for each row execute function public.set_updated_at();

drop trigger if exists object_stages_set_updated_at on public.object_stages;
create trigger object_stages_set_updated_at
  before update on public.object_stages
  for each row execute function public.set_updated_at();

drop trigger if exists tools_set_updated_at on public.tools;
create trigger tools_set_updated_at
  before update on public.tools
  for each row execute function public.set_updated_at();

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

drop trigger if exists material_requests_set_updated_at on public.material_requests;
create trigger material_requests_set_updated_at
  before update on public.material_requests
  for each row execute function public.set_updated_at();

drop trigger if exists organization_profile_set_updated_at on public.organization_profile;
create trigger organization_profile_set_updated_at
  before update on public.organization_profile
  for each row execute function public.set_updated_at();

-- set_created_by
drop trigger if exists objects_set_created_by on public.objects;
create trigger objects_set_created_by
  before insert on public.objects
  for each row execute function public.set_created_by();

drop trigger if exists object_stages_set_created_by on public.object_stages;
create trigger object_stages_set_created_by
  before insert on public.object_stages
  for each row execute function public.set_created_by();

drop trigger if exists tools_set_created_by on public.tools;
create trigger tools_set_created_by
  before insert on public.tools
  for each row execute function public.set_created_by();

drop trigger if exists tool_movements_set_created_by on public.tool_movements;
create trigger tool_movements_set_created_by
  before insert on public.tool_movements
  for each row execute function public.set_created_by();

drop trigger if exists expenses_set_created_by on public.expenses;
create trigger expenses_set_created_by
  before insert on public.expenses
  for each row execute function public.set_created_by();

drop trigger if exists attachments_set_created_by on public.attachments;
create trigger attachments_set_created_by
  before insert on public.attachments
  for each row execute function public.set_created_by();

drop trigger if exists material_requests_set_created_by on public.material_requests;
create trigger material_requests_set_created_by
  before insert on public.material_requests
  for each row execute function public.set_created_by();

drop trigger if exists activity_log_set_created_by on public.activity_log;
create trigger activity_log_set_created_by
  before insert on public.activity_log
  for each row execute function public.set_created_by();

-- Синхронизация статуса этапа
create or replace function public.stage_status_sync()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'done' then
    new.progress_percent = 100;
    new.date_fact_end = coalesce(new.date_fact_end, current_date);
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'not_started'
     and new.status = 'in_progress' then
    new.date_start = coalesce(new.date_start, current_date);
  end if;

  if tg_op = 'INSERT' and new.status = 'in_progress' then
    new.date_start = coalesce(new.date_start, current_date);
  end if;

  return new;
end;
$$;

drop trigger if exists object_stages_status_sync on public.object_stages;
create trigger object_stages_status_sync
  before insert or update of status on public.object_stages
  for each row execute function public.stage_status_sync();

-- Запрет правки защищённых полей не-owner'ом
create or replace function public.guard_restricted_fields()
returns trigger
language plpgsql
as $$
begin
  if public.is_owner() then
    return new;
  end if;

  if tg_table_name = 'objects' then
    if new.name is distinct from old.name
       or new.contract_amount is distinct from old.contract_amount
       or new.status is distinct from old.status
       or new.address is distinct from old.address
       or new.customer_name is distinct from old.customer_name
       or new.customer_contact is distinct from old.customer_contact
       or new.date_start is distinct from old.date_start
       or new.date_plan_end is distinct from old.date_plan_end
       or new.date_fact_end is distinct from old.date_fact_end
       or new.responsible_id is distinct from old.responsible_id
       or new.comment is distinct from old.comment
       or new.deleted_at is distinct from old.deleted_at then
      raise exception 'Недостаточно прав для изменения карточки объекта';
    end if;
  elsif tg_table_name = 'object_stages' then
    if new.object_id is distinct from old.object_id
       or new.stage_type is distinct from old.stage_type
       or new.template_id is distinct from old.template_id
       or new.name is distinct from old.name
       or new.unit is distinct from old.unit
       or new.qty_plan is distinct from old.qty_plan
       or new.responsible_id is distinct from old.responsible_id
       or new.sort_order is distinct from old.sort_order
       or new.deleted_at is distinct from old.deleted_at
       or new.date_plan_end is distinct from old.date_plan_end then
      raise exception 'Недостаточно прав для изменения этого поля этапа';
    end if;
  elsif tg_table_name = 'expenses' then
    if public.has_role('accountant') then
      return new;
    end if;
    if new.object_id is distinct from old.object_id then
      raise exception 'Нельзя перенести расход на другой объект';
    end if;
    if new.deleted_at is distinct from old.deleted_at then
      raise exception 'Недостаточно прав для удаления расхода';
    end if;
  elsif tg_table_name = 'profiles' then
    if new.is_active is distinct from old.is_active then
      raise exception 'Нельзя менять статус учётной записи';
    end if;
  elsif tg_table_name = 'tools' then
    if current_setting('kotov.skip_tool_guard', true) = 'on' then
      return new;
    end if;
    if new.status is distinct from old.status
       or new.current_object_id is distinct from old.current_object_id
       or new.current_holder_id is distinct from old.current_holder_id then
      raise exception 'Состояние инструмента меняется только через движение';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists objects_guard_restricted_fields on public.objects;
create trigger objects_guard_restricted_fields
  before update on public.objects
  for each row execute function public.guard_restricted_fields();

drop trigger if exists object_stages_guard_restricted_fields on public.object_stages;
create trigger object_stages_guard_restricted_fields
  before update on public.object_stages
  for each row execute function public.guard_restricted_fields();

drop trigger if exists expenses_guard_restricted_fields on public.expenses;
create trigger expenses_guard_restricted_fields
  before update on public.expenses
  for each row execute function public.guard_restricted_fields();

drop trigger if exists profiles_guard_restricted_fields on public.profiles;
create trigger profiles_guard_restricted_fields
  before update on public.profiles
  for each row execute function public.guard_restricted_fields();

drop trigger if exists tools_guard_restricted_fields on public.tools;
create trigger tools_guard_restricted_fields
  before update on public.tools
  for each row execute function public.guard_restricted_fields();

-- Журнал действий (security definer — иначе RLS на activity_log блокирует запись)
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_object_id uuid;
  v_action text;
  v_payload jsonb := '[]'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
  elsif tg_op = 'DELETE' then
    v_action := 'delete';
  else
    v_action := 'update';
  end if;

  if tg_table_name = 'objects' then
    v_object_id := coalesce(new.id, old.id);
    if tg_op = 'UPDATE' then
      if new.status is distinct from old.status then
        v_action := 'status_change';
        v_payload := v_payload || jsonb_build_array(
          jsonb_build_object('field', 'status', 'old', old.status, 'new', new.status)
        );
      end if;
      if new.responsible_id is distinct from old.responsible_id then
        v_payload := v_payload || jsonb_build_array(
          jsonb_build_object('field', 'responsible_id', 'old', old.responsible_id, 'new', new.responsible_id)
        );
      end if;
      if new.contract_amount is distinct from old.contract_amount then
        v_payload := v_payload || jsonb_build_array(
          jsonb_build_object('field', 'amount', 'old', old.contract_amount, 'new', new.contract_amount)
        );
      end if;
    end if;
  elsif tg_table_name = 'object_stages' then
    v_object_id := coalesce(new.object_id, old.object_id);
    if tg_op = 'UPDATE' then
      if new.status is distinct from old.status then
        v_action := 'status_change';
        v_payload := v_payload || jsonb_build_array(
          jsonb_build_object('field', 'status', 'old', old.status, 'new', new.status)
        );
      end if;
      if new.progress_percent is distinct from old.progress_percent then
        v_payload := v_payload || jsonb_build_array(
          jsonb_build_object('field', 'progress_percent', 'old', old.progress_percent, 'new', new.progress_percent)
        );
      end if;
      if new.responsible_id is distinct from old.responsible_id then
        v_payload := v_payload || jsonb_build_array(
          jsonb_build_object('field', 'responsible_id', 'old', old.responsible_id, 'new', new.responsible_id)
        );
      end if;
    end if;
  elsif tg_table_name = 'expenses' then
    v_object_id := coalesce(new.object_id, old.object_id);
    if tg_op = 'UPDATE' and new.amount is distinct from old.amount then
      v_payload := v_payload || jsonb_build_array(
        jsonb_build_object('field', 'amount', 'old', old.amount, 'new', new.amount)
      );
    elsif tg_op = 'INSERT' then
      v_payload := v_payload || jsonb_build_array(
        jsonb_build_object('field', 'amount', 'old', null, 'new', new.amount)
      );
    end if;
  end if;

  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and v_payload <> '[]'::jsonb) or tg_op = 'DELETE' then
    insert into public.activity_log (entity_type, entity_id, object_id, action, payload, created_by)
    values (
      case tg_table_name
        when 'objects' then 'object'
        when 'object_stages' then 'stage'
        when 'expenses' then 'expense'
        else tg_table_name
      end,
      coalesce(new.id, old.id),
      v_object_id,
      v_action,
      case when v_payload = '[]'::jsonb then null else v_payload end,
      auth.uid()
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists objects_log_activity on public.objects;
create trigger objects_log_activity
  after insert or update on public.objects
  for each row execute function public.log_activity();

drop trigger if exists object_stages_log_activity on public.object_stages;
create trigger object_stages_log_activity
  after insert or update on public.object_stages
  for each row execute function public.log_activity();

drop trigger if exists expenses_log_activity on public.expenses;
create trigger expenses_log_activity
  after insert or update on public.expenses
  for each row execute function public.log_activity();
