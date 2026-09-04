-- Разрешить отправку в ремонт со статуса «свободен» (со склада).
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
  v_new_status public.tool_status;
  v_movement_object_id uuid;
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
    -- Ремонт со склада и из ремонта не требуют объекта
    if _movement_type not in ('to_repair', 'from_repair') then
      if _object_id is null or not public.has_object_access(_object_id) then
        raise exception 'Нет доступа к объекту';
      end if;
    elsif _movement_type = 'to_repair'
      and v_tool.status = 'on_object'
      and (v_tool.current_object_id is null or not public.has_object_access(v_tool.current_object_id)) then
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
      v_new_status := 'on_object';

    when 'extra_delivery' then
      if v_tool.status <> 'on_object' or v_tool.current_object_id is distinct from _object_id then
        raise exception 'Довоз допустим только для инструмента, уже находящегося на этом объекте';
      end if;
      v_new_status := 'on_object';

    when 'return' then
      if v_tool.status = 'free' then
        raise exception 'Нельзя вернуть свободный инструмент';
      end if;
      if v_tool.status <> 'on_object' then
        raise exception 'Вернуть можно только инструмент с объекта';
      end if;
      v_new_status := 'free';

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
      v_new_status := 'on_object';

    when 'to_repair' then
      if v_tool.status not in ('free', 'on_object') then
        raise exception 'В ремонт можно отправить свободный инструмент или инструмент с объекта';
      end if;
      v_new_status := 'repair';

    when 'from_repair' then
      if v_tool.status <> 'repair' then
        raise exception 'Этот инструмент не в ремонте';
      end if;
      v_new_status := 'free';

    when 'loss' then
      if v_tool.status in ('lost', 'written_off') then
        raise exception 'Инструмент уже отмечен как утерянный или списанный';
      end if;
      v_new_status := 'lost';

    when 'write_off' then
      v_new_status := 'written_off';

    else
      raise exception 'Неизвестный тип движения';
  end case;

  v_movement_object_id := coalesce(
    _object_id,
    case when _movement_type = 'to_repair' then v_tool.current_object_id else null end
  );

  perform set_config('kotov.skip_tool_guard', 'on', true);

  insert into public.tool_movements (
    tool_id, movement_type, object_id,
    from_holder_id, to_holder_id, moved_at, comment, created_by
  )
  values (
    _tool_id, _movement_type, v_movement_object_id,
    v_tool.current_holder_id, _to_holder_id, coalesce(_moved_at, now()), _comment, auth.uid()
  )
  returning id into v_id;

  update public.tools set
    status = v_new_status,
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
