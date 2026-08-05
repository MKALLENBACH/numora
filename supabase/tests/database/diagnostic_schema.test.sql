begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(19);

select ok(
  (select count(*) = 22 from information_schema.tables
   where table_schema = 'public' and table_name = any(array[
     'companies','leads','diagnostics','diagnostic_sessions','consent_records',
     'interview_question_events','interview_answers','conversation_messages',
     'diagnostic_snapshots','evidence_items','evidence_sources','diagnostic_reviews',
     'qualification_assessments','qualification_dimension_results',
     'qualification_criterion_results','criterion_evidence_links','diagnostic_flags',
     'diagnostic_flag_events','commercial_briefings','technical_errors','audit_events',
     'data_redactions'
   ])),
  'all required PO tables exist'
);

select ok(
  (select count(*) = 11 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = any(array[
     'diagnostic_start','diagnostic_record_consent','diagnostic_save_identification',
     'diagnostic_submit_answer','diagnostic_generate_review','diagnostic_update_review',
     'diagnostic_confirm_review','diagnostic_complete','diagnostic_abandon',
     'diagnostic_consume_rate_limit','cleanup_diagnostic_retention'
   ])),
  'atomic use-case and operational RPCs exist'
);

select ok(
  not exists (
    select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
      and c.relname = any(array[
        'companies','leads','diagnostics','diagnostic_sessions','consent_records',
        'interview_question_events','interview_answers','conversation_messages',
        'diagnostic_snapshots','evidence_items','evidence_sources','diagnostic_reviews',
        'qualification_assessments','qualification_dimension_results',
        'qualification_criterion_results','criterion_evidence_links','diagnostic_flags',
        'diagnostic_flag_events','commercial_briefings','technical_errors','audit_events',
        'data_redactions','idempotency_records','rate_limit_counters'
      ])
  ),
  'RLS is enabled on every public table'
);

select ok(
  (select count(*) = 6 from pg_policies where schemaname = 'public'
   and policyname = any(array[
     'diagnostics_owner_select','sessions_owner_select','consents_owner_select',
     'answers_owner_select','question_events_owner_select','reviews_owner_select'
   ])),
  'visitor ownership policies exist only for safe resources'
);

select ok(
  not has_table_privilege('authenticated', 'public.qualification_assessments', 'SELECT')
  and not has_table_privilege('authenticated', 'public.diagnostic_flags', 'SELECT')
  and not has_table_privilege('authenticated', 'public.commercial_briefings', 'SELECT')
  and not has_table_privilege('authenticated', 'public.audit_events', 'SELECT'),
  'authenticated visitor cannot read score, flags, briefing or audit'
);

select ok(
  not has_function_privilege('authenticated', 'public.diagnostic_start(uuid,text,text,text,text,integer)', 'EXECUTE'),
  'authenticated visitor cannot bypass Edge Functions by invoking mutation RPCs'
);

select ok(
  has_function_privilege('service_role', 'public.diagnostic_start(uuid,text,text,text,text,integer)', 'EXECUTE'),
  'service role may invoke server-only RPCs'
);

select col_not_null(
  'public', 'interview_answers', 'question_version',
  'each answer persists the catalog question version used at submission time'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.diagnostic_submit_answer(uuid,uuid,uuid,text,text,public.answer_response_type,jsonb,jsonb,text,public.answer_validation_status,public.evidence_source_type,numeric,boolean,boolean,jsonb,jsonb,jsonb,boolean,jsonb,public.diagnostic_status,public.interview_stage,text,numeric,text,text,bigint)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.diagnostic_submit_answer(uuid,uuid,uuid,text,text,public.answer_response_type,jsonb,jsonb,text,public.answer_validation_status,public.evidence_source_type,numeric,boolean,boolean,jsonb,jsonb,jsonb,boolean,jsonb,public.diagnostic_status,public.interview_stage,text,numeric,text,text,bigint)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.diagnostic_update_review(uuid,uuid,uuid,text,jsonb,integer,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.diagnostic_update_review(uuid,uuid,uuid,text,jsonb,integer,text,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.diagnostic_confirm_review(uuid,uuid,uuid,integer,text,text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.diagnostic_confirm_review(uuid,uuid,uuid,integer,text,text)',
    'EXECUTE'
  ),
  'new answer and review mutation RPC signatures remain server-only'
);

select ok(
  position(
    'pg_advisory_xact_lock' in pg_get_functiondef(
      'public.diagnostic_start(uuid,text,text,text,text,integer)'::regprocedure
    )
  ) > 0,
  'diagnostic start serializes active-diagnostic creation per owner'
);

select ok(
  position(
    'current_review.version <> p_review_version' in pg_get_functiondef(
      'public.diagnostic_update_review(uuid,uuid,uuid,text,jsonb,integer,text,text)'::regprocedure
    )
  ) > 0,
  'review version is checked while the current review row is locked'
);

select ok(
  position(
    'current_review.version <> p_review_version' in pg_get_functiondef(
      'public.diagnostic_confirm_review(uuid,uuid,uuid,integer,text,text)'::regprocedure
    )
  ) > 0,
  'review version is checked while the confirmation transaction holds its row lock'
);

select ok(
  position(
    'then ''BLOCKED''::public.session_status' in pg_get_functiondef(
      'public.diagnostic_submit_answer(uuid,uuid,uuid,text,text,public.answer_response_type,jsonb,jsonb,text,public.answer_validation_status,public.evidence_source_type,numeric,boolean,boolean,jsonb,jsonb,jsonb,boolean,jsonb,public.diagnostic_status,public.interview_stage,text,numeric,text,text,bigint)'::regprocedure
    )
  ) > 0,
  'a blocking answer makes the diagnostic session terminal too'
);

select ok(
  (select count(*) = 3 from pg_trigger where not tgisinternal and tgname = any(array[
    'consent_records_immutable','audit_events_immutable','flag_events_immutable'
  ])),
  'consent, audit and flag histories are append-only'
);

select ok(public.valid_diagnostic_transition('PRIVACY_CONSENT', 'COMMERCIAL_CONSENT'), 'allowed state transition is accepted');
select ok(not public.valid_diagnostic_transition('PRIVACY_CONSENT', 'COMPLETED'), 'arbitrary state transition is rejected');
select ok(public.contains_unredacted_secret('Authorization: Bearer abcdefghijklmnop'), 'plaintext token detector catches bearer tokens');
select ok(not public.contains_unredacted_secret('[CONTEÚDO REMOVIDO POR SEGURANÇA]'), 'redaction marker passes secret detector');

select ok(
  (select count(*) >= 4 from pg_indexes where schemaname = 'public'
   and indexname = any(array[
     'one_active_session_per_diagnostic','one_current_answer_per_question',
     'one_current_assessment_per_diagnostic','one_active_flag_per_diagnostic_code'
   ])),
  'partial uniqueness invariants exist'
);

select * from finish();
rollback;
