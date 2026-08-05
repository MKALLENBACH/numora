-- Configurable retention entry point. Defaults are technical placeholders and require
-- organizational/legal approval before production scheduling.

create or replace function public.cleanup_diagnostic_retention(
  p_abandoned_days integer default 30,
  p_no_contact_days integer default 30,
  p_commercial_lead_days integer default 730,
  p_technical_error_days integer default 180
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  diagnostic_ids uuid[];
  lead_ids uuid[];
  company_ids uuid[];
  owner_ids uuid[];
  deleted_diagnostics integer := 0;
  deleted_leads integer := 0;
  deleted_companies integer := 0;
  deleted_errors integer := 0;
  deleted_auth_users integer := 0;
begin
  if least(p_abandoned_days, p_no_contact_days, p_commercial_lead_days, p_technical_error_days) < 1 then
    raise exception using errcode = '22023', message = 'retention periods must be positive';
  end if;

  update public.diagnostic_sessions
    set status = 'EXPIRED', last_activity_at = now()
    where status in ('ACTIVE', 'PAUSED') and expires_at <= now();
  update public.diagnostics d
    set status = 'EXPIRED'
    where status not in ('COMPLETED', 'COMPLETED_NO_CONTACT', 'BLOCKED', 'EXPIRED', 'ABANDONED')
      and exists (
        select 1 from public.diagnostic_sessions s
        where s.diagnostic_id = d.id and s.status = 'EXPIRED'
      );

  select
    coalesce(array_agg(d.id), '{}'::uuid[]),
    coalesce(array_agg(d.lead_id) filter (where d.lead_id is not null), '{}'::uuid[]),
    coalesce(array_agg(distinct d.owner_user_id), '{}'::uuid[])
  into diagnostic_ids, lead_ids, owner_ids
  from public.diagnostics d
  where
    (d.status in ('ABANDONED', 'EXPIRED', 'BLOCKED') and d.updated_at < now() - make_interval(days => p_abandoned_days))
    or (d.status = 'COMPLETED_NO_CONTACT' and d.completed_at < now() - make_interval(days => p_no_contact_days))
    or (d.status = 'COMPLETED' and d.completed_at < now() - make_interval(days => p_commercial_lead_days));

  select coalesce(array_agg(distinct company_id), '{}'::uuid[])
    into company_ids from public.leads where id = any(lead_ids);

  perform set_config('app.retention_cleanup', 'on', true);
  delete from public.diagnostics where id = any(diagnostic_ids);
  get diagnostics deleted_diagnostics = row_count;
  delete from public.leads l
    where l.id = any(lead_ids)
      and not exists (select 1 from public.diagnostics d where d.lead_id = l.id);
  get diagnostics deleted_leads = row_count;
  delete from public.companies c
    where c.id = any(company_ids)
      and not exists (select 1 from public.leads l where l.company_id = c.id);
  get diagnostics deleted_companies = row_count;
  delete from public.technical_errors
    where created_at < now() - make_interval(days => p_technical_error_days);
  get diagnostics deleted_errors = row_count;
  delete from public.idempotency_records where expires_at < now();
  delete from public.rate_limit_counters where updated_at < now() - interval '2 hours';

  -- Anonymous Auth identities are removed only after all diagnostics and leads have gone.
  -- The conditional keeps this migration compatible with older local GoTrue schemas.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users' and column_name = 'is_anonymous'
  ) then
    execute $delete_auth$
      delete from auth.users u
      where u.id = any($1)
        and u.is_anonymous is true
        and not exists (select 1 from public.diagnostics d where d.owner_user_id = u.id)
        and not exists (select 1 from public.leads l where l.owner_user_id = u.id)
    $delete_auth$ using owner_ids;
    get diagnostics deleted_auth_users = row_count;
  end if;

  return jsonb_build_object(
    'deletedDiagnostics', deleted_diagnostics,
    'deletedLeads', deleted_leads,
    'deletedCompanies', deleted_companies,
    'deletedTechnicalErrors', deleted_errors,
    'deletedAnonymousUsers', deleted_auth_users,
    'executedAt', now()
  );
end;
$$;

comment on function public.cleanup_diagnostic_retention(integer, integer, integer, integer) is
  'Schedule this function externally (for example with Supabase Cron). Defaults are technical proposals, not legal requirements; approve values before production.';

revoke all on function public.cleanup_diagnostic_retention(integer, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.cleanup_diagnostic_retention(integer, integer, integer, integer)
  to service_role;
