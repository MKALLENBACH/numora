-- NUMORA ADM 02: secure, server-side diagnostic list projection.

create index consent_records_diagnostic_type_occurred_idx
  on public.consent_records (
    diagnostic_id,
    consent_type,
    occurred_at desc,
    created_at desc,
    id desc
  );

create index consent_records_supersedes_idx
  on public.consent_records (supersedes_id)
  where supersedes_id is not null;

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
      coalesce(commercial_consent.decision = 'ACCEPTED', false) as contact_allowed,
      d.created_at,
      case
        when privacy_consent.decision = 'ACCEPTED' and l.anonymized_at is null
        then l.email::text
      end as searchable_email
    from public.diagnostics d
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
  ), filtered as materialized (
    select *
    from enriched item
    where (
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
          'reviewStatus', null,
          'contactAllowed', item.contact_allowed,
          'assignee', null,
          'createdAt', item.created_at
        ) order by item.list_position
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
