-- Dual stage progress: volume mode (qty_plan > 0) vs manual percent mode.
create or replace function public.stage_status_sync()
returns trigger
language plpgsql
as $$
declare
  plan numeric := new.qty_plan;
  fact numeric := coalesce(new.qty_fact, 0);
begin
  if plan is not null and plan > 0 then
    -- Mode A: progress from volume, status derived
    new.progress_percent := least(100, greatest(0, round((fact / plan) * 100)::int));
    if new.status not in ('done', 'blocked') then
      new.status := case when fact > 0 then 'in_progress' else 'not_started' end;
    end if;
  else
    -- Mode B: status is leading, percent entered manually
    new.progress_percent := least(100, greatest(0, coalesce(new.progress_percent, 0)));
    if new.status = 'not_started' then
      new.progress_percent := 0;
    end if;
  end if;

  if new.status = 'done' then
    new.progress_percent := 100;
    new.date_fact_end := coalesce(new.date_fact_end, current_date);
  end if;

  if new.status = 'in_progress'
     and (tg_op = 'INSERT' or old.status is distinct from 'in_progress') then
    new.date_start := coalesce(new.date_start, current_date);
  end if;

  return new;
end;
$$;

drop trigger if exists object_stages_status_sync on public.object_stages;
create trigger object_stages_status_sync
  before insert or update of status, qty_plan, qty_fact, progress_percent
  on public.object_stages
  for each row execute function public.stage_status_sync();
