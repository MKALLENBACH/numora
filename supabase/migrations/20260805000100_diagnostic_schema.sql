-- NUMORA Diagnostic MVP: foundational schema.
-- All timestamps are UTC timestamptz and all visitor ownership is tied to auth.users.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.diagnostic_status as enum (
  'INTRODUCTION', 'PRIVACY_CONSENT', 'COMMERCIAL_CONSENT', 'IDENTIFICATION',
  'CHALLENGE', 'CURRENT_PROCESS', 'IMPACT', 'BUYING_CONTEXT',
  'REVIEW_GENERATING', 'REVIEW_PENDING', 'REVIEW_EDITING', 'COMPLETING',
  'COMPLETED', 'COMPLETED_NO_CONTACT', 'BLOCKED', 'EXPIRED', 'ABANDONED'
);
create type public.interview_stage as enum (
  'INTRODUCTION', 'CONSENT', 'IDENTIFICATION', 'CHALLENGE', 'PROCESS',
  'IMPACT', 'CONTEXT', 'REVIEW', 'COMPLETION'
);
create type public.session_status as enum ('ACTIVE', 'PAUSED', 'COMPLETED', 'BLOCKED', 'EXPIRED', 'ABANDONED');
create type public.consent_type as enum ('PRIVACY', 'COMMERCIAL');
create type public.consent_decision as enum ('ACCEPTED', 'DECLINED');
create type public.answer_response_type as enum (
  'TEXT', 'LONG_TEXT', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'NUMBER',
  'NUMBER_WITH_UNIT', 'SCALE', 'BOOLEAN', 'SKIPPED'
);
create type public.answer_validation_status as enum ('VALID', 'INVALID', 'REDACTED', 'NOT_CONFIRMED');
create type public.evidence_source_type as enum (
  'REPORTED_FACT', 'CLIENT_ESTIMATE', 'AI_INFERENCE', 'SYSTEM_DERIVED', 'NOT_CONFIRMED'
);
create type public.review_status as enum ('DRAFT', 'PENDING_CONFIRMATION', 'CONFIRMED', 'SUPERSEDED');
create type public.qualification_classification as enum ('PRIORITY', 'QUALIFIED', 'INVESTIGATION', 'LOW_FIT', 'INSUFFICIENT');
create type public.assessment_confidence as enum ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT');
create type public.recommended_route as enum (
  'SENIOR_MEETING', 'STANDARD_MEETING', 'EXPLORATORY_MEETING', 'MANUAL_REVIEW',
  'NURTURE', 'OUT_OF_SCOPE', 'BLOCKED', 'NO_CONTACT'
);
create type public.flag_severity as enum ('S0', 'S1', 'S2', 'S3');
create type public.flag_status as enum ('ACTIVE', 'RESOLVED');
create type public.flag_source as enum ('SYSTEM', 'RULE', 'AI_AUXILIARY', 'MANUAL');
create type public.scheduling_effect as enum ('NONE', 'BLOCK_AUTOMATIC', 'BLOCK_ALL');
create type public.briefing_status as enum ('DRAFT', 'FINAL', 'SUPERSEDED');
create type public.recommended_offer as enum ('NUMORA_DIAGNOSE', 'EXPLORATORY_CONVERSATION', 'MANUAL_EVALUATION', 'NO_OFFER');
create type public.question_event_type as enum ('ASKED', 'ANSWERED', 'SKIPPED', 'CLARIFICATION_ASKED', 'CLARIFICATION_ANSWERED');
create type public.message_author as enum ('SYSTEM', 'VISITOR');
create type public.message_type as enum ('QUESTION', 'ANSWER', 'CLARIFICATION', 'NOTICE');
create type public.technical_error_type as enum ('AI', 'DATABASE', 'VALIDATION', 'SECURITY', 'INTEGRATION');
create type public.redaction_category as enum ('PASSWORD', 'TOKEN', 'API_KEY', 'PRIVATE_KEY', 'CPF', 'CARD', 'BANK_ACCOUNT', 'CREDENTIAL', 'OTHER_SECRET');
create type public.idempotency_status as enum ('PROCESSING', 'COMPLETED', 'FAILED');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 200),
  website text check (website is null or char_length(website) <= 500),
  industry text not null check (char_length(industry) between 1 and 100),
  industry_other text check (industry_other is null or char_length(industry_other) <= 200),
  employee_range text check (employee_range is null or char_length(employee_range) <= 50),
  revenue_range text check (revenue_range is null or char_length(revenue_range) <= 50),
  country_code text not null default 'BR' check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  anonymized_at timestamptz
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 150),
  role text not null check (char_length(role) between 2 and 150),
  role_category text check (role_category is null or char_length(role_category) <= 80),
  email extensions.citext not null check (char_length(email::text) between 3 and 320),
  email_type text not null default 'UNKNOWN' check (email_type in ('CORPORATE', 'PERSONAL', 'TEMPORARY', 'UNKNOWN')),
  email_validated boolean not null default false,
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  row_version bigint not null default 1 check (row_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  anonymized_at timestamptz
);

