-- Cross-table ownership, immutable histories, safe state transitions and secret guards.

alter table public.leads add constraint leads_id_owner_unique unique (id, owner_user_id);
alter table public.diagnostics add constraint diagnostics_id_owner_unique unique (id, owner_user_id);
alter table public.diagnostic_sessions add constraint sessions_id_diagnostic_owner_unique unique (id, diagnostic_id, owner_user_id);

alter table public.diagnostics
  add constraint diagnostics_lead_owner_fk
  foreign key (lead_id, owner_user_id) references public.leads(id, owner_user_id) on delete restrict;
alter table public.diagnostic_sessions
  add constraint sessions_diagnostic_owner_fk
  foreign key (diagnostic_id, owner_user_id) references public.diagnostics(id, owner_user_id) on delete cascade;
alter table public.consent_records
  add constraint consents_diagnostic_owner_fk
  foreign key (diagnostic_id, owner_user_id) references public.diagnostics(id, owner_user_id) on delete cascade;
alter table public.interview_question_events
  add constraint question_events_session_owner_fk
  foreign key (session_id, diagnostic_id, owner_user_id)
  references public.diagnostic_sessions(id, diagnostic_id, owner_user_id) on delete cascade;
alter table public.interview_answers
  add constraint answers_session_owner_fk
  foreign key (session_id, diagnostic_id, owner_user_id)
  references public.diagnostic_sessions(id, diagnostic_id, owner_user_id) on delete cascade;
alter table public.conversation_messages
  add constraint messages_session_owner_fk
  foreign key (session_id, diagnostic_id, owner_user_id)
  references public.diagnostic_sessions(id, diagnostic_id, owner_user_id) on delete cascade;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.bump_row_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.row_version := old.row_version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger leads_version_before_update before update on public.leads
  for each row execute function public.bump_row_version();
create trigger diagnostics_version_before_update before update on public.diagnostics
  for each row execute function public.bump_row_version();
create trigger sessions_version_before_update before update on public.diagnostic_sessions
  for each row execute function public.bump_row_version();
create trigger reviews_version_before_update before update on public.diagnostic_reviews
  for each row execute function public.bump_row_version();

create trigger companies_updated_at before update on public.companies
  for each row execute function public.set_updated_at();
create trigger answers_updated_at before update on public.interview_answers
  for each row execute function public.set_updated_at();
create trigger flags_updated_at before update on public.diagnostic_flags
  for each row execute function public.set_updated_at();
create trigger rate_limits_updated_at before update on public.rate_limit_counters
  for each row execute function public.set_updated_at();

create or replace function public.guard_immutable_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('app.retention_cleanup', true) = 'on' and tg_op = 'DELETE' then
    return old;
  end if;
  raise exception using errcode = '55000', message = tg_table_name || ' is append-only';
end;
$$;

create trigger consent_records_immutable before update or delete on public.consent_records
  for each row execute function public.guard_immutable_event();
create trigger audit_events_immutable before update or delete on public.audit_events
  for each row execute function public.guard_immutable_event();
create trigger flag_events_immutable before update or delete on public.diagnostic_flag_events
  for each row execute function public.guard_immutable_event();

create or replace function public.valid_diagnostic_transition(
  old_status public.diagnostic_status,
  new_status public.diagnostic_status
) returns boolean
language sql immutable strict
set search_path = ''
as $$
  select old_status = new_status or (old_status, new_status) in (
    ('INTRODUCTION', 'PRIVACY_CONSENT'),
    ('PRIVACY_CONSENT', 'COMMERCIAL_CONSENT'),
    ('PRIVACY_CONSENT', 'BLOCKED'),
    ('COMMERCIAL_CONSENT', 'IDENTIFICATION'),
    ('IDENTIFICATION', 'CHALLENGE'),
    ('CHALLENGE', 'CURRENT_PROCESS'),
    ('CURRENT_PROCESS', 'IMPACT'),
    ('IMPACT', 'BUYING_CONTEXT'),
    ('BUYING_CONTEXT', 'REVIEW_GENERATING'),
    ('REVIEW_GENERATING', 'REVIEW_PENDING'),
    ('REVIEW_GENERATING', 'BLOCKED'),
    ('REVIEW_PENDING', 'REVIEW_EDITING'),
    ('REVIEW_EDITING', 'REVIEW_GENERATING'),
    ('REVIEW_PENDING', 'COMPLETING'),
    ('COMPLETING', 'COMPLETED'),
    ('COMPLETING', 'COMPLETED_NO_CONTACT'),
    ('INTRODUCTION', 'ABANDONED'),
    ('PRIVACY_CONSENT', 'ABANDONED'),
    ('COMMERCIAL_CONSENT', 'ABANDONED'),
    ('IDENTIFICATION', 'ABANDONED'),
    ('CHALLENGE', 'ABANDONED'),
    ('CURRENT_PROCESS', 'ABANDONED'),
    ('IMPACT', 'ABANDONED'),
    ('BUYING_CONTEXT', 'ABANDONED'),
    ('REVIEW_GENERATING', 'ABANDONED'),
    ('REVIEW_PENDING', 'ABANDONED'),
    ('REVIEW_EDITING', 'ABANDONED'),
    ('INTRODUCTION', 'EXPIRED'),
    ('PRIVACY_CONSENT', 'EXPIRED'),
    ('COMMERCIAL_CONSENT', 'EXPIRED'),
    ('IDENTIFICATION', 'EXPIRED'),
    ('CHALLENGE', 'EXPIRED'),
    ('CURRENT_PROCESS', 'EXPIRED'),
    ('IMPACT', 'EXPIRED'),
    ('BUYING_CONTEXT', 'EXPIRED'),
    ('REVIEW_GENERATING', 'EXPIRED'),
    ('REVIEW_PENDING', 'EXPIRED'),
    ('REVIEW_EDITING', 'EXPIRED'),
    ('IDENTIFICATION', 'BLOCKED'),
    ('CHALLENGE', 'BLOCKED'),
    ('CURRENT_PROCESS', 'BLOCKED'),
    ('IMPACT', 'BLOCKED'),
    ('BUYING_CONTEXT', 'BLOCKED'),
    ('REVIEW_PENDING', 'BLOCKED')
  );
