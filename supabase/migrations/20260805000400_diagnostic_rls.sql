-- Visitor access is anonymous-authenticated only, scoped to auth.uid().
-- The browser receives read-only, column-limited access; writes go through Edge Functions.

create or replace function public.is_anonymous_owner(owner_id uuid)
returns boolean
language sql stable
security invoker
set search_path = ''
as $$
  select auth.uid() = owner_id
    and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false);
$$;

revoke all on function public.is_anonymous_owner(uuid) from public, anon;
grant execute on function public.is_anonymous_owner(uuid) to authenticated, service_role;

alter table public.companies enable row level security;
alter table public.leads enable row level security;
alter table public.diagnostics enable row level security;
alter table public.diagnostic_sessions enable row level security;
alter table public.consent_records enable row level security;
alter table public.interview_question_events enable row level security;
alter table public.interview_answers enable row level security;
alter table public.conversation_messages enable row level security;
alter table public.diagnostic_snapshots enable row level security;
alter table public.evidence_items enable row level security;
alter table public.evidence_sources enable row level security;
alter table public.diagnostic_reviews enable row level security;
alter table public.qualification_assessments enable row level security;
alter table public.qualification_dimension_results enable row level security;
alter table public.qualification_criterion_results enable row level security;
alter table public.criterion_evidence_links enable row level security;
alter table public.diagnostic_flags enable row level security;
alter table public.diagnostic_flag_events enable row level security;
alter table public.commercial_briefings enable row level security;
alter table public.technical_errors enable row level security;
alter table public.audit_events enable row level security;
alter table public.data_redactions enable row level security;
alter table public.idempotency_records enable row level security;
alter table public.rate_limit_counters enable row level security;

revoke all on table
  public.companies, public.leads, public.diagnostics, public.diagnostic_sessions,
  public.consent_records, public.interview_question_events, public.interview_answers,
  public.conversation_messages, public.diagnostic_snapshots, public.evidence_items,
  public.evidence_sources, public.diagnostic_reviews, public.qualification_assessments,
  public.qualification_dimension_results, public.qualification_criterion_results,
  public.criterion_evidence_links, public.diagnostic_flags, public.diagnostic_flag_events,
  public.commercial_briefings, public.technical_errors, public.audit_events,
  public.data_redactions, public.idempotency_records, public.rate_limit_counters
from anon, authenticated;
revoke all on sequence public.rate_limit_counters_id_seq from anon, authenticated;

-- Safe public projections only. Internal routing, assessment and briefing IDs remain inaccessible.
grant select (
  id, owner_user_id, status, current_stage, completion_percentage,
  row_version, created_at, updated_at, completed_at
) on public.diagnostics to authenticated;
grant select (
  id, diagnostic_id, owner_user_id, status, current_stage, current_question_code,
  started_at, last_activity_at, expires_at, locale, timezone, total_question_count,
  clarification_count, elapsed_seconds, row_version, created_at, updated_at
) on public.diagnostic_sessions to authenticated;
grant select (
  id, diagnostic_id, consent_type, decision, policy_version, occurred_at, created_at
) on public.consent_records to authenticated;
grant select (
  id, session_id, diagnostic_id, question_code, response_type, display_value,
  validation_status, confirmed, revision, is_current, skip_reason, redacted,
  created_at, updated_at
) on public.interview_answers to authenticated;
grant select (
  id, session_id, diagnostic_id, question_code, event_type, sequence_number, created_at
) on public.interview_question_events to authenticated;
grant select (
  id, diagnostic_id, version, status, summary, generated_at, confirmed_at,
  revision_count, created_at
) on public.diagnostic_reviews to authenticated;

create policy diagnostics_owner_select on public.diagnostics
  for select to authenticated
  using (public.is_anonymous_owner(owner_user_id));

create policy sessions_owner_select on public.diagnostic_sessions
  for select to authenticated
  using (public.is_anonymous_owner(owner_user_id));

create policy consents_owner_select on public.consent_records
  for select to authenticated
  using (public.is_anonymous_owner(owner_user_id));

create policy answers_owner_select on public.interview_answers
  for select to authenticated
  using (public.is_anonymous_owner(owner_user_id));

create policy question_events_owner_select on public.interview_question_events
  for select to authenticated
  using (public.is_anonymous_owner(owner_user_id));

create policy reviews_owner_select on public.diagnostic_reviews
  for select to authenticated
  using (
    exists (
      select 1 from public.diagnostics d
      where d.id = diagnostic_reviews.diagnostic_id
        and public.is_anonymous_owner(d.owner_user_id)
    )
  );

-- Defense in depth if a privileged token is ever constrained by RLS.
alter table public.companies force row level security;
alter table public.leads force row level security;
alter table public.qualification_assessments force row level security;
alter table public.qualification_dimension_results force row level security;
alter table public.qualification_criterion_results force row level security;
alter table public.criterion_evidence_links force row level security;
alter table public.diagnostic_flags force row level security;
alter table public.diagnostic_flag_events force row level security;
alter table public.commercial_briefings force row level security;
alter table public.technical_errors force row level security;
alter table public.audit_events force row level security;
alter table public.data_redactions force row level security;
alter table public.idempotency_records force row level security;
alter table public.rate_limit_counters force row level security;

comment on policy diagnostics_owner_select on public.diagnostics is
  'Only a Supabase anonymous authenticated JWT can read its own safe diagnostic columns.';
comment on policy reviews_owner_select on public.diagnostic_reviews is
  'Review summary is the only generated artifact visible to its anonymous owner.';
