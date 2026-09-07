-- При удалении объекта убираем связанные расходы, работы, файлы, задачи,
-- освобождаем инструмент и чистим историю перемещений / журнал.

create or replace function public.guard_restricted_fields()
returns trigger
language plpgsql
as $$
begin
  -- Каскадное удаление объекта (RPC / миграция)
  if current_setting('kotov.cascade_object_delete', true) = 'on' then
    return new;
  end if;

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

create or replace function public.purge_object_dependents(_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  perform set_config('kotov.cascade_object_delete', 'on', true);
  perform set_config('kotov.skip_tool_guard', 'on', true);

  update public.expenses
  set deleted_at = coalesce(deleted_at, v_now)
  where object_id = _id
    and deleted_at is null;

  update public.object_stages
  set deleted_at = coalesce(deleted_at, v_now)
  where object_id = _id
    and deleted_at is null;

  update public.attachments
  set deleted_at = coalesce(deleted_at, v_now)
  where object_id = _id
    and deleted_at is null;

  update public.material_requests
  set deleted_at = coalesce(deleted_at, v_now)
  where object_id = _id
    and deleted_at is null;

  delete from public.object_members
  where object_id = _id;

  -- Инструмент с объекта возвращаем в свободные
  update public.tools
  set
    status = 'free'::public.tool_status,
    current_object_id = null,
    current_holder_id = null,
    updated_at = v_now
  where current_object_id = _id
    and deleted_at is null;

  delete from public.tool_movements
  where object_id = _id
     or from_object_id = _id;

  delete from public.activity_log
  where object_id = _id;
end;
$$;

revoke all on function public.purge_object_dependents(uuid) from public, anon, authenticated;

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

  if not exists (select 1 from public.objects where id = _id) then
    raise exception 'Объект не найден';
  end if;

  perform public.purge_object_dependents(_id);

  update public.objects
  set deleted_at = coalesce(deleted_at, now())
  where id = _id;
end;
$$;

revoke all on function public.soft_delete_object(uuid) from public, anon;
grant execute on function public.soft_delete_object(uuid) to authenticated;

-- Чистим уже удалённые объекты (осиротевшие расходы и т.п.)
do $$
declare
  r record;
begin
  for r in
    select id from public.objects where deleted_at is not null
  loop
    perform public.purge_object_dependents(r.id);
  end loop;
end;
$$;
