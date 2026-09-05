-- Сид справочников. Идемпотентно.

insert into public.stage_templates (stage_type, name, unit, sort_order)
select v.stage_type, v.name, v.unit, v.sort_order
from (
  values
    ('production'::public.stage_type, 'Фундаментные блоки', 'шт', 10),
    ('production'::public.stage_type, 'Закладные детали', 'шт', 20),
    ('production'::public.stage_type, 'Колонны', 'шт', 30),
    ('production'::public.stage_type, 'Связи', 'шт', 40),
    ('production'::public.stage_type, 'Балки перекрытия', 'шт', 50),
    ('production'::public.stage_type, 'Фахверк', 'шт', 60),
    ('production'::public.stage_type, 'Оконные и дверные проёмы', 'шт', 70),
    ('installation'::public.stage_type, 'Бетонные работы / фундамент', null, 10),
    ('installation'::public.stage_type, 'Монтаж металлоконструкций', null, 20),
    ('installation'::public.stage_type, 'Сэндвич-панели', 'м2', 30)
) as v(stage_type, name, unit, sort_order)
where not exists (
  select 1 from public.stage_templates t
  where t.stage_type = v.stage_type and t.name = v.name
);

insert into public.expense_categories (name, sort_order)
select v.name, v.sort_order
from (
  values
    ('Расходные материалы', 10),
    ('Оплата труда / бригады', 20),
    ('Спецтехника', 30),
    ('Покупка / аренда инструмента', 40),
    ('Материалы', 50),
    ('Прочее', 60)
) as v(name, sort_order)
on conflict (name) do nothing;

insert into public.tool_categories (name, sort_order)
select v.name, v.sort_order
from (
  values
    ('Сварка', 10),
    ('Резка', 20),
    ('Измерение', 30),
    ('Ручной инструмент', 40),
    ('Оснастка площадки', 50),
    ('СИЗ и прочее', 60)
) as v(name, sort_order)
on conflict (name) do nothing;

insert into public.organization_profile (name, details)
select
  'Теплый контур',
  'Изготовление и монтаж металлоконструкций' || E'\n' || 'г. Нижний Новгород'
where not exists (select 1 from public.organization_profile);
