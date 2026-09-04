-- Enums. Add value if not exists — откат add value невозможен.

do $$ begin
  create type public.app_role as enum ('owner', 'prod_foreman', 'install_foreman', 'accountant');
exception
  when duplicate_object then null;
end $$;

alter type public.app_role add value if not exists 'owner';
alter type public.app_role add value if not exists 'prod_foreman';
alter type public.app_role add value if not exists 'install_foreman';
alter type public.app_role add value if not exists 'accountant';

do $$ begin
  create type public.object_status as enum (
    'new', 'in_production', 'in_installation', 'suspended', 'completed', 'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

alter type public.object_status add value if not exists 'new';
alter type public.object_status add value if not exists 'in_production';
alter type public.object_status add value if not exists 'in_installation';
alter type public.object_status add value if not exists 'suspended';
alter type public.object_status add value if not exists 'completed';
alter type public.object_status add value if not exists 'cancelled';

do $$ begin
  create type public.stage_type as enum ('production', 'installation');
exception
  when duplicate_object then null;
end $$;

alter type public.stage_type add value if not exists 'production';
alter type public.stage_type add value if not exists 'installation';

do $$ begin
  create type public.stage_status as enum ('not_started', 'in_progress', 'done', 'blocked');
exception
  when duplicate_object then null;
end $$;

alter type public.stage_status add value if not exists 'not_started';
alter type public.stage_status add value if not exists 'in_progress';
alter type public.stage_status add value if not exists 'done';
alter type public.stage_status add value if not exists 'blocked';

do $$ begin
  create type public.tool_status as enum ('free', 'on_object', 'repair', 'lost', 'written_off');
exception
  when duplicate_object then null;
end $$;

alter type public.tool_status add value if not exists 'free';
alter type public.tool_status add value if not exists 'on_object';
alter type public.tool_status add value if not exists 'repair';
alter type public.tool_status add value if not exists 'lost';
alter type public.tool_status add value if not exists 'written_off';

do $$ begin
  create type public.tool_movement_type as enum (
    'issue', 'extra_delivery', 'return', 'transfer', 'to_repair', 'from_repair', 'loss', 'write_off'
  );
exception
  when duplicate_object then null;
end $$;

alter type public.tool_movement_type add value if not exists 'issue';
alter type public.tool_movement_type add value if not exists 'extra_delivery';
alter type public.tool_movement_type add value if not exists 'return';
alter type public.tool_movement_type add value if not exists 'transfer';
alter type public.tool_movement_type add value if not exists 'to_repair';
alter type public.tool_movement_type add value if not exists 'from_repair';
alter type public.tool_movement_type add value if not exists 'loss';
alter type public.tool_movement_type add value if not exists 'write_off';

do $$ begin
  create type public.attachment_kind as enum ('photo', 'video', 'document');
exception
  when duplicate_object then null;
end $$;

alter type public.attachment_kind add value if not exists 'photo';
alter type public.attachment_kind add value if not exists 'video';
alter type public.attachment_kind add value if not exists 'document';

do $$ begin
  create type public.request_status as enum ('new', 'approved', 'purchased', 'rejected');
exception
  when duplicate_object then null;
end $$;

alter type public.request_status add value if not exists 'new';
alter type public.request_status add value if not exists 'approved';
alter type public.request_status add value if not exists 'purchased';
alter type public.request_status add value if not exists 'rejected';
