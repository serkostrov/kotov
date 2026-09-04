-- Учётная почта из auth.users в профиле + RPC для списка.

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and (p.email is null or p.email = '');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'Пользователь'),
    new.raw_user_meta_data->>'phone',
    new.email
  )
  on conflict (id) do update
    set email = excluded.email
    where public.profiles.email is distinct from excluded.email;
  return new;
end;
$$;

-- Руководитель видит учётные email из Auth (источник истины для входа).
create or replace function public.list_auth_emails()
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'Недостаточно прав';
  end if;

  return query
  select u.id, u.email::text
  from auth.users u;
end;
$$;

revoke all on function public.list_auth_emails() from public, anon;
grant execute on function public.list_auth_emails() to authenticated;
