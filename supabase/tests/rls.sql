-- Приёмочные проверки RLS (п. 5.3 ТЗ).
-- Запуск на стенде: подставить JWT бригадира / бухгалтера / anon через SET request.jwt.claim.sub
-- или прогнать клиентами service/anon/authenticated.

-- 1. RLS включён на всех таблицах public.
do $$
declare
  missing text;
begin
  select string_agg(c.relname, ', ')
  into missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and not c.relrowsecurity;

  if missing is not null then
    raise exception 'RLS выключен на: %', missing;
  end if;
end $$;

-- 2. Политики существуют.
do $$
begin
  if (select count(*) from pg_policies where schemaname = 'public') < 20 then
    raise exception 'Слишком мало политик RLS';
  end if;
end $$;
