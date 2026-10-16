-- ADM 04: additive, versioned read models. Legacy callers retain their ADM 02/03 contract.
create or replace function public.admin_list_diagnostics(p_request jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
set statement_timeout = '8s'
as $$
declare
  v_page integer := coalesce((p_request ->> 'page')::integer, 1);
  v_page_size integer := coalesce((p_request ->> 'pageSize')::integer, 25);
  v_offset integer;
  v_search text := nullif(btrim(p_request ->> 'search'), '');
  v_filters jsonb := coalesce(p_request -> 'filters', '{}'::jsonb);
  v_sort_field text := coalesce(p_request #>> '{sort,field}', 'createdAt');
  v_sort_direction text := coalesce(p_request #>> '{sort,direction}', 'desc');
  v_result jsonb;
begin
  if p_request is null or jsonb_typeof(p_request) <> 'object' then
    raise exception using errcode = '22023', message = 'invalid admin list request';
  end if;
  if v_page < 1 or v_page > 100000 or v_page_size <> 25 then
    raise exception using errcode = '22023', message = 'invalid pagination';
  end if;
  if v_search is not null and (char_length(v_search) < 2 or char_length(v_search) > 320) then
    raise exception using errcode = '22023', message = 'invalid search';
  end if;
  if v_sort_field not in (
    'createdAt', 'finalScore', 'declaredPriority', 'highestFlagSeverity', 'companyName'
  ) or v_sort_direction not in ('asc', 'desc') then
    raise exception using errcode = '22023', message = 'invalid sort';
  end if;

  v_offset := (v_page - 1) * v_page_size;

  with enriched as materialized (
    select
      d.id as diagnostic_id,
      r.status as admin_review_status,r.priority as admin_priority,r.assignee_profile_id,
      ap.display_name as assignee_name,
      case
        when privacy_consent.decision = 'ACCEPTED'
          and l.anonymized_at is null
          and c.anonymized_at is null
        then c.name
      end as company_name,
      case
        when privacy_consent.decision = 'ACCEPTED' and l.anonymized_at is null
        then l.name
      end as contact_name,
      case
        when privacy_consent.decision = 'ACCEPTED' and l.anonymized_at is null
        then l.role
      end as contact_role,
      case
        when privacy_consent.decision = 'ACCEPTED'
          and l.anonymized_at is null
          and c.anonymized_at is null
        then c.industry
      end as industry,
      case
        when privacy_consent.decision = 'ACCEPTED'
          and l.anonymized_at is null
          and c.anonymized_at is null
        then c.employee_range
      end as employee_range,
      area.primary_area,
      priority.declared_priority,
      qa.final_score,
      qa.classification::text as classification,
      active_flag.severity as highest_flag_severity,
      active_flag.rank as flag_rank,
      d.status::text as diagnostic_status,
      (public.admin_workflow_privacy(d.id)->>'contactAllowed')::boolean as contact_allowed,
      d.created_at,
      case
        when privacy_consent.decision = 'ACCEPTED' and l.anonymized_at is null
        then l.email::text
      end as searchable_email
    from public.diagnostics d
    left join public.diagnostic_review_states r on r.diagnostic_id=d.id
    left join public.admin_profiles ap on ap.id=r.assignee_profile_id
    left join public.leads l on l.id = d.lead_id
    left join public.companies c on c.id = l.company_id
    left join public.qualification_assessments qa
      on qa.id = d.current_assessment_id
      and qa.diagnostic_id = d.id
      and qa.is_current = true
    left join lateral (
      select candidate.value as primary_area
      from public.interview_answers answer
      cross join lateral (
        select answer.normalized_value ->> 'challenge.primaryAffectedArea' as value
      ) candidate
      where answer.diagnostic_id = d.id
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
      where answer.diagnostic_id = d.id
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
      select
        flag.severity::text as severity,
        case flag.severity
          when 'S3' then 3
          when 'S2' then 2
          when 'S1' then 1
          else 0
        end as rank
      from public.diagnostic_flags flag
      where flag.diagnostic_id = d.id and flag.status = 'ACTIVE'
      order by rank desc, flag.triggered_at desc, flag.id desc
      limit 1
    ) active_flag on true
    left join lateral (
      select consent.decision::text as decision
      from public.consent_records consent
      where consent.diagnostic_id = d.id
        and consent.consent_type = 'PRIVACY'
        and not exists (
          select 1
          from public.consent_records replacement
          where replacement.supersedes_id = consent.id
        )
      order by consent.occurred_at desc, consent.created_at desc, consent.id desc
      limit 1
    ) privacy_consent on true
    left join lateral (
      select consent.decision::text as decision
      from public.consent_records consent
      where consent.diagnostic_id = d.id
        and consent.consent_type = 'COMMERCIAL'
        and not exists (
          select 1
          from public.consent_records replacement
          where replacement.supersedes_id = consent.id
        )
      order by consent.occurred_at desc, consent.created_at desc, consent.id desc
      limit 1
    ) commercial_consent on true
    where d.archived_at is null
      and (coalesce(p_request->>'workflowVersion','')<>'1' or
      coalesce(v_filters->>'archiveMode','ACTIVE')='ALL' or
      (coalesce(v_filters->>'archiveMode','ACTIVE')='ACTIVE' and coalesce(r.status,'NEW')<>'ARCHIVED') or
      (v_filters->>'archiveMode'='ARCHIVED' and r.status='ARCHIVED'))
  ), filtered as materialized (
    select *
    from enriched item
    where (v_filters->>'reviewStatus' is null or item.admin_review_status=v_filters->>'reviewStatus')
      and (v_filters->>'adminPriority' is null or item.admin_priority=v_filters->>'adminPriority')
      and (v_filters->>'assigneeId' is null or item.assignee_profile_id=(v_filters->>'assigneeId')::uuid)
      and (
      v_search is null
      or strpos(lower(coalesce(item.company_name, '')), lower(v_search)) > 0
      or strpos(lower(coalesce(item.contact_name, '')), lower(v_search)) > 0
      or strpos(lower(coalesce(item.searchable_email, '')), lower(v_search)) > 0
    )
      and (
        coalesce(jsonb_array_length(v_filters -> 'diagnosticStatus'), 0) = 0
        or (v_filters -> 'diagnosticStatus') ? item.diagnostic_status
      )
      and (
        coalesce(jsonb_array_length(v_filters -> 'classification'), 0) = 0
        or (v_filters -> 'classification') ? item.classification
      )
      and (
        v_filters ->> 'scoreState' is null
        or (v_filters ->> 'scoreState' = 'PRESENT' and item.final_score is not null)
        or (v_filters ->> 'scoreState' = 'ABSENT' and item.final_score is null)
      )
      and (
        v_filters ->> 'scoreMin' is null
        or item.final_score >= (v_filters ->> 'scoreMin')::integer
      )
      and (
        v_filters ->> 'scoreMax' is null
        or item.final_score <= (v_filters ->> 'scoreMax')::integer
      )
      and (
        coalesce(jsonb_array_length(v_filters -> 'industry'), 0) = 0
        or (v_filters -> 'industry') ? item.industry
      )
      and (
        coalesce(jsonb_array_length(v_filters -> 'employeeRange'), 0) = 0
        or (v_filters -> 'employeeRange') ? item.employee_range
      )
      and (
        coalesce(jsonb_array_length(v_filters -> 'primaryArea'), 0) = 0
        or (v_filters -> 'primaryArea') ? item.primary_area
      )
      and (
        coalesce(jsonb_array_length(v_filters -> 'declaredPriority'), 0) = 0
        or (v_filters -> 'declaredPriority') ? item.declared_priority::text
      )
      and (
        coalesce(jsonb_array_length(v_filters -> 'flagSeverity'), 0) = 0
        or (v_filters -> 'flagSeverity') ? item.highest_flag_severity
      )
      and (
        v_filters ->> 'contactAllowed' is null
        or item.contact_allowed = (v_filters ->> 'contactAllowed')::boolean
      )
      and (
        v_filters ->> 'dateFrom' is null
        or item.created_at >= (
          (v_filters ->> 'dateFrom')::date::timestamp at time zone 'America/Sao_Paulo'
        )
      )
      and (
        v_filters ->> 'dateTo' is null
        or item.created_at < (
          ((v_filters ->> 'dateTo')::date + 1)::timestamp at time zone 'America/Sao_Paulo'
        )
      )
  ), ranked as materialized (
    select
      item.*,
      row_number() over (
        order by
          case when v_sort_field = 'createdAt' and v_sort_direction = 'asc'
            then item.created_at end asc,
          case when v_sort_field = 'createdAt' and v_sort_direction = 'desc'
            then item.created_at end desc,
          case when v_sort_field = 'finalScore' and v_sort_direction = 'asc'
            then item.final_score end asc nulls last,
          case when v_sort_field = 'finalScore' and v_sort_direction = 'desc'
            then item.final_score end desc nulls last,
          case when v_sort_field = 'declaredPriority' and v_sort_direction = 'asc'
            then item.declared_priority end asc nulls last,
          case when v_sort_field = 'declaredPriority' and v_sort_direction = 'desc'
            then item.declared_priority end desc nulls last,
          case when v_sort_field = 'highestFlagSeverity' and v_sort_direction = 'asc'
            then item.flag_rank end asc nulls last,
          case when v_sort_field = 'highestFlagSeverity' and v_sort_direction = 'desc'
            then item.flag_rank end desc nulls last,
          case when v_sort_field = 'companyName' and v_sort_direction = 'asc'
            then lower(item.company_name) end asc nulls last,
          case when v_sort_field = 'companyName' and v_sort_direction = 'desc'
            then lower(item.company_name) end desc nulls last,
          case when v_sort_field = 'createdAt' and v_sort_direction = 'asc'
            then item.diagnostic_id end asc,
          item.created_at desc,
          item.diagnostic_id desc
      ) as list_position
    from filtered item
  ), totals as (
    select count(*)::integer as total_items from filtered
  ), page_items as (
    select *
    from ranked
    where list_position > v_offset and list_position <= v_offset + v_page_size
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'diagnosticId', item.diagnostic_id,
          'companyName', item.company_name,
          'contactName', item.contact_name,
          'contactRole', item.contact_role,
          'industry', item.industry,
          'employeeRange', item.employee_range,
          'primaryArea', item.primary_area,
          'declaredPriority', item.declared_priority,
          'finalScore', item.final_score,
          'classification', item.classification,
          'highestFlagSeverity', item.highest_flag_severity,
          'diagnosticStatus', item.diagnostic_status,
          'reviewStatus', case when p_request->>'workflowVersion'='1' then item.admin_review_status end,
          'contactAllowed', item.contact_allowed,
          'assignee', case when p_request->>'workflowVersion'='1' and item.assignee_profile_id is not null then jsonb_build_object('profileId',item.assignee_profile_id,'displayName',item.assignee_name) end,
          'createdAt', item.created_at
         ) || case when p_request->>'workflowVersion'='1' then jsonb_build_object('adminPriority',coalesce(item.admin_priority,'NORMAL')) else '{}'::jsonb end
        order by item.list_position
      )
      from page_items item
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', v_page,
      'pageSize', v_page_size,
      'totalItems', totals.total_items,
      'totalPages', case
        when totals.total_items = 0 then 0
        else ceil(totals.total_items::numeric / v_page_size)::integer
      end
    )
  ) into v_result
  from totals;

  return v_result;
