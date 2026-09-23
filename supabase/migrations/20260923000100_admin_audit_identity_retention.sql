-- Keep immutable audit identifiers even when an internal identity is removed.
-- Foreign-key SET NULL actions would update append-only rows and be rejected by
-- the immutable-event trigger, preventing secure user deprovisioning.

alter table public.admin_audit_events
  drop constraint admin_audit_events_actor_user_id_fkey,
  drop constraint admin_audit_events_profile_id_fkey;

comment on column public.admin_audit_events.actor_user_id is
  'Historical Auth user identifier. Intentionally not a foreign key so immutable events survive identity removal.';
comment on column public.admin_audit_events.profile_id is
  'Historical admin profile identifier. Intentionally not a foreign key so immutable events survive profile removal.';
