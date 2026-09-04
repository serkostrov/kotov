-- Срок задачи: дата + время.
alter table public.material_requests
  alter column need_by type timestamptz
  using case
    when need_by is null then null
    else (need_by::text || ' 00:00:00')::timestamp at time zone 'Europe/Moscow'
  end;
