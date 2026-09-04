-- Views с security_invoker = on, иначе обходят RLS.

create or replace view public.v_object_economics
  with (security_invoker = on)
as
select
  o.id as object_id,
  o.contract_amount,
  coalesce(sum(e.amount), 0) as expenses_total,
  o.contract_amount - coalesce(sum(e.amount), 0) as profit,
  case
    when o.contract_amount > 0
      then round(
        (o.contract_amount - coalesce(sum(e.amount), 0)) / o.contract_amount * 100,
        1
      )
  end as margin_percent
from public.objects o
left join public.expenses e on e.object_id = o.id and e.deleted_at is null
where o.deleted_at is null
  and (public.is_owner() or public.has_role('accountant'))
group by o.id;

create or replace view public.v_object_expenses_by_category
  with (security_invoker = on)
as
select
  e.object_id,
  e.category_id,
  c.name as category_name,
  coalesce(sum(e.amount), 0) as amount_total
from public.expenses e
join public.expense_categories c on c.id = e.category_id
where e.deleted_at is null
group by e.object_id, e.category_id, c.name;

create or replace view public.v_object_expenses_by_contour
  with (security_invoker = on)
as
select
  e.object_id,
  s.stage_type,
  coalesce(sum(e.amount), 0) as amount_total
from public.expenses e
left join public.object_stages s on s.id = e.stage_id and s.deleted_at is null
where e.deleted_at is null
group by e.object_id, s.stage_type;

create or replace view public.v_object_progress
  with (security_invoker = on)
as
select
  o.id as object_id,
  (
    select avg(st.progress_percent)::numeric(5,1)
    from public.object_stages st
    where st.object_id = o.id
      and st.deleted_at is null
      and st.stage_type = 'production'
  ) as progress_production,
  (
    select avg(st.progress_percent)::numeric(5,1)
    from public.object_stages st
    where st.object_id = o.id
      and st.deleted_at is null
      and st.stage_type = 'installation'
  ) as progress_installation,
  (
    select avg(st.progress_percent)::numeric(5,1)
    from public.object_stages st
    where st.object_id = o.id
      and st.deleted_at is null
  ) as progress_total
from public.objects o
where o.deleted_at is null;
