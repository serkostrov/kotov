-- Единственная точка изменения состояния инструмента.

create or replace function public.create_tool_movement(
  _tool_id uuid,
  _movement_type public.tool_movement_type,
  _object_id uuid default null,
  _to_holder_id uuid default null,
  _comment text default null,
  _moved_at timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tool tools%rowtype;
  v_id uuid;
  v_object_name text;
begin
  select * into v_tool
  from public.tools
  where id = _tool_id and deleted_at is null
  for update;

  if not found then
    raise exception 'Инструмент не найден';
  end if;

  if v_tool.status = 'written_off' then
    raise exception 'Списанный инструмент нельзя перемещать';
  end if;

  if not public.is_owner() then
    if _movement_type in ('loss', 'write_off', 'transfer') then
      raise exception 'Недостаточно прав для этого типа движения';
    end if;
    if _object_id is null or not public.has_object_access(_object_id) then
      raise exception 'Нет доступа к объекту';
    end if;
  end if;

  case _movement_type
    when 'issue' then
      if v_tool.status = 'on_object' then
        select name into v_object_name from public.objects where id = v_tool.current_object_id;
        raise exception 'Уже выдан на объект %, сначала верните или используйте перемещение',
          coalesce(v_object_name, 'другой объект');
      end if;
      if v_tool.status <> 'free' then
        raise exception 'Выдать можно только свободный инструмент';
      end if;
      if _object_id is null then
        raise exception 'Укажите объект для выдачи';
      end if;
    when 'extra_delivery' then
      if v_tool.status <> 'on_object' or v_tool.current_object_id is distinct from _object_id then
        raise exception 'Довоз допустим только для инструмента, уже находящегося на этом объекте';
      end if;
    when 'return' then
      if v_tool.status = 'free' then
        raise exception 'Нельзя вернуть свободный инструмент';
      end if;
      if v_tool.status <> 'on_object' then
        raise exception 'Вернуть можно только инструмент с объекта';
      end if;
    when 'transfer' then
      if v_tool.status <> 'on_object' then
        raise exception 'Переместить можно только инструмент с объекта';
      end if;
      if _object_id is null then
        raise exception 'Укажите объект назначения';
      end if;
      if v_tool.current_object_id = _object_id then
        raise exception 'Инструмент уже на этом объекте';
      end if;
    when 'to_repair' then
      if v_tool.status = 'free' then
        raise exception 'Нельзя отправить в ремонт свободный инструмент';
      end if;
      if v_tool.status <> 'on_object' then
        raise exception 'В ремонт можно отправить только инструмент с объекта';
      end if;
    when 'from_repair' then
      if v_tool.status <> 'repair' then
        raise exception 'Этот инструмент не в ремонте';
      end if;
    when 'loss' then
      if v_tool.status in ('lost', 'written_off') then
        raise exception 'Инструмент уже отмечен как утерянный или списанный';
      end if;
    when 'write_off' then
      null;
    else
      raise exception 'Неизвестный тип движения';
  end case;

  perform set_config('kotov.skip_tool_guard', 'on', true);

  insert into public.tool_movements (
    tool_id, movement_type, object_id,
    from_holder_id, to_holder_id, moved_at, comment, created_by
  )
  values (
    _tool_id, _movement_type, _object_id,
    v_tool.current_holder_id, _to_holder_id, coalesce(_moved_at, now()), _comment, auth.uid()
  )
  returning id into v_id;

  update public.tools set
    status = case _movement_type
      when 'issue' then 'on_object'
      when 'extra_delivery' then 'on_object'
      when 'transfer' then 'on_object'
      when 'return' then 'free'
      when 'to_repair' then 'repair'
      when 'from_repair' then 'free'
      when 'loss' then 'lost'
      when 'write_off' then 'written_off'
    end,
    current_object_id = case
      when _movement_type in ('issue', 'extra_delivery', 'transfer') then _object_id
      else null
    end,
    current_holder_id = case
      when _movement_type in ('issue', 'extra_delivery', 'transfer') then _to_holder_id
      else null
    end,
    updated_at = now()
  where id = _tool_id;

  return v_id;
end;
$$;

create or replace function public.create_tool_movements_bulk(
  _tool_ids uuid[],
  _movement_type public.tool_movement_type,
  _object_id uuid default null,
  _to_holder_id uuid default null,
  _comment text default null,
  _moved_at timestamptz default now()
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_ids uuid[] := '{}';
  v_tool_id uuid;
begin
  if _tool_ids is null or array_length(_tool_ids, 1) is null then
    raise exception 'Список инструментов пуст';
  end if;

  foreach v_tool_id in array _tool_ids loop
    v_id := public.create_tool_movement(
      v_tool_id, _movement_type, _object_id, _to_holder_id, _comment, _moved_at
    );
    v_ids := array_append(v_ids, v_id);
  end loop;

  return v_ids;
end;
$$;

revoke all on function public.create_tool_movement(uuid, public.tool_movement_type, uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.create_tool_movements_bulk(uuid[], public.tool_movement_type, uuid, uuid, text, timestamptz) from public, anon;

grant execute on function public.create_tool_movement(uuid, public.tool_movement_type, uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.create_tool_movements_bulk(uuid[], public.tool_movement_type, uuid, uuid, text, timestamptz) to authenticated;
