-- NUMORA ADM 01: internal identities, RBAC foundation and append-only audit trail.

create table public.admin_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 150),
  role text not null check (role in ('ADMIN', 'CONSULTANT', 'VIEWER')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create index admin_profiles_active_role_idx
  on public.admin_profiles (is_active, role);

create trigger admin_profiles_updated_at
  before update on public.admin_profiles
  for each row execute function public.set_updated_at();

create table public.admin_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  profile_id uuid references public.admin_profiles(id) on delete set null,
  event_type text not null check (event_type in (
    'ADMIN_LOGIN',
    'ADMIN_LOGOUT',
    'ADMIN_ACCESS_DENIED',
    'PASSWORD_RECOVERY_REQUESTED'
  )),
  succeeded boolean not null,
  reason_code text check (
    reason_code is null or (
      char_length(reason_code) between 1 and 100
      and reason_code ~ '^[A-Z0-9_]+$'
    )
  ),
  created_at timestamptz not null default now()
);

create index admin_audit_events_actor_created_idx
  on public.admin_audit_events (actor_user_id, created_at desc);
create index admin_audit_events_type_created_idx
  on public.admin_audit_events (event_type, created_at desc);

create trigger admin_audit_events_immutable
  before update or delete on public.admin_audit_events
  for each row execute function public.guard_immutable_event();

alter table public.admin_profiles enable row level security;
alter table public.admin_audit_events enable row level security;

revoke all on table public.admin_profiles, public.admin_audit_events
  from anon, authenticated;

grant select (id, user_id, display_name, role, is_active, created_at, updated_at)
  on public.admin_profiles to authenticated;

create policy admin_profiles_read_own_active
  on public.admin_profiles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and is_active = true
    and role in ('ADMIN', 'CONSULTANT', 'VIEWER')
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );

alter table public.admin_profiles force row level security;
alter table public.admin_audit_events force row level security;

comment on table public.admin_profiles is
  'Canonical internal access profile. Role and activation are managed only by trusted backend operations.';
comment on policy admin_profiles_read_own_active on public.admin_profiles is
  'Authenticated non-anonymous users may read only their own active profile; browser writes are not granted.';
comment on table public.admin_audit_events is
  'Append-only security events for the internal NUMORA ADM. Passwords, JWTs and secrets are prohibited.';