create table public.diagnostics (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status public.diagnostic_status not null default 'INTRODUCTION',
  current_stage public.interview_stage not null default 'INTRODUCTION',
  schema_version text not null default '1.0.0',
  interview_version text not null default '1.0.0',
  decision_tree_version text not null default '1.0.0',
  qualification_version text not null default '1.0.0',
  flag_catalog_version text not null default '1.0.0',
  message_catalog_version text not null default '1.0.0',
  privacy_policy_version text,
  completion_percentage numeric(5,2) not null default 0 check (completion_percentage between 0 and 100),
  recommended_route public.recommended_route,
  automatic_scheduling_eligible boolean not null default false,
  current_assessment_id uuid,
  current_briefing_id uuid,
  row_version bigint not null default 1 check (row_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  archived_at timestamptz
);

create table public.diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  status public.session_status not null default 'ACTIVE',
  current_stage public.interview_stage not null default 'INTRODUCTION',
  current_question_code text check (current_question_code is null or char_length(current_question_code) <= 100),
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  locale text not null default 'pt-BR' check (char_length(locale) <= 20),
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) <= 100),
  total_question_count integer not null default 0 check (total_question_count between 0 and 24),
  clarification_count integer not null default 0 check (clarification_count between 0 and 4),
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  row_version bigint not null default 1 check (row_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  consent_type public.consent_type not null,
  decision public.consent_decision not null,
  policy_version text not null check (char_length(policy_version) between 1 and 100),
  collection_method text not null default 'DIAGNOSTIC_WEB' check (char_length(collection_method) <= 100),
  occurred_at timestamptz not null default now(),
  supersedes_id uuid references public.consent_records(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.interview_question_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.diagnostic_sessions(id) on delete cascade,
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  question_code text not null check (char_length(question_code) between 1 and 100),
  event_type public.question_event_type not null,
  sequence_number integer not null check (sequence_number between 1 and 24),
  clarification_for_code text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create table public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.diagnostic_sessions(id) on delete cascade,
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  question_code text not null check (char_length(question_code) between 1 and 100),
  question_version text not null check (char_length(question_version) between 1 and 30),
  response_type public.answer_response_type not null,
  raw_value jsonb,
  normalized_value jsonb,
  display_value text check (display_value is null or char_length(display_value) <= 10000),
  validation_status public.answer_validation_status not null default 'VALID',
  source_type public.evidence_source_type not null default 'REPORTED_FACT',
  confidence numeric(4,3) not null default 1 check (confidence between 0 and 1),
  confirmed boolean not null default true,
  revision integer not null default 1 check (revision >= 1),
  is_current boolean not null default true,
  skip_reason text check (skip_reason is null or char_length(skip_reason) <= 500),
  redacted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.diagnostic_sessions(id) on delete cascade,
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  question_code text,
  author public.message_author not null,
  message_type public.message_type not null,
  content text not null check (char_length(content) between 1 and 10000),
  sequence_number integer not null check (sequence_number >= 1),
  redacted boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.diagnostic_snapshots (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  snapshot_type text not null check (char_length(snapshot_type) between 1 and 100),
  schema_version text not null,
  revision integer not null default 1 check (revision >= 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  valid boolean not null default true,
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  created_at timestamptz not null default now(),
  superseded_by_id uuid references public.diagnostic_snapshots(id) on delete restrict
);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  answer_id uuid references public.interview_answers(id) on delete set null,
  target_path text not null check (char_length(target_path) between 1 and 300),
  source_type public.evidence_source_type not null,
  text text not null check (char_length(text) between 1 and 500),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  confirmed boolean not null default false,
  redacted boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.evidence_sources (
  id uuid primary key default gen_random_uuid(),
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  answer_id uuid references public.interview_answers(id) on delete set null,
  source_locator text not null check (char_length(source_locator) between 1 and 500),
  created_at timestamptz not null default now(),
  unique (evidence_item_id, answer_id, source_locator)
);

create table public.diagnostic_reviews (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  status public.review_status not null default 'DRAFT',
  summary jsonb not null check (jsonb_typeof(summary) = 'object'),
  generated_at timestamptz not null default now(),
  confirmed_at timestamptz,
  revision_count integer not null default 0 check (revision_count between 0 and 3),
  row_version bigint not null default 1 check (row_version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  superseded_by_id uuid references public.diagnostic_reviews(id) on delete restrict,
  unique (diagnostic_id, version)
);

create table public.qualification_assessments (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  earned_points numeric(6,2) not null check (earned_points between 0 and 100),
  assessed_weight numeric(6,2) not null check (assessed_weight between 0 and 100),
  normalized_score numeric(6,2) check (normalized_score between 0 and 100),
  final_score integer check (final_score between 0 and 100),
  score_cap_applied integer check (score_cap_applied between 0 and 100),
  classification public.qualification_classification not null,
  assessment_confidence public.assessment_confidence not null,
  recommended_route public.recommended_route not null,
  automatic_scheduling_eligible boolean not null default false,
  is_current boolean not null default true,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (diagnostic_id, version)
);

create table public.qualification_dimension_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.qualification_assessments(id) on delete cascade,
  dimension_code text not null,
  earned_points numeric(6,2) not null check (earned_points >= 0),
  assessed_weight numeric(6,2) not null check (assessed_weight >= 0),
  max_weight numeric(6,2) not null check (max_weight > 0),
  created_at timestamptz not null default now(),
  unique (assessment_id, dimension_code)
);

create table public.qualification_criterion_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.qualification_assessments(id) on delete cascade,
  dimension_result_id uuid not null references public.qualification_dimension_results(id) on delete cascade,
  criterion_code text not null,
  earned_points numeric(6,2) not null check (earned_points >= 0),
  assessed_weight numeric(6,2) not null check (assessed_weight >= 0),
  max_weight numeric(6,2) not null check (max_weight > 0),
  rationale text check (rationale is null or char_length(rationale) <= 1000),
  created_at timestamptz not null default now(),
  unique (assessment_id, criterion_code)
);

create table public.criterion_evidence_links (
  id uuid primary key default gen_random_uuid(),
  criterion_result_id uuid not null references public.qualification_criterion_results(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (criterion_result_id, evidence_item_id)
);

create table public.diagnostic_flags (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  assessment_id uuid references public.qualification_assessments(id) on delete set null,
  code text not null check (char_length(code) between 1 and 100),
  display_name text not null check (char_length(display_name) between 1 and 200),
  category text not null check (char_length(category) between 1 and 100),
  severity public.flag_severity not null,
  status public.flag_status not null default 'ACTIVE',
  source public.flag_source not null default 'RULE',
  trigger_question_code text,
  reason text not null check (char_length(reason) between 1 and 1000),
  scheduling_effect public.scheduling_effect not null default 'NONE',
  recommended_route public.recommended_route,
  score_effect numeric(6,2) not null default 0,
  resolution_condition text check (resolution_condition is null or char_length(resolution_condition) <= 1000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.diagnostic_flag_events (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  flag_id uuid not null references public.diagnostic_flags(id) on delete cascade,
  event_type text not null check (event_type in ('TRIGGERED', 'UPDATED', 'RESOLVED')),
  previous_status public.flag_status,
  new_status public.flag_status not null,
  reason text check (reason is null or char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);

create table public.commercial_briefings (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
  version integer not null default 1 check (version >= 1),
  status public.briefing_status not null default 'DRAFT',
  executive_summary text not null check (char_length(executive_summary) <= 2000),
  challenge_summary text not null check (char_length(challenge_summary) <= 1500),
  current_process_summary text not null check (char_length(current_process_summary) <= 2000),
  impact_summary text not null check (char_length(impact_summary) <= 1500),
  buying_context_summary text not null check (char_length(buying_context_summary) <= 1500),
  technical_context_summary text not null check (char_length(technical_context_summary) <= 1500),
  initial_hypotheses jsonb not null default '[]'::jsonb check (jsonb_typeof(initial_hypotheses) = 'array'),
  missing_information jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_information) = 'array'),
  recommended_questions jsonb not null default '[]'::jsonb check (jsonb_typeof(recommended_questions) = 'array'),
  recommended_participants jsonb not null default '[]'::jsonb check (jsonb_typeof(recommended_participants) = 'array'),
  recommended_offer public.recommended_offer not null default 'MANUAL_EVALUATION',
  generated_at timestamptz not null default now(),
  superseded_by_id uuid references public.commercial_briefings(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (diagnostic_id, version)
);

create table public.technical_errors (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid references public.diagnostics(id) on delete cascade,
  session_id uuid references public.diagnostic_sessions(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  error_type public.technical_error_type not null,
  error_code text not null check (char_length(error_code) between 1 and 100),
  safe_context jsonb not null default '{}'::jsonb check (jsonb_typeof(safe_context) = 'object'),
  reference_code text not null unique,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid references public.diagnostics(id) on delete cascade,
  session_id uuid references public.diagnostic_sessions(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (char_length(event_type) between 1 and 100),
  actor_type text not null default 'ANONYMOUS_USER' check (actor_type in ('ANONYMOUS_USER', 'SYSTEM', 'SERVICE')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.data_redactions (
  id uuid primary key default gen_random_uuid(),
  diagnostic_id uuid references public.diagnostics(id) on delete cascade,
  session_id uuid references public.diagnostic_sessions(id) on delete cascade,
  answer_id uuid references public.interview_answers(id) on delete set null,
  category public.redaction_category not null,
  field_path text not null check (char_length(field_path) between 1 and 300),
  replacement_text text not null default '[CONTEÚDO REMOVIDO POR SEGURANÇA]',
  content_fingerprint text not null check (content_fingerprint ~ '^[a-f0-9]{64}$'),
  severe boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.idempotency_records (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  diagnostic_id uuid references public.diagnostics(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 20 and 500),
  action text not null check (char_length(action) between 1 and 100),
  request_hash text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  status public.idempotency_status not null default 'PROCESSING',
  response_json jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  unique (owner_user_id, idempotency_key)
);

create table public.rate_limit_counters (
  id bigint generated always as identity primary key,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (char_length(scope) between 1 and 100),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count >= 1),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, scope, window_started_at)
);

alter table public.diagnostics
  add constraint diagnostics_current_assessment_fk foreign key (current_assessment_id)
    references public.qualification_assessments(id) on delete set null,
  add constraint diagnostics_current_briefing_fk foreign key (current_briefing_id)
    references public.commercial_briefings(id) on delete set null;

create unique index one_active_session_per_diagnostic
  on public.diagnostic_sessions (diagnostic_id) where status in ('ACTIVE', 'PAUSED');
create unique index one_current_answer_per_question
  on public.interview_answers (session_id, question_code) where is_current;
create unique index one_current_assessment_per_diagnostic
  on public.qualification_assessments (diagnostic_id) where is_current;
create unique index one_active_flag_per_diagnostic_code
  on public.diagnostic_flags (diagnostic_id, code) where status = 'ACTIVE';

create index diagnostics_owner_idx on public.diagnostics (owner_user_id, updated_at desc);
create index diagnostics_status_idx on public.diagnostics (status, created_at desc);
create index diagnostics_created_idx on public.diagnostics (created_at desc);
create index sessions_diagnostic_idx on public.diagnostic_sessions (diagnostic_id, created_at desc);
create index sessions_owner_idx on public.diagnostic_sessions (owner_user_id, last_activity_at desc);
create index sessions_expiry_idx on public.diagnostic_sessions (expires_at) where status in ('ACTIVE', 'PAUSED');
create index answers_current_idx on public.interview_answers (diagnostic_id, question_code) where is_current;
create index answers_created_idx on public.interview_answers (created_at desc);
create index question_events_session_idx on public.interview_question_events (session_id, sequence_number);
create index flags_active_idx on public.diagnostic_flags (diagnostic_id, severity) where status = 'ACTIVE';
create index assessments_current_idx on public.qualification_assessments (diagnostic_id) where is_current;
create index audit_diagnostic_idx on public.audit_events (diagnostic_id, occurred_at desc);
create index audit_created_idx on public.audit_events (created_at desc);
create index errors_created_idx on public.technical_errors (created_at desc);
create index redactions_diagnostic_idx on public.data_redactions (diagnostic_id, created_at desc);
create index idempotency_expiry_idx on public.idempotency_records (expires_at);
create index rate_limit_updated_idx on public.rate_limit_counters (updated_at);

comment on table public.commercial_briefings is 'Internal-only commercial artifact; never grant visitor access.';
comment on table public.qualification_assessments is 'Internal deterministic score; never grant visitor access.';
comment on table public.diagnostic_flags is 'Internal rule/security flags; never grant visitor access.';
comment on table public.audit_events is 'Append-only security and product audit trail. Never stores answer content.';
comment on column public.data_redactions.content_fingerprint is 'One-way SHA-256 fingerprint only; original sensitive content is never stored.';
