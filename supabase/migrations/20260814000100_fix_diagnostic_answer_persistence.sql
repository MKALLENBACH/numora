-- Fix enum coercion in answer event persistence on already-provisioned databases.
-- The original CASE expression resolved to text and failed before the first answer committed.
create or replace function public.diagnostic_submit_answer(
  p_owner_user_id uuid,
  p_diagnostic_id uuid,
  p_session_id uuid,
  p_question_code text,
  p_question_version text,
  p_response_type public.answer_response_type,
  p_raw_value jsonb,
  p_normalized_value jsonb,
  p_display_value text,
  p_validation_status public.answer_validation_status,
  p_source_type public.evidence_source_type,
  p_confidence numeric,
  p_confirmed boolean,
  p_redacted boolean,
  p_redactions jsonb,
  p_security_flags jsonb,
  p_evidence jsonb,
  p_is_clarification boolean,
  p_question_metadata jsonb,
  p_next_status public.diagnostic_status,
  p_next_stage public.interview_stage,
  p_next_question_code text,
  p_completion_percentage numeric,
  p_idempotency_key text,
  p_request_hash text,
  p_expected_row_version bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  idem jsonb;
  d public.diagnostics%rowtype;
  s public.diagnostic_sessions%rowtype;
  answer_id uuid;
  next_revision integer;
  next_sequence integer;
  redaction jsonb;
  security_flag jsonb;
  evidence jsonb;
  result jsonb;
begin
  idem := public.begin_idempotency(
    p_owner_user_id, p_diagnostic_id, p_idempotency_key, 'SUBMIT_ANSWER', p_request_hash
  );
  if (idem->>'replayed')::boolean then return idem->'response'; end if;
  select * into d from public.diagnostics
  where id = p_diagnostic_id and owner_user_id = p_owner_user_id for update;
  if not found then raise exception using errcode = '42501', message = 'UNAUTHORIZED'; end if;
  select * into s from public.diagnostic_sessions
  where id = p_session_id and diagnostic_id = d.id and owner_user_id = p_owner_user_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'SESSION_NOT_FOUND'; end if;
  if s.expires_at <= now() then raise exception using errcode = 'P0001', message = 'SESSION_EXPIRED'; end if;
  if d.status not in ('CHALLENGE', 'CURRENT_PROCESS', 'IMPACT', 'BUYING_CONTEXT')
     or s.status <> 'ACTIVE' or s.current_question_code is distinct from p_question_code then
    raise exception using errcode = '40001', message = 'STATE_CONFLICT';
  end if;
  if p_expected_row_version is null or d.row_version <> p_expected_row_version then
    raise exception using errcode = '40001', message = 'STATE_CONFLICT';
  end if;
  if not public.valid_diagnostic_transition(d.status, p_next_status) then
    raise exception using errcode = '22023', message = 'INVALID_NEXT_STATE';
  end if;

  select coalesce(max(revision), 0) + 1 into next_revision
  from public.interview_answers
  where session_id = s.id and question_code = p_question_code;
  update public.interview_answers set is_current = false
  where session_id = s.id and question_code = p_question_code and is_current;
  insert into public.interview_answers (
    session_id, diagnostic_id, owner_user_id, question_code, question_version, response_type,
    raw_value, normalized_value, display_value, validation_status, source_type,
    confidence, confirmed, revision, is_current, skip_reason, redacted
  ) values (
    s.id, d.id, p_owner_user_id, p_question_code, p_question_version, p_response_type,
    p_raw_value, p_normalized_value, p_display_value, p_validation_status, p_source_type,
    p_confidence, p_confirmed, next_revision, true,
    case when p_response_type = 'SKIPPED' then 'VISITOR_SKIPPED_OPTIONAL' else null end,
    p_redacted
  ) returning id into answer_id;

  for evidence in select value from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) loop
    insert into public.evidence_items (
      diagnostic_id, answer_id, target_path, source_type, text, confidence, confirmed, redacted
    ) values (
      d.id, answer_id, evidence->>'targetPath',
      (evidence->>'sourceType')::public.evidence_source_type,
      left(evidence->>'text', 500), (evidence->>'confidence')::numeric,
      coalesce(p_confirmed, false)
        and coalesce(not p_redacted, false)
        and coalesce((evidence->>'sourceType') <> 'NOT_CONFIRMED', false)
        and coalesce((evidence->>'confidence')::numeric >= 0.6, false),
      p_redacted
    );
  end loop;

  select coalesce(max(sequence_number), 0) + 1 into next_sequence
  from public.interview_question_events where session_id = s.id;
  if next_sequence > 24 then raise exception using errcode = '22023', message = 'QUESTION_LIMIT_REACHED'; end if;
  insert into public.interview_question_events (
    session_id, diagnostic_id, owner_user_id, question_code, event_type, sequence_number,
    clarification_for_code, metadata
  ) values (
    s.id, d.id, p_owner_user_id, p_question_code,
    (case
      when p_is_clarification then 'CLARIFICATION_ANSWERED'
      when p_response_type = 'SKIPPED' then 'SKIPPED'
      else 'ANSWERED'
    end)::public.question_event_type,
    next_sequence,
    case when p_is_clarification then p_question_metadata->>'relatedQuestionId' else null end,
    coalesce(p_question_metadata, '{}'::jsonb)
  );

  for redaction in select value from jsonb_array_elements(coalesce(p_redactions, '[]'::jsonb)) loop
    insert into public.data_redactions (
      diagnostic_id, session_id, answer_id, category, field_path,
      content_fingerprint, severe
    ) values (
      d.id, s.id, answer_id, (redaction->>'category')::public.redaction_category,
      coalesce(redaction->>'fieldPath', 'answer'), redaction->>'fingerprint',
      coalesce((redaction->>'severe')::boolean, false)
    );
  end loop;

  for security_flag in select value from jsonb_array_elements(coalesce(p_security_flags, '[]'::jsonb)) loop
    insert into public.diagnostic_flags (
      diagnostic_id, code, display_name, category, severity, source, reason,
      scheduling_effect, recommended_route, metadata
    ) values (
      d.id, security_flag->>'code', security_flag->>'displayName', 'SECURITY',
      (security_flag->>'severity')::public.flag_severity, 'SYSTEM',
      security_flag->>'reason',
      coalesce(
        (security_flag->>'schedulingEffect')::public.scheduling_effect,
        'NONE'::public.scheduling_effect
      ),
      nullif(security_flag->>'recommendedRoute', '')::public.recommended_route,
      '{}'::jsonb
    ) on conflict (diagnostic_id, code) where status = 'ACTIVE'
      do update set severity = excluded.severity, reason = excluded.reason;
  end loop;

  update public.diagnostics set
    status = p_next_status,
    current_stage = p_next_stage,
    completion_percentage = greatest(completion_percentage, least(p_completion_percentage, 100))
  where id = d.id;
  update public.diagnostic_sessions set
    status = (case
      when p_next_status = 'BLOCKED' then 'BLOCKED'::public.session_status
      else status
    end)::public.session_status,
    current_stage = p_next_stage,
    current_question_code = case
      when p_next_status = 'BLOCKED' then null
      else p_next_question_code
    end,
    total_question_count = least(total_question_count + 1, 24),
    clarification_count = least(clarification_count + case when p_is_clarification then 1 else 0 end, 4),
    last_activity_at = now()
  where id = s.id;
  insert into public.audit_events (
    diagnostic_id, session_id, owner_user_id, event_type, metadata
  ) values (
    d.id, s.id, p_owner_user_id, 'ANSWER_SAVED',
    jsonb_build_object('questionCode', p_question_code, 'revision', next_revision, 'redacted', p_redacted)
  );
  result := jsonb_build_object('diagnosticId', d.id, 'sessionId', s.id, 'answerId', answer_id);
  return public.finish_idempotency(p_owner_user_id, p_idempotency_key, result);
