-- Справочник контактов заказчиков (ФИО + телефон).

create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  phone       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists contacts_active_name_idx
  on public.contacts (full_name)
  where deleted_at is null;

alter table public.objects
  add column if not exists customer_contact_id uuid references public.contacts(id) on delete set null;

create index if not exists objects_customer_contact_id_idx
  on public.objects (customer_contact_id);

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

alter table public.contacts enable row level security;

drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select to authenticated
  using (
    deleted_at is null
    and public.has_any_role()
  );

drop policy if exists contacts_insert on public.contacts;
create policy contacts_insert on public.contacts
  for insert to authenticated
  with check (public.is_owner());

drop policy if exists contacts_update on public.contacts;
create policy contacts_update on public.contacts
  for update to authenticated
  using (public.is_owner())
  with check (public.is_owner());

drop policy if exists contacts_delete on public.contacts;
create policy contacts_delete on public.contacts
  for delete to authenticated
  using (public.is_owner());