end;
$$;

revoke all on function public.admin_list_diagnostics(jsonb) from public, anon, authenticated;
grant execute on function public.admin_list_diagnostics(jsonb) to service_role;

comment on function public.admin_list_diagnostics(jsonb) is
  'Minimal, paginated ADM projection. Execution is reserved for the trusted Edge backend.';



create function public.admin_read_workflow(p_actor uuid,p_id uuid,p_before jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare g jsonb; notes jsonb; cursor jsonb; hypotheses jsonb;
begin
 perform public.admin_workflow_profile(p_actor);
 perform 1 from public.diagnostics where id=p_id for share;
 g:=public.admin_workflow_summary(p_actor,p_id);
 if g is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 if (g->>'privacyRestricted')::boolean then
  return jsonb_build_object('workflow',g,'notes','[]'::jsonb,'nextCursor',null,'hypotheses','[]'::jsonb);
 end if;
 with page as materialized (
  select n.*,coalesce(p.display_name,'Perfil removido') as author from public.diagnostic_internal_notes n
  left join public.admin_profiles p on p.id=n.author_profile_id where n.diagnostic_id=p_id
  and (p_before is null or (n.created_at,n.id)<((p_before->>'createdAt')::timestamptz,(p_before->>'id')::uuid))
  order by n.created_at desc,n.id desc limit 26
 ), visible as (select * from page order by created_at desc,id desc limit 25)
 select coalesce((select jsonb_agg(jsonb_build_object('id',id,'category',category,'body',body,'author',author,'createdAt',created_at) order by created_at desc,id desc) from visible),'[]'),
  case when (select count(*) from page)>25 then (select jsonb_build_object('createdAt',created_at,'id',id) from visible order by created_at,id limit 1) end
 into notes,cursor;
 with candidates as (
  select 'BRIEFING'::text as kind,b.id as source_id,(h.ord-1)::integer as idx,h.value #>> '{}' as text
  from public.commercial_briefings b join public.diagnostics d on d.current_briefing_id=b.id
  cross join lateral jsonb_array_elements(b.initial_hypotheses) with ordinality h(value,ord)
  where d.id=p_id and jsonb_typeof(h.value)='string'
  union all
  select 'EVIDENCE',e.id,null,e.text from public.evidence_items e where e.diagnostic_id=p_id and not e.redacted
   and e.source_type in ('AI_INFERENCE','NOT_CONFIRMED') and
   (e.answer_id is null or exists(select 1 from public.interview_answers a where a.id=e.answer_id and a.is_current and not a.redacted))
 )
 select coalesce(jsonb_agg(jsonb_build_object('sourceKind',c.kind,'sourceId',c.source_id,'hypothesisIndex',c.idx,
  'sourceHash',encode(extensions.digest(c.text,'sha256'),'hex'),'text',c.text,'status',coalesce(h.status,'PENDING'),
  'reason',h.reason,'author',p.display_name) order by c.kind,c.source_id,c.idx),'[]') into hypotheses
 from candidates c left join lateral (
  select * from public.diagnostic_hypothesis_reviews x where x.diagnostic_id=p_id
  and ((c.kind='BRIEFING' and x.briefing_id=c.source_id and x.hypothesis_index=c.idx) or (c.kind='EVIDENCE' and x.evidence_item_id=c.source_id))
  and x.source_hash=encode(extensions.digest(c.text,'sha256'),'hex') order by x.version desc limit 1
 ) h on true left join public.admin_profiles p on p.id=h.author_profile_id;
 return jsonb_build_object('workflow',g,'notes',notes,'nextCursor',cursor,'hypotheses',hypotheses,'source',public.admin_workflow_source(p_id));
end $$;

-- Keyset history projections include every version, independent of legacy 25/100 limits.
create function public.admin_read_workflow_history(p_actor uuid,p_id uuid,p_kind text,p_before jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare g jsonb; result jsonb;
begin
 perform public.admin_workflow_profile(p_actor);
 perform 1 from public.diagnostics where id=p_id for share;
 g:=public.admin_workflow_summary(p_actor,p_id);
 if g is null then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 if p_kind not in ('AUDIT','OVERRIDES','HYPOTHESES','FLAGS','QUALIFICATION','BRIEFING') then
  raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
 if (g->>'privacyRestricted')::boolean then return jsonb_build_object('items','[]'::jsonb,'nextCursor',null); end if;
 with entries as (
  select e.id,e.created_at,coalesce(p.display_name,'Sistema / perfil removido') author,e.event_type action,e.reason,
   jsonb_build_object('origin','ADMIN','entityId',e.entity_id,'previousStatus',e."before"->'status','status',e."after"->'status','previousPriority',e."before"->'priority','priority',e."after"->'priority') details
   from public.admin_audit_events e left join public.admin_profiles p on p.id=e.profile_id where p_kind='AUDIT' and e.diagnostic_id=p_id
  union all
  select e.id,e.occurred_at,e.actor_type,e.event_type,null,jsonb_build_object('origin','PUBLIC') from public.audit_events e where p_kind='AUDIT' and e.diagnostic_id=p_id
  union all
  select o.id,o.created_at,coalesce(p.display_name,'Perfil removido'),o.operation,o.reason,
   jsonb_build_object('path',o.field_path,'version',o.version,'previousValue',o.previous_effective_value,'value',o.new_value,'verification',o.verification_status,'support',o.evidence_note,'evidenceIds',o.evidence_ids,'sourceAnswerId',o.source_answer_id)
   from public.diagnostic_field_overrides o left join public.admin_profiles p on p.id=o.author_profile_id where p_kind='OVERRIDES' and o.diagnostic_id=p_id
  union all
  select h.id,h.created_at,coalesce(p.display_name,'Perfil removido'),h.status,h.reason,
   jsonb_build_object('version',h.version,'sourceKind',h.source_kind,'sourceId',coalesce(h.briefing_id,h.evidence_item_id),'hypothesisIndex',h.hypothesis_index,'sourceHash',h.source_hash,'support',h.evidence_note,'evidenceIds',h.supporting_evidence_ids)
   from public.diagnostic_hypothesis_reviews h left join public.admin_profiles p on p.id=h.author_profile_id where p_kind='HYPOTHESES' and h.diagnostic_id=p_id
  union all
  select e.id,e.created_at,coalesce(p.display_name,'Sistema / perfil removido'),e.event_type,e.reason,
   jsonb_build_object('flagId',e.flag_id,'code',f.code,'previousStatus',e.previous_status,'status',e.new_status,'evidenceIds',e.evidence_ids)
   from public.diagnostic_flag_events e join public.diagnostic_flags f on f.id=e.flag_id left join public.admin_profiles p on p.id=e.profile_id where p_kind='FLAGS' and e.diagnostic_id=p_id
  union all
  select a.id,a.created_at,'Sistema','QUALIFICATION_RECALCULATED',null,
   jsonb_build_object('version',a.version,'score',a.final_score,'classification',a.classification,'current',a.is_current,'snapshotId',a.input_snapshot_id)
   from public.qualification_assessments a where p_kind='QUALIFICATION' and a.diagnostic_id=p_id
  union all
  select b.id,b.created_at,'Sistema','BRIEFING_REGENERATED',null,
   jsonb_build_object('version',b.version,'status',b.status,'mode',b.generation_mode,'fallbackUsed',b.fallback_used,'snapshotId',b.input_snapshot_id)
   from public.commercial_briefings b where p_kind='BRIEFING' and b.diagnostic_id=p_id
 ), page as materialized (
  select * from entries where p_before is null or (created_at,id)<((p_before->>'createdAt')::timestamptz,(p_before->>'id')::uuid)
  order by created_at desc,id desc limit 26
 ), visible as (select * from page order by created_at desc,id desc limit 25)
 select jsonb_build_object('items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at,'author',author,'action',action,'reason',reason,'details',details) order by created_at desc,id desc) from visible),'[]'),
  'nextCursor',case when (select count(*) from page)>25 then (select jsonb_build_object('createdAt',created_at,'id',id) from visible order by created_at,id limit 1) end) into result;
 return result;
end $$;
revoke all on function public.admin_read_workflow_history(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_read_workflow_history(uuid,uuid,text,jsonb) to service_role;

create function public.admin_get_diagnostic_detail_v4(p_actor uuid,p_id uuid,p_section text,p_before jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare result jsonb; work jsonb; events jsonb;
begin
 perform public.admin_workflow_profile(p_actor);
 if p_section='NOTES' then
  result:=public.admin_get_diagnostic_detail(p_id,'OVERVIEW');
  work:=public.admin_read_workflow(p_actor,p_id,p_before);
  return jsonb_build_object('section','NOTES','meta',(result->'meta')||jsonb_build_object('workflow',work->'workflow'),
   'content',jsonb_build_object('notes',work->'notes','nextCursor',work->'nextCursor','privacyRestricted',work#>'{workflow,privacyRestricted}'));
 end if;
 result:=public.admin_get_diagnostic_detail(p_id,p_section);
 if result is null then return null; end if;
 result:=jsonb_set(result,'{meta}',(result->'meta')||jsonb_build_object('workflow',public.admin_workflow_summary(p_actor,p_id)));
 if p_section='AUDIT' then
  select coalesce(jsonb_agg(item order by occurred_at desc,id desc),'[]') into events from (
   select item,(item->>'occurredAt')::timestamptz occurred_at,item->>'id' id from jsonb_array_elements(result#>'{content,events}') item
   union all
   select jsonb_build_object('id',e.id,'eventType',e.event_type,'actorType',case when e.actor_user_id is null then 'SYSTEM' else 'ADMIN' end,
    'questionCode',null,'version',e."after"->'rowVersion','consentType',null,'decision',null,'occurredAt',e.created_at),
    e.created_at,e.id::text from public.admin_audit_events e where e.diagnostic_id=p_id
   order by occurred_at desc,id desc limit 100
  ) timeline;
  result:=jsonb_set(result,'{content,events}',events);
  result:=jsonb_set(result,'{content,truncated}',to_jsonb(
   (result#>>'{content,truncated}')::boolean or (select count(*) from public.admin_audit_events where diagnostic_id=p_id)>100));
 elsif p_section='BRIEFING' then
  select jsonb_build_object('originRecorded',b.generation_mode is not null,'generationMode',b.generation_mode,'fallbackUsed',b.fallback_used)
   into work from public.commercial_briefings b join public.diagnostics d on d.current_briefing_id=b.id where d.id=p_id;
  result:=jsonb_set(result,'{content}',(result->'content')||coalesce(work,'{"originRecorded":false,"generationMode":null,"fallbackUsed":null}'::jsonb));
 end if;
 return result;
end $$;
revoke all on function public.admin_read_workflow(uuid,uuid,jsonb),public.admin_get_diagnostic_detail_v4(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_read_workflow(uuid,uuid,jsonb),public.admin_get_diagnostic_detail_v4(uuid,uuid,text,jsonb) to service_role;