end;
$$;
revoke all on function public.diagnostic_submit_answer(uuid, uuid, uuid, text, text, public.answer_response_type, jsonb, jsonb, text, public.answer_validation_status, public.evidence_source_type, numeric, boolean, boolean, jsonb, jsonb, jsonb, boolean, jsonb, public.diagnostic_status, public.interview_stage, text, numeric, text, text, bigint) from public, anon, authenticated;
grant execute on function public.diagnostic_submit_answer(uuid, uuid, uuid, text, text, public.answer_response_type, jsonb, jsonb, text, public.answer_validation_status, public.evidence_source_type, numeric, boolean, boolean, jsonb, jsonb, jsonb, boolean, jsonb, public.diagnostic_status, public.interview_stage, text, numeric, text, text, bigint) to service_role;


-- Recreate the completion RPC with explicit enum typing at every CASE/COALESCE boundary.
create or replace function public.diagnostic_complete(
  p_owner_user_id uuid,
  p_diagnostic_id uuid,
  p_session_id uuid,
  p_assessment jsonb,
  p_flags jsonb,
  p_briefing jsonb,
  p_idempotency_key text,
  p_request_hash text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  idem jsonb;
  d public.diagnostics%rowtype;
  new_assessment_id uuid;
  briefing_id uuid;
  assessment_version integer;
  briefing_version integer;
  flag jsonb;
  criterion jsonb;
  dimension_result_id uuid;
  criterion_result_id uuid;
  commercial_allowed boolean;
  final_status public.diagnostic_status;
  final_route public.recommended_route;
  result jsonb;
begin
  idem := public.begin_idempotency(
    p_owner_user_id, p_diagnostic_id, p_idempotency_key, 'COMPLETE', p_request_hash
  );
  if (idem->>'replayed')::boolean then return idem->'response'; end if;
  select * into d from public.diagnostics
  where id = p_diagnostic_id and owner_user_id = p_owner_user_id for update;
  if not found then raise exception using errcode = '42501', message = 'UNAUTHORIZED'; end if;
  if d.status <> 'COMPLETING' then raise exception using errcode = '40001', message = 'STATE_CONFLICT'; end if;
  if not exists (
    select 1 from public.diagnostic_reviews where diagnostic_id = d.id and status = 'CONFIRMED'
  ) then raise exception using errcode = '22023', message = 'REVIEW_NOT_CONFIRMED'; end if;

  update public.qualification_assessments set is_current = false where diagnostic_id = d.id and is_current;
  select coalesce(max(version), 0) + 1 into assessment_version
  from public.qualification_assessments where diagnostic_id = d.id;
  insert into public.qualification_assessments (
    diagnostic_id, version, earned_points, assessed_weight, normalized_score, final_score,
    score_cap_applied, classification, assessment_confidence, recommended_route,
    automatic_scheduling_eligible, is_current
  ) values (
    d.id, assessment_version, (p_assessment->>'earnedPoints')::numeric,
    (p_assessment->>'assessedWeight')::numeric,
    nullif(p_assessment->>'normalizedScore', '')::numeric,
    nullif(p_assessment->>'finalScore', '')::integer,
    nullif(p_assessment->>'scoreCapApplied', '')::integer,
    (p_assessment->>'classification')::public.qualification_classification,
    (p_assessment->>'confidence')::public.assessment_confidence,
    (p_assessment->>'recommendedRoute')::public.recommended_route,
    false, true
  ) returning id into new_assessment_id;

  insert into public.qualification_dimension_results (
    assessment_id, dimension_code, earned_points, assessed_weight, max_weight
  )
  select
    new_assessment_id,
    criterion_row.dimension,
    sum(criterion_row."earnedPoints"),
    sum(case when criterion_row.assessed then criterion_row."maximumPoints" else 0 end),
    sum(criterion_row."maximumPoints")
  from jsonb_to_recordset(coalesce(p_assessment->'criteria', '[]'::jsonb)) as criterion_row(
    code text,
    dimension text,
    "maximumPoints" numeric,
    assessed boolean,
    "earnedPoints" numeric,
    "evidencePaths" jsonb
  )
  group by criterion_row.dimension;

  for criterion in select value from jsonb_array_elements(coalesce(p_assessment->'criteria', '[]'::jsonb)) loop
    select id into dimension_result_id
    from public.qualification_dimension_results dimension_result
    where dimension_result.assessment_id = new_assessment_id
      and dimension_result.dimension_code = criterion->>'dimension';
    insert into public.qualification_criterion_results (
      assessment_id, dimension_result_id, criterion_code, earned_points,
      assessed_weight, max_weight, rationale
    ) values (
      new_assessment_id, dimension_result_id, criterion->>'code',
      (criterion->>'earnedPoints')::numeric,
      case when (criterion->>'assessed')::boolean then (criterion->>'maximumPoints')::numeric else 0 end,
      (criterion->>'maximumPoints')::numeric,
      'Deterministic qualification matrix ' || coalesce(p_assessment->>'version', '1.0.0')
    ) returning id into criterion_result_id;
    insert into public.criterion_evidence_links (criterion_result_id, evidence_item_id)
    select criterion_result_id, evidence_item.id
    from public.evidence_items evidence_item
    join public.interview_answers answer on answer.id = evidence_item.answer_id
    where evidence_item.diagnostic_id = d.id
      and answer.is_current
      and evidence_item.target_path in (
        select jsonb_array_elements_text(coalesce(criterion->'evidencePaths', '[]'::jsonb))
      )
    on conflict (criterion_result_id, evidence_item_id) do nothing;
  end loop;

  for flag in select value from jsonb_array_elements(coalesce(p_flags, '[]'::jsonb)) loop
    insert into public.diagnostic_flags (
      diagnostic_id, assessment_id, code, display_name, category, severity,
      source, reason, scheduling_effect, recommended_route, metadata
    ) values (
      d.id, new_assessment_id, flag->>'code', flag->>'displayName', flag->>'category',
      (flag->>'severity')::public.flag_severity, 'RULE', flag->>'reason',
      coalesce(
        (flag->>'schedulingEffect')::public.scheduling_effect,
        'NONE'::public.scheduling_effect
      ),
      nullif(flag->>'recommendedRoute', '')::public.recommended_route,
      coalesce(flag->'metadata', '{}'::jsonb)
    ) on conflict (diagnostic_id, code) where status = 'ACTIVE'
      do update set assessment_id = excluded.assessment_id, severity = excluded.severity,
        reason = excluded.reason, metadata = excluded.metadata;
  end loop;

  select coalesce(max(version), 0) + 1 into briefing_version
  from public.commercial_briefings where diagnostic_id = d.id;
  insert into public.commercial_briefings (
    diagnostic_id, version, status, executive_summary, challenge_summary,
    current_process_summary, impact_summary, buying_context_summary,
    technical_context_summary, initial_hypotheses, missing_information,
    recommended_questions, recommended_participants, recommended_offer
  ) values (
    d.id, briefing_version, 'FINAL', p_briefing->>'executiveSummary',
    p_briefing->>'challengeSummary', p_briefing->>'currentProcessSummary',
    p_briefing->>'impactSummary', p_briefing->>'buyingContextSummary',
    p_briefing->>'technicalContextSummary', coalesce(p_briefing->'initialHypotheses', '[]'::jsonb),
    coalesce(p_briefing->'missingInformation', '[]'::jsonb),
    coalesce(p_briefing->'recommendedQuestions', '[]'::jsonb),
    coalesce(p_briefing->'recommendedParticipants', '[]'::jsonb),
    (p_briefing->>'recommendedOffer')::public.recommended_offer
  ) returning id into briefing_id;

  select coalesce((
    select decision = 'ACCEPTED' from public.consent_records
    where diagnostic_id = d.id and consent_type = 'COMMERCIAL'
    order by occurred_at desc limit 1
  ), false) into commercial_allowed;
  final_status := (case
    when commercial_allowed then 'COMPLETED'
    else 'COMPLETED_NO_CONTACT'
  end)::public.diagnostic_status;
  final_route := case
    when not commercial_allowed then 'NO_CONTACT'::public.recommended_route
    when exists (select 1 from public.diagnostic_flags where diagnostic_id = d.id and status = 'ACTIVE' and severity = 'S3') then 'BLOCKED'::public.recommended_route
    when exists (select 1 from public.diagnostic_flags where diagnostic_id = d.id and status = 'ACTIVE' and severity = 'S2') then 'MANUAL_REVIEW'::public.recommended_route
    else (p_assessment->>'recommendedRoute')::public.recommended_route
  end;
  update public.diagnostics set
    status = final_status, current_stage = 'COMPLETION', completion_percentage = 100,
    current_assessment_id = new_assessment_id, current_briefing_id = briefing_id,
    recommended_route = final_route, automatic_scheduling_eligible = false,
    completed_at = now()
  where id = d.id;
  update public.diagnostic_sessions set
    status = 'COMPLETED', current_stage = 'COMPLETION', completed_at = now(), last_activity_at = now()
  where id = p_session_id and diagnostic_id = d.id and owner_user_id = p_owner_user_id;
  insert into public.audit_events (
    diagnostic_id, session_id, owner_user_id, event_type, metadata
  ) values (
    d.id, p_session_id, p_owner_user_id, 'DIAGNOSTIC_COMPLETED',
    jsonb_build_object('status', final_status, 'commercialContactAllowed', commercial_allowed)
  );
  result := jsonb_build_object('diagnosticId', d.id, 'sessionId', p_session_id, 'status', final_status);
  return public.finish_idempotency(p_owner_user_id, p_idempotency_key, result);
end;
$$;


revoke all on function public.diagnostic_complete(uuid, uuid, uuid, jsonb, jsonb, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.diagnostic_complete(uuid, uuid, uuid, jsonb, jsonb, jsonb, text, text) to service_role;
