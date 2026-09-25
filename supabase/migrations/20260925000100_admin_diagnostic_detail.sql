-- NUMORA ADM 03: secure, section-based read model for one diagnostic.

create index interview_answers_diagnostic_history_idx
  on public.interview_answers (
    diagnostic_id,
    session_id,
    question_code,
    revision desc,
    id desc
  );

create index diagnostic_flags_diagnostic_history_idx
  on public.diagnostic_flags (diagnostic_id, triggered_at desc, id desc);

create index diagnostic_flag_events_diagnostic_history_idx
  on public.diagnostic_flag_events (diagnostic_id, created_at desc, id desc);

create or replace function public.admin_get_diagnostic_detail(
  p_diagnostic_id uuid,
  p_section text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '8s'
as $$
declare
  v_d public.diagnostics%rowtype;
  v_privacy_consent jsonb;
  v_commercial_consent jsonb;
  v_privacy_allowed boolean := false;
  v_contact_allowed boolean := false;
  v_identity_available boolean := false;
  v_meta jsonb;
  v_content jsonb;
begin
  if p_diagnostic_id is null or p_section not in (
    'OVERVIEW', 'INTERVIEW', 'QUALIFICATION', 'FLAGS', 'BRIEFING', 'AUDIT'
  ) then
    raise exception using errcode = '22023', message = 'invalid admin detail request';
  end if;

  select * into v_d
  from public.diagnostics diagnostic
  where diagnostic.id = p_diagnostic_id
    and diagnostic.archived_at is null;

  if not found then return null; end if;

  select jsonb_build_object(
    'decision', consent.decision::text,
    'policyVersion', consent.policy_version,
    'occurredAt', consent.occurred_at
  ) into v_privacy_consent
  from public.consent_records consent
  where consent.diagnostic_id = v_d.id
    and consent.consent_type = 'PRIVACY'
    and not exists (
      select 1 from public.consent_records replacement
      where replacement.supersedes_id = consent.id
    )
  order by consent.occurred_at desc, consent.created_at desc, consent.id desc
  limit 1;

  select jsonb_build_object(
    'decision', consent.decision::text,
    'policyVersion', consent.policy_version,
    'occurredAt', consent.occurred_at
  ) into v_commercial_consent
  from public.consent_records consent
  where consent.diagnostic_id = v_d.id
    and consent.consent_type = 'COMMERCIAL'
    and not exists (
      select 1 from public.consent_records replacement
      where replacement.supersedes_id = consent.id
    )
  order by consent.occurred_at desc, consent.created_at desc, consent.id desc
  limit 1;

  select coalesce(lead.anonymized_at is null and company.anonymized_at is null, false)
  into v_identity_available
  from public.leads lead
  join public.companies company on company.id = lead.company_id
  where lead.id = v_d.lead_id;

  v_privacy_allowed := coalesce(v_privacy_consent->>'decision' = 'ACCEPTED', false)
    and coalesce(v_identity_available, false);
  v_contact_allowed := v_privacy_allowed
    and coalesce(v_commercial_consent->>'decision' = 'ACCEPTED', false)
    and v_d.status <> 'COMPLETED_NO_CONTACT';

  select jsonb_build_object(
    'diagnosticId', v_d.id,
    'diagnosticStatus', v_d.status::text,
    'companyName', case when v_privacy_allowed then company.name end,
    'finalScore', assessment.final_score,
    'classification', assessment.classification::text,
    'contactAllowed', v_contact_allowed,
    'createdAt', v_d.created_at,
    'completedAt', v_d.completed_at,
    'rowVersion', v_d.row_version,
    'currentAssessmentId', v_d.current_assessment_id,
    'currentBriefingId', v_d.current_briefing_id
  ) into v_meta
  from (select 1) singleton
  left join public.leads lead on lead.id = v_d.lead_id
  left join public.companies company on company.id = lead.company_id
  left join public.qualification_assessments assessment
    on assessment.id = v_d.current_assessment_id
    and assessment.diagnostic_id = v_d.id
    and assessment.is_current = true;

  if p_section = 'OVERVIEW' then
    select jsonb_build_object(
      'diagnostic', jsonb_build_object(
        'status', v_d.status::text,
        'currentStage', v_d.current_stage::text,
        'completionPercentage', v_d.completion_percentage,
        'schemaVersion', v_d.schema_version,
        'interviewVersion', v_d.interview_version,
        'createdAt', v_d.created_at,
        'updatedAt', v_d.updated_at,
        'completedAt', v_d.completed_at
      ),
      'company', case when v_privacy_allowed then jsonb_build_object(
        'name', company.name,
        'industry', company.industry,
        'industryOther', company.industry_other,
        'employeeRange', company.employee_range,
        'revenueRange', company.revenue_range
      ) end,
      'contact', case when v_privacy_allowed then jsonb_build_object(
        'name', lead.name,
        'role', lead.role,
        'roleCategory', lead.role_category,
        'email', lead.email::text,
        'emailType', lead.email_type,
        'emailValidated', lead.email_validated,
        'phone', lead.phone_e164
      ) end,
      'privacyConsent', v_privacy_consent,
      'commercialConsent', v_commercial_consent,
      'contactAllowed', v_contact_allowed,
      'privacyRestricted', not v_privacy_allowed,
      'primaryArea', area.primary_area,
      'declaredPriority', priority.declared_priority,
      'executiveSummary', case when v_privacy_allowed then briefing.executive_summary end,
      'assessment', case when assessment.id is null then null else jsonb_build_object(
        'id', assessment.id,
        'version', assessment.version,
        'finalScore', assessment.final_score,
        'normalizedScore', assessment.normalized_score,
        'classification', assessment.classification::text,
        'confidence', assessment.assessment_confidence::text,
        'assessedWeight', assessment.assessed_weight,
        'scoreCapApplied', assessment.score_cap_applied,
        'calculatedAt', assessment.calculated_at
      ) end,
      'highestActiveFlag', case when active_flag.id is null then null else jsonb_build_object(
        'code', active_flag.code,
        'displayName', active_flag.display_name,
        'severity', active_flag.severity::text
      ) end
    ) into v_content
    from (select 1) singleton
    left join public.leads lead on lead.id = v_d.lead_id
    left join public.companies company on company.id = lead.company_id
    left join public.qualification_assessments assessment
      on assessment.id = v_d.current_assessment_id
      and assessment.diagnostic_id = v_d.id
      and assessment.is_current = true
    left join public.commercial_briefings briefing
      on briefing.id = v_d.current_briefing_id
      and briefing.diagnostic_id = v_d.id
      and briefing.status = 'FINAL'
    left join lateral (
      select candidate.value as primary_area
      from public.interview_answers answer
      cross join lateral (
        select answer.normalized_value ->> 'challenge.primaryAffectedArea' as value
      ) candidate
      where answer.diagnostic_id = v_d.id
        and answer.is_current = true
        and answer.redacted = false
        and answer.response_type <> 'SKIPPED'
        and answer.validation_status in ('VALID', 'NOT_CONFIRMED')
        and answer.source_type <> 'AI_INFERENCE'
        and (
          answer.question_code = 'CHALLENGE_001'
          or answer.question_code like 'CLARIFY\_\_CHALLENGE\_001\_\_%' escape '\'
        )
        and candidate.value in (
          'COMMERCIAL', 'FINANCE', 'CUSTOMER_SERVICE', 'OPERATIONS_LOGISTICS',
          'PROCUREMENT', 'HUMAN_RESOURCES', 'LEGAL', 'TECHNOLOGY', 'OTHER'
        )
      order by
        case when answer.validation_status = 'VALID' then 0 else 1 end,
        case when answer.question_code like 'CLARIFY\_\_%' escape '\' then 0 else 1 end,
        answer.created_at desc,
        answer.id desc
      limit 1
    ) area on true
    left join lateral (
      select candidate.value::integer as declared_priority
      from public.interview_answers answer
      cross join lateral (
        select coalesce(
          answer.normalized_value ->> 'buyingContext.priority',
          case
            when answer.question_code = 'BUYING_001'
              and jsonb_typeof(answer.raw_value) = 'number'
            then answer.raw_value #>> '{}'
          end
        ) as value
      ) candidate
      where answer.diagnostic_id = v_d.id
        and answer.is_current = true
        and answer.redacted = false
        and answer.response_type <> 'SKIPPED'
        and answer.validation_status in ('VALID', 'NOT_CONFIRMED')
        and answer.source_type <> 'AI_INFERENCE'
        and (
          answer.question_code = 'BUYING_001'
          or answer.question_code like 'CLARIFY\_\_BUYING\_001\_\_%' escape '\'
        )
        and candidate.value in ('1', '2', '3', '4', '5')
      order by
        case when answer.validation_status = 'VALID' then 0 else 1 end,
        case when answer.question_code like 'CLARIFY\_\_%' escape '\' then 0 else 1 end,
        answer.created_at desc,
        answer.id desc
      limit 1
    ) priority on true
    left join lateral (
      select flag.id, flag.code, flag.display_name, flag.severity
      from public.diagnostic_flags flag
      where flag.diagnostic_id = v_d.id and flag.status = 'ACTIVE'
      order by
        case flag.severity when 'S3' then 3 when 'S2' then 2 when 'S1' then 1 else 0 end desc,
        flag.triggered_at desc,
        flag.id desc
      limit 1
    ) active_flag on true;

  elsif p_section = 'INTERVIEW' then
    select jsonb_build_object(
      'privacyRestricted', not v_privacy_allowed,
      'identification', jsonb_build_object(
        'companyName', case when v_privacy_allowed then company.name end,
        'contactName', case when v_privacy_allowed then lead.name end,
        'contactRole', case when v_privacy_allowed then lead.role end,
        'industry', case when v_privacy_allowed then company.industry end,
        'employeeRange', case when v_privacy_allowed then company.employee_range end
      ),
      'sessions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', session.id,
          'status', session.status::text,
          'currentStage', session.current_stage::text,
          'startedAt', session.started_at,
          'lastActivityAt', session.last_activity_at,
          'completedAt', session.completed_at,
          'totalQuestionCount', session.total_question_count,
          'clarificationCount', session.clarification_count
        ) order by session.started_at, session.id)
        from public.diagnostic_sessions session
        where session.diagnostic_id = v_d.id
      ), '[]'::jsonb),
      'answers', case when not v_privacy_allowed then '[]'::jsonb else coalesce((
        select jsonb_agg(answer_row.item order by answer_row.created_at, answer_row.id)
        from (
          select answer.id, answer.created_at, jsonb_build_object(
            'id', answer.id,
            'sessionId', answer.session_id,
            'questionCode', answer.question_code,
            'questionVersion', answer.question_version,
            'responseType', answer.response_type::text,
            'displayValue', case when answer.redacted then null else answer.display_value end,
            'normalizedFields', case when answer.redacted then '[]'::jsonb else coalesce((
              select jsonb_agg(jsonb_build_object(
                'path', field.key,
                'value', left(case
                  when jsonb_typeof(field.value) = 'string' then field.value #>> '{}'
                  else field.value::text
                end, 10000)
              ) order by field.key)
              from jsonb_each(coalesce(answer.normalized_value, '{}'::jsonb)) field
            ), '[]'::jsonb) end,
            'validationStatus', answer.validation_status::text,
            'sourceType', answer.source_type::text,
            'confidence', answer.confidence,
            'confirmed', answer.confirmed,
            'revision', answer.revision,
            'isCurrent', answer.is_current,
            'skipReason', answer.skip_reason,
            'redacted', answer.redacted,
            'clarificationForCode', question_event.clarification_for_code,
            'createdAt', answer.created_at
          ) as item
          from public.interview_answers answer
          left join lateral (
            select event.clarification_for_code
            from public.interview_question_events event
            where event.session_id = answer.session_id
              and event.question_code = answer.question_code
              and event.event_type = 'CLARIFICATION_ANSWERED'
            order by event.created_at desc, event.id desc
            limit 1
          ) question_event on true
          where answer.diagnostic_id = v_d.id
          order by answer.created_at, answer.id
          limit 500
        ) answer_row
      ), '[]'::jsonb) end,
      'review', case when not v_privacy_allowed then null else (
        select jsonb_build_object(
          'id', review.id,
          'version', review.version,
          'status', review.status::text,
          'generatedAt', review.generated_at,
          'confirmedAt', review.confirmed_at,
          'revisionCount', review.revision_count,
          'summary', jsonb_build_object(
            'company', review.summary->>'company',
            'affectedArea', review.summary->>'affectedArea',
            'challenge', review.summary->>'challenge',
            'currentProcess', review.summary->>'currentProcess',
            'participants', review.summary->>'participants',
            'systems', coalesce((select jsonb_agg(value #>> '{}') from jsonb_array_elements(
              case when jsonb_typeof(review.summary->'systems') = 'array' then review.summary->'systems' else '[]'::jsonb end
            ) value where jsonb_typeof(value) = 'string'), '[]'::jsonb),
            'mainImpacts', coalesce((select jsonb_agg(value #>> '{}') from jsonb_array_elements(
              case when jsonb_typeof(review.summary->'mainImpacts') = 'array' then review.summary->'mainImpacts' else '[]'::jsonb end
            ) value where jsonb_typeof(value) = 'string'), '[]'::jsonb),
            'desiredOutcome', review.summary->>'desiredOutcome',
            'priority', review.summary->>'priority',
            'deadline', review.summary->>'deadline',
            'decisionContext', review.summary->>'decisionContext'
          )
        )
        from public.diagnostic_reviews review
        where review.diagnostic_id = v_d.id
          and review.status <> 'SUPERSEDED'
        order by review.version desc
        limit 1
      ) end,
      'reviewHistory', case when not v_privacy_allowed then '[]'::jsonb else coalesce((
        select jsonb_agg(history.item order by history.version desc)
        from (
          select review.version, jsonb_build_object(
            'id', review.id,
            'version', review.version,
            'status', review.status::text,
            'generatedAt', review.generated_at,
            'confirmedAt', review.confirmed_at
          ) item
          from public.diagnostic_reviews review
          where review.diagnostic_id = v_d.id
          order by review.version desc
          limit 25
        ) history
      ), '[]'::jsonb) end,
      'truncated', (
        select count(*) > 500 from public.interview_answers answer
        where answer.diagnostic_id = v_d.id
      )
    ) into v_content
    from (select 1) singleton
    left join public.leads lead on lead.id = v_d.lead_id
    left join public.companies company on company.id = lead.company_id;

  elsif p_section = 'QUALIFICATION' then
    select jsonb_build_object(
      'current', case when assessment.id is null then null else jsonb_build_object(
        'id', assessment.id,
        'version', assessment.version,
        'earnedPoints', assessment.earned_points,
        'assessedWeight', assessment.assessed_weight,
        'normalizedScore', assessment.normalized_score,
        'finalScore', assessment.final_score,
        'scoreCapApplied', assessment.score_cap_applied,
        'classification', assessment.classification::text,
        'confidence', assessment.assessment_confidence::text,
        'recommendedRoute', assessment.recommended_route::text,
        'automaticSchedulingEligible', assessment.automatic_scheduling_eligible,
        'calculatedAt', assessment.calculated_at,
        'dimensions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'code', dimension.dimension_code,
            'earnedPoints', dimension.earned_points,
            'assessedWeight', dimension.assessed_weight,
            'maxWeight', dimension.max_weight,
            'criteria', coalesce((
              select jsonb_agg(jsonb_build_object(
                'code', criterion.criterion_code,
                'earnedPoints', criterion.earned_points,
                'assessedWeight', criterion.assessed_weight,
                'maxWeight', criterion.max_weight,
                'rationale', criterion.rationale,
                'evidence', coalesce((
                  select jsonb_agg(jsonb_build_object(
                    'id', evidence.id,
                    'text', case when v_privacy_allowed and not evidence.redacted then evidence.text end,
                    'targetPath', evidence.target_path,
                    'sourceType', evidence.source_type::text,
                    'confidence', evidence.confidence,
                    'confirmed', evidence.confirmed,
                    'redacted', evidence.redacted
                  ) order by evidence.created_at, evidence.id)
                  from public.criterion_evidence_links link
                  join public.evidence_items evidence
                    on evidence.id = link.evidence_item_id
                    and evidence.diagnostic_id = v_d.id
                  where link.criterion_result_id = criterion.id
                ), '[]'::jsonb)
              ) order by criterion.criterion_code)
              from public.qualification_criterion_results criterion
              where criterion.assessment_id = assessment.id
                and criterion.dimension_result_id = dimension.id
            ), '[]'::jsonb)
          ) order by dimension.dimension_code)
          from public.qualification_dimension_results dimension
          where dimension.assessment_id = assessment.id
        ), '[]'::jsonb)
      ) end,
      'history', coalesce((
        select jsonb_agg(history.item order by history.version desc)
        from (
          select item.version, jsonb_build_object(
            'id', item.id,
            'version', item.version,
            'finalScore', item.final_score,
            'normalizedScore', item.normalized_score,
            'classification', item.classification::text,
            'confidence', item.assessment_confidence::text,
            'assessedWeight', item.assessed_weight,
            'scoreCapApplied', item.score_cap_applied,
            'calculatedAt', item.calculated_at
          ) item
          from public.qualification_assessments item
          where item.diagnostic_id = v_d.id
          order by item.version desc
          limit 25
        ) history
      ), '[]'::jsonb),
      'inconsistentCurrentReference', v_d.current_assessment_id is not null and assessment.id is null
    ) into v_content
    from (select 1) singleton
    left join public.qualification_assessments assessment
      on assessment.id = v_d.current_assessment_id
      and assessment.diagnostic_id = v_d.id
      and assessment.is_current = true;

  elsif p_section = 'FLAGS' then
    with projected as materialized (
      select flag.id, flag.status, flag.triggered_at, jsonb_build_object(
        'id', flag.id,
        'code', flag.code,
        'displayName', flag.display_name,
        'category', flag.category,
        'severity', flag.severity::text,
        'status', flag.status::text,
        'source', flag.source::text,
        'reason', case when v_privacy_allowed then flag.reason end,
        'triggerQuestionCode', flag.trigger_question_code,
        'schedulingEffect', flag.scheduling_effect::text,
        'recommendedRoute', flag.recommended_route::text,
        'scoreEffect', flag.score_effect,
        'resolutionCondition', case when v_privacy_allowed then flag.resolution_condition end,
        'triggeredAt', flag.triggered_at,
        'resolvedAt', flag.resolved_at,
        'updatedAt', flag.updated_at
      ) item
      from public.diagnostic_flags flag
      where flag.diagnostic_id = v_d.id
    )
    select jsonb_build_object(
      'privacyRestricted', not v_privacy_allowed,
      'active', coalesce((select jsonb_agg(item order by
        case item->>'severity' when 'S3' then 3 when 'S2' then 2 when 'S1' then 1 else 0 end desc,
        triggered_at desc, id desc
      ) from (select * from projected where status = 'ACTIVE' order by triggered_at desc limit 100) rows), '[]'::jsonb),
      'resolved', coalesce((select jsonb_agg(item order by triggered_at desc, id desc)
        from (select * from projected where status = 'RESOLVED' order by triggered_at desc limit 100) rows
      ), '[]'::jsonb),
      'history', coalesce((
        select jsonb_agg(history.item order by history.created_at desc, history.id desc)
        from (
          select event.id, event.created_at, jsonb_build_object(
            'id', event.id,
            'flagId', event.flag_id,
            'flagCode', flag.code,
            'eventType', event.event_type,
            'previousStatus', event.previous_status::text,
            'newStatus', event.new_status::text,
            'reason', case when v_privacy_allowed then event.reason end,
            'createdAt', event.created_at
          ) item
          from public.diagnostic_flag_events event
          join public.diagnostic_flags flag
            on flag.id = event.flag_id and flag.diagnostic_id = v_d.id
          where event.diagnostic_id = v_d.id
          order by event.created_at desc, event.id desc
          limit 100
        ) history
      ), '[]'::jsonb),
      'truncated', (select count(*) > 100 from public.diagnostic_flags where diagnostic_id = v_d.id)
        or (select count(*) > 100 from public.diagnostic_flag_events where diagnostic_id = v_d.id)
    ) into v_content;

  elsif p_section = 'BRIEFING' then
    select jsonb_build_object(
      'privacyRestricted', not v_privacy_allowed,
      'current', case when briefing.id is null then null else jsonb_build_object(
        'id', briefing.id,
        'version', briefing.version,
        'status', briefing.status::text,
        'generatedAt', briefing.generated_at,
        'executiveSummary', case when v_privacy_allowed then briefing.executive_summary end,
        'challengeSummary', case when v_privacy_allowed then briefing.challenge_summary end,
        'currentProcessSummary', case when v_privacy_allowed then briefing.current_process_summary end,
        'impactSummary', case when v_privacy_allowed then briefing.impact_summary end,
        'buyingContextSummary', case when v_privacy_allowed then briefing.buying_context_summary end,
        'technicalContextSummary', case when v_privacy_allowed then briefing.technical_context_summary end,
        'initialHypotheses', case when v_privacy_allowed then coalesce((select jsonb_agg(value #>> '{}')
          from jsonb_array_elements(briefing.initial_hypotheses) value where jsonb_typeof(value) = 'string'), '[]'::jsonb) else '[]'::jsonb end,
        'missingInformation', case when v_privacy_allowed then coalesce((select jsonb_agg(value #>> '{}')
          from jsonb_array_elements(briefing.missing_information) value where jsonb_typeof(value) = 'string'), '[]'::jsonb) else '[]'::jsonb end,
        'recommendedQuestions', case when v_privacy_allowed then coalesce((select jsonb_agg(value #>> '{}')
          from jsonb_array_elements(briefing.recommended_questions) value where jsonb_typeof(value) = 'string'), '[]'::jsonb) else '[]'::jsonb end,
        'recommendedParticipants', case when v_privacy_allowed then coalesce((select jsonb_agg(value #>> '{}')
          from jsonb_array_elements(briefing.recommended_participants) value where jsonb_typeof(value) = 'string'), '[]'::jsonb) else '[]'::jsonb end,
        'recommendedOffer', briefing.recommended_offer::text
      ) end,
      'history', coalesce((
        select jsonb_agg(history.item order by history.version desc)
        from (
          select item.version, jsonb_build_object(
            'id', item.id,
            'version', item.version,
            'status', item.status::text,
            'generatedAt', item.generated_at,
            'isCurrent', item.id = v_d.current_briefing_id
          ) item
          from public.commercial_briefings item
          where item.diagnostic_id = v_d.id
          order by item.version desc
          limit 25
        ) history
      ), '[]'::jsonb),
      'inconsistentCurrentReference', v_d.current_briefing_id is not null and briefing.id is null,
      'originRecorded', false
    ) into v_content
    from (select 1) singleton
    left join public.commercial_briefings briefing
      on briefing.id = v_d.current_briefing_id
      and briefing.diagnostic_id = v_d.id
      and briefing.status = 'FINAL';

  elsif p_section = 'AUDIT' then
    select jsonb_build_object(
      'events', coalesce((
        select jsonb_agg(events.item order by events.occurred_at desc, events.id desc)
        from (
          select event.id, event.occurred_at, jsonb_build_object(
            'id', event.id,
            'eventType', event.event_type,
            'actorType', event.actor_type,
            'questionCode', case when event.event_type = 'ANSWER_SAVED' then event.metadata->>'questionCode' end,
            'version', case
              when event.metadata->>'version' ~ '^[0-9]+$' then (event.metadata->>'version')::integer
            end,
            'consentType', case when event.event_type = 'CONSENT_RECORDED' then event.metadata->>'type' end,
            'decision', case when event.event_type = 'CONSENT_RECORDED' then event.metadata->>'decision' end,
            'occurredAt', event.occurred_at
          ) item
          from public.audit_events event
          where event.diagnostic_id = v_d.id
            and event.event_type in (
              'DIAGNOSTIC_STARTED', 'CONSENT_RECORDED', 'IDENTIFICATION_SAVED',
              'ANSWER_SAVED', 'REVIEW_GENERATED', 'REVIEW_UPDATED', 'REVIEW_CONFIRMED',
              'DIAGNOSTIC_COMPLETED', 'DIAGNOSTIC_ABANDONED'
            )
          order by event.occurred_at desc, event.id desc
          limit 100
        ) events
      ), '[]'::jsonb),
      'truncated', (
        select count(*) > 100
        from public.audit_events event
        where event.diagnostic_id = v_d.id
          and event.event_type in (
            'DIAGNOSTIC_STARTED', 'CONSENT_RECORDED', 'IDENTIFICATION_SAVED',
            'ANSWER_SAVED', 'REVIEW_GENERATED', 'REVIEW_UPDATED', 'REVIEW_CONFIRMED',
            'DIAGNOSTIC_COMPLETED', 'DIAGNOSTIC_ABANDONED'
          )
      )
    ) into v_content;
  end if;

  return jsonb_build_object('section', p_section, 'meta', v_meta, 'content', v_content);
end;
$$;

revoke all on function public.admin_get_diagnostic_detail(uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_get_diagnostic_detail(uuid, text) to service_role;

comment on function public.admin_get_diagnostic_detail(uuid, text) is
  'Section-based, read-only ADM projection. Execution is reserved for the trusted Edge backend.';