$$;

create or replace function public.enforce_diagnostic_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.valid_diagnostic_transition(old.status, new.status) then
    raise exception using errcode = '23514', message = 'invalid diagnostic state transition';
  end if;
  if new.owner_user_id <> old.owner_user_id then
    raise exception using errcode = '42501', message = 'diagnostic owner is immutable';
  end if;
  return new;
end;
$$;

create trigger diagnostics_transition_before_update
  before update on public.diagnostics
  for each row execute function public.enforce_diagnostic_transition();

create or replace function public.diagnostic_stage_matches(
  status public.diagnostic_status,
  stage public.interview_stage
) returns boolean
language sql immutable strict
set search_path = ''
as $$
  select case status
    when 'INTRODUCTION' then stage = 'INTRODUCTION'
    when 'PRIVACY_CONSENT' then stage = 'CONSENT'
    when 'COMMERCIAL_CONSENT' then stage = 'CONSENT'
    when 'IDENTIFICATION' then stage = 'IDENTIFICATION'
    when 'CHALLENGE' then stage = 'CHALLENGE'
    when 'CURRENT_PROCESS' then stage = 'PROCESS'
    when 'IMPACT' then stage = 'IMPACT'
    when 'BUYING_CONTEXT' then stage = 'CONTEXT'
    when 'REVIEW_GENERATING' then stage = 'REVIEW'
    when 'REVIEW_PENDING' then stage = 'REVIEW'
    when 'REVIEW_EDITING' then stage = 'REVIEW'
    when 'COMPLETING' then stage = 'COMPLETION'
    when 'COMPLETED' then stage = 'COMPLETION'
    when 'COMPLETED_NO_CONTACT' then stage = 'COMPLETION'
    else true
  end;
$$;

alter table public.diagnostics add constraint diagnostics_status_stage_check
  check (public.diagnostic_stage_matches(status, current_stage));

create or replace function public.contains_unredacted_secret(value text)
returns boolean
language sql immutable
set search_path = ''
as $$
  select coalesce(value, '') ~* (
    '(-----BEGIN[[:space:]][A-Z ]*PRIVATE KEY-----)' ||
    '|(authorization[[:space:]]*:[[:space:]]*bearer[[:space:]]+[a-z0-9._~+/-]{12,})' ||
    '|((api[_ -]?key|secret|token|password|senha)[[:space:]]*[:=][[:space:]]*[^ ,;]{8,})' ||
    '|((sk|pk)_(live|test)_[a-z0-9]{12,})' ||
    '|(gh[pousr]_[a-z0-9]{20,})' ||
    '|(xox[baprs]-[a-z0-9-]{12,})'
  );
$$;

create or replace function public.guard_unredacted_secret()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  document text;
begin
  document := to_jsonb(new)::text;
  if public.contains_unredacted_secret(document) then
    raise exception using errcode = '22023', message = 'potential secret must be redacted before persistence';
  end if;
  return new;
end;
$$;

create trigger answers_secret_guard before insert or update on public.interview_answers
  for each row execute function public.guard_unredacted_secret();
create trigger messages_secret_guard before insert or update on public.conversation_messages
  for each row execute function public.guard_unredacted_secret();
create trigger snapshots_secret_guard before insert or update on public.diagnostic_snapshots
  for each row execute function public.guard_unredacted_secret();
create trigger evidence_secret_guard before insert or update on public.evidence_items
  for each row execute function public.guard_unredacted_secret();
create trigger reviews_secret_guard before insert or update on public.diagnostic_reviews
  for each row execute function public.guard_unredacted_secret();
create trigger briefings_secret_guard before insert or update on public.commercial_briefings
  for each row execute function public.guard_unredacted_secret();
create trigger errors_secret_guard before insert or update on public.technical_errors
  for each row execute function public.guard_unredacted_secret();
create trigger audits_secret_guard before insert or update on public.audit_events
  for each row execute function public.guard_unredacted_secret();

create or replace function public.guard_safe_audit_metadata()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.metadata ?| array[
    'answer', 'answers', 'raw_value', 'display_value', 'content', 'email', 'phone',
    'name', 'token', 'secret', 'authorization', 'briefing', 'score', 'flags'
  ] then
    raise exception using errcode = '22023', message = 'audit metadata contains a prohibited key';
  end if;
  return new;
end;
$$;

create trigger audits_metadata_guard before insert on public.audit_events
  for each row execute function public.guard_safe_audit_metadata();

create or replace function public.record_flag_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.diagnostic_flag_events
      (diagnostic_id, flag_id, event_type, new_status, reason)
    values (new.diagnostic_id, new.id, 'TRIGGERED', new.status, new.reason);
  elsif old.status is distinct from new.status then
    insert into public.diagnostic_flag_events
      (diagnostic_id, flag_id, event_type, previous_status, new_status, reason)
    values (
      new.diagnostic_id,
      new.id,
      case when new.status = 'RESOLVED' then 'RESOLVED' else 'UPDATED' end,
      old.status,
      new.status,
      new.reason
    );
  end if;
  return new;
end;
$$;

create trigger flag_event_after_change after insert or update on public.diagnostic_flags
  for each row execute function public.record_flag_event();
