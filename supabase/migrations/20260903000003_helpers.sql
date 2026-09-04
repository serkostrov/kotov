-- Вспомогательные функции: метки времени, роли, доступ к объектам.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_created_by()
returns trigger
language plpgsql
as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.has_role(_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = _role
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_role('owner');
$$;

create or replace function public.has_any_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid()
  );
$$;

create or replace function public.has_object_access(_object_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner()
    or public.has_role('accountant')
    or exists (
      select 1 from public.object_members m
      where m.object_id = _object_id and m.user_id = auth.uid()
    );
$$;

revoke all on function public.has_role(public.app_role) from public, anon;
revoke all on function public.is_owner() from public, anon;
revoke all on function public.has_any_role() from public, anon;
revoke all on function public.has_object_access(uuid) from public, anon;

grant execute on function public.has_role(public.app_role) to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.has_any_role() to authenticated;
grant execute on function public.has_object_access(uuid) to authenticated;
