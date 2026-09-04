-- Ensure installation work templates exist in settings catalog.
insert into public.stage_templates (stage_type, name, unit, sort_order)
select v.stage_type, v.name, v.unit, v.sort_order
from (
  values
    ('installation'::public.stage_type, 'Бетонные работы / фундамент', null, 10),
    ('installation'::public.stage_type, 'Монтаж металлоконструкций', null, 20),
    ('installation'::public.stage_type, 'Сэндвич-панели', 'м2', 30),
    ('installation'::public.stage_type, 'Кровля', 'м2', 40),
    ('installation'::public.stage_type, 'Ворота и двери', 'шт', 50)
) as v(stage_type, name, unit, sort_order)
where not exists (
  select 1 from public.stage_templates t
  where t.stage_type = v.stage_type and t.name = v.name
);
