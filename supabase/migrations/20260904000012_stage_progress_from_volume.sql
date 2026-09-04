-- Progress from volume when plan is set; otherwise done = 100%.
create or replace function public.stage_status_sync()
returns trigger
language plpgsql
as $$
declare
  fact numeric := coalesce(new.qty_fact, 0);
  progress int := 0;
begin
  if new.qty_plan is not null and new.qty_plan > 0 then
    progress := least(100, greatest(0, round((fact / new.qty_plan) * 100)::int));
  elsif new.status = 'done' then
    progress := 100;
  end if;

  if new.status = 'done' then
    new.progress_percent = progress;
    new.date_fact_end = coalesce(new.date_fact_end, current_date);
  elsif new.status = 'blocked' then
    new.progress_percent = progress;
  elsif fact > 0 then
    new.status = 'in_progress';
    new.progress_percent = progress;
  else
    new.status = 'not_started';
    new.progress_percent = progress;
  end if;

  if tg_op = 'UPDATE'
     and old.status is distinct from 'in_progress'
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
  before insert or update of status, qty_plan, qty_fact on public.object_stages
  for each row execute function public.stage_status_sync();
