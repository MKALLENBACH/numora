-- Idempotent forward hardening for databases where migration 20260814000100 was applied
-- before the completion RPC definition was consolidated locally.

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
