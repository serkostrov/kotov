-- Пользователи, объекты, этапы, инструмент, расходы, файлы, заявки, журнал.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text,
  position    text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.user_roles (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users(id) on delete cascade,
  role     public.app_role not null,
  unique (user_id, role)
);

create table if not exists public.objects (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  address            text,
  customer_name      text,
  customer_contact   text,
  date_start         date,
  date_plan_end      date,
  date_fact_end      date,
  contract_amount    numeric(14,2) not null default 0,
  status             public.object_status not null default 'new',
  responsible_id     uuid references public.profiles(id),
  comment            text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  created_by         uuid references auth.users(id),
  deleted_at         timestamptz
);

create index if not exists objects_status_active_idx on public.objects (status) where deleted_at is null;
create index if not exists objects_responsible_id_idx on public.objects (responsible_id);

create table if not exists public.object_members (
  id         uuid primary key default gen_random_uuid(),
  object_id  uuid not null references public.objects(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  unique (object_id, user_id)
);

create table if not exists public.stage_templates (
  id          uuid primary key default gen_random_uuid(),
  stage_type  public.stage_type not null,
  name        text not null,
  unit        text,
  sort_order  int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.object_stages (
  id                uuid primary key default gen_random_uuid(),
  object_id         uuid not null references public.objects(id) on delete cascade,
  stage_type        public.stage_type not null,
  template_id       uuid references public.stage_templates(id),
  name              text not null,
  unit              text,
  qty_plan          numeric(12,3),
  qty_fact          numeric(12,3),
  progress_percent  int not null default 0 check (progress_percent between 0 and 100),
  status            public.stage_status not null default 'not_started',
  date_start        date,
  date_plan_end     date,
  date_fact_end     date,
  responsible_id    uuid references public.profiles(id),
  comment           text,
  sort_order        int not null default 100,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  deleted_at        timestamptz
);

create index if not exists object_stages_object_type_idx
  on public.object_stages (object_id, stage_type) where deleted_at is null;
create index if not exists object_stages_responsible_status_idx
  on public.object_stages (responsible_id, status);

create table if not exists public.tool_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 100,
  is_active  boolean not null default true
);

create table if not exists public.tools (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  inventory_number  text,
  category_id       uuid references public.tool_categories(id),
  status            public.tool_status not null default 'free',
  current_object_id uuid references public.objects(id),
  current_holder_id uuid references public.profiles(id),
  purchase_date     date,
  purchase_price    numeric(14,2),
  comment           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  deleted_at        timestamptz
);

create unique index if not exists tools_inventory_number_uidx
  on public.tools (inventory_number)
  where inventory_number is not null and deleted_at is null;
create index if not exists tools_status_active_idx on public.tools (status) where deleted_at is null;
create index if not exists tools_current_object_id_idx on public.tools (current_object_id);

create table if not exists public.tool_movements (
  id             uuid primary key default gen_random_uuid(),
  tool_id        uuid not null references public.tools(id) on delete cascade,
  movement_type  public.tool_movement_type not null,
  object_id      uuid references public.objects(id),
  from_holder_id uuid references public.profiles(id),
  to_holder_id   uuid references public.profiles(id),
  moved_at       timestamptz not null default now(),
  comment        text,
  created_at     timestamptz not null default now(),
  created_by     uuid references auth.users(id)
);

create index if not exists tool_movements_tool_moved_idx on public.tool_movements (tool_id, moved_at desc);
create index if not exists tool_movements_object_id_idx on public.tool_movements (object_id);

create table if not exists public.expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  sort_order int not null default 100,
  is_active  boolean not null default true
);

create table if not exists public.expenses (
  id            uuid primary key default gen_random_uuid(),
  object_id     uuid not null references public.objects(id) on delete cascade,
  stage_id      uuid references public.object_stages(id) on delete set null,
  category_id   uuid not null references public.expense_categories(id),
  amount        numeric(14,2) not null check (amount >= 0),
  expense_date  date not null default current_date,
  description   text,
  vendor        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id),
  deleted_at    timestamptz
);

create index if not exists expenses_object_date_idx
  on public.expenses (object_id, expense_date desc) where deleted_at is null;
create index if not exists expenses_category_id_idx on public.expenses (category_id);

create table if not exists public.attachments (
  id                uuid primary key default gen_random_uuid(),
  object_id         uuid not null references public.objects(id) on delete cascade,
  stage_id          uuid references public.object_stages(id) on delete set null,
  expense_id        uuid references public.expenses(id) on delete set null,
  tool_movement_id  uuid references public.tool_movements(id) on delete set null,
  kind              public.attachment_kind not null,
  storage_path      text not null unique,
  file_name         text not null,
  mime_type         text,
  file_size         bigint,
  comment           text,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users(id),
  deleted_at        timestamptz
);

create index if not exists attachments_object_kind_idx
  on public.attachments (object_id, kind) where deleted_at is null;
create index if not exists attachments_stage_id_idx on public.attachments (stage_id);

create table if not exists public.material_requests (
  id              uuid primary key default gen_random_uuid(),
  object_id       uuid not null references public.objects(id) on delete cascade,
  stage_id        uuid references public.object_stages(id) on delete set null,
  title           text not null,
  details         text,
  need_by         date,
  status          public.request_status not null default 'new',
  resolved_by     uuid references public.profiles(id),
  resolved_at     timestamptz,
  resolve_comment text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id),
  deleted_at      timestamptz
);

create index if not exists material_requests_status_created_idx
  on public.material_requests (status, created_at desc) where deleted_at is null;

create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id   uuid not null,
  object_id   uuid references public.objects(id) on delete cascade,
  action      text not null,
  payload     jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create index if not exists activity_log_object_created_idx
  on public.activity_log (object_id, created_at desc);

create table if not exists public.organization_profile (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  details    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
