create function public.admin_override_value_valid(p_path text,p_value jsonb,p_revert boolean default false) returns boolean language sql immutable set search_path='' as $$
 select p_path=any(array['lead.company','lead.role','lead.industry','lead.employeeRange','challenge.summary','challenge.process','challenge.desiredOutcome','challenge.primaryAffectedArea','currentProcess.description','currentProcess.participants','currentProcess.manualDependency','impact.reportedFinancialImpact','impact.riskOfInaction','buyingContext.deadline','buyingContext.processRedesignOpenness','technicalContext.dataAvailability','technicalContext.itAvailability','challenge.symptoms','currentProcess.systems','currentProcess.involvedAreas','impact.categories','buyingContext.decisionMakers','currentProcess.participantCount','buyingContext.priority','currentProcess.duplicateDataEntry','technicalContext.integrationLikely']) and (p_revert or case
 when p_path=any(array['lead.company','lead.role','lead.industry','lead.employeeRange','challenge.summary','challenge.process','challenge.desiredOutcome','challenge.primaryAffectedArea','currentProcess.description','currentProcess.participants','currentProcess.manualDependency','impact.reportedFinancialImpact','impact.riskOfInaction','buyingContext.deadline','buyingContext.processRedesignOpenness','technicalContext.dataAvailability','technicalContext.itAvailability']) then jsonb_typeof(p_value)='string'
 when p_path=any(array['challenge.symptoms','currentProcess.systems','currentProcess.involvedAreas','impact.categories','buyingContext.decisionMakers']) then jsonb_typeof(p_value)='array'
 when p_path=any(array['currentProcess.participantCount','buyingContext.priority']) then jsonb_typeof(p_value)='number'
 when p_path=any(array['currentProcess.duplicateDataEntry','technicalContext.integrationLikely']) then jsonb_typeof(p_value)='boolean'
 else false end) and (p_revert or length(p_value::text)<=10000);
$$;

-- ADM 04: trusted backend RPCs. Every successful command and its receipt commit together.
create function public.admin_workflow_profile(p_actor uuid) returns public.admin_profiles
language plpgsql security invoker set search_path='' as $$
declare p public.admin_profiles%rowtype;
begin
 select * into p from public.admin_profiles where user_id=p_actor for share;
 if not found or not p.is_active or p.role not in ('ADMIN','CONSULTANT','VIEWER') then
  raise exception using errcode='42501',message='ACCESS_DENIED';
 end if; return p;
end $$;

create function public.admin_workflow_privacy(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'privacyRestricted',not(coalesce(pc.allowed,false) and l.id is not null and l.anonymized_at is null and c.anonymized_at is null),
 'contactAllowed',coalesce(pc.allowed,false) and l.id is not null and l.anonymized_at is null and c.anonymized_at is null
  and coalesce(cc.allowed,false) and d.status<>'COMPLETED_NO_CONTACT')
 from public.diagnostics d left join public.leads l on l.id=d.lead_id left join public.companies c on c.id=l.company_id
 left join lateral (select count(*)=1 and bool_and(x.decision='ACCEPTED') as allowed
  from public.consent_records x where x.diagnostic_id=d.id and x.consent_type='PRIVACY'
  and not exists(select 1 from public.consent_records y where y.supersedes_id=x.id)) pc on true
 left join lateral (select count(*)=1 and bool_and(x.decision='ACCEPTED') as allowed
  from public.consent_records x where x.diagnostic_id=d.id and x.consent_type='COMMERCIAL'
  and not exists(select 1 from public.consent_records y where y.supersedes_id=x.id)) cc on true
 where d.id=p_id;
$$;
create function public.admin_workflow_transitions(p_status text) returns text[]
language sql immutable set search_path='' as $$
 select case p_status
 when 'NEW' then array['UNDER_REVIEW','NO_CONTACT_PERMISSION','BLOCKED','ARCHIVED']
 when 'UNDER_REVIEW' then array['NEEDS_INFORMATION','QUALIFIED','NOT_QUALIFIED','OUT_OF_SCOPE','NO_CONTACT_PERMISSION','BLOCKED','ARCHIVED']
 when 'NEEDS_INFORMATION' then array['UNDER_REVIEW','NO_CONTACT_PERMISSION','BLOCKED','ARCHIVED']
 when 'QUALIFIED' then array['UNDER_REVIEW','NO_CONTACT_PERMISSION','BLOCKED','ARCHIVED']
 when 'NOT_QUALIFIED' then array['UNDER_REVIEW','NO_CONTACT_PERMISSION','BLOCKED','ARCHIVED']
 when 'OUT_OF_SCOPE' then array['UNDER_REVIEW','NO_CONTACT_PERMISSION','BLOCKED','ARCHIVED']
 when 'NO_CONTACT_PERMISSION' then array['UNDER_REVIEW','BLOCKED','ARCHIVED']
 when 'BLOCKED' then array['UNDER_REVIEW','NO_CONTACT_PERMISSION','ARCHIVED']
 else '{}'::text[] end;
$$;

create function public.admin_workflow_source(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
 'diagnostic',to_jsonb(d),'analysisRevision',r.analysis_revision,
 'privacy',public.admin_workflow_privacy(d.id),'lead',to_jsonb(l),'company',to_jsonb(c),
 'session',(select to_jsonb(s) from public.diagnostic_sessions s where s.diagnostic_id=d.id order by s.created_at desc,s.id desc limit 1),
 'answers',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at,a.id) from public.interview_answers a where a.diagnostic_id=d.id and a.is_current),'[]'),
 'evidence',coalesce((select jsonb_agg(to_jsonb(e)||jsonb_build_object('source_locator',(select s.source_locator from public.evidence_sources s where s.evidence_item_id=e.id and s.source_locator like 'admin_override:%' limit 1)) order by e.created_at,e.id) from public.evidence_items e where e.diagnostic_id=d.id),'[]'),
 'consents',coalesce((select jsonb_agg(to_jsonb(x) order by x.occurred_at desc,x.id desc) from public.consent_records x where x.diagnostic_id=d.id
 and not exists(select 1 from public.consent_records y where y.supersedes_id=x.id)),'[]'),
 'flags',coalesce((select jsonb_agg(to_jsonb(f) order by f.id) from public.diagnostic_flags f where f.diagnostic_id=d.id),'[]'),
 'overrides',coalesce((select jsonb_agg(to_jsonb(o) order by o.field_path) from
 (select distinct on(field_path) * from public.diagnostic_field_overrides where diagnostic_id=d.id order by field_path,version desc) o),'[]'),
 'hypothesisReviews',coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at,h.id) from public.diagnostic_hypothesis_reviews h where h.diagnostic_id=d.id),'[]'),
 'briefing',(select to_jsonb(b) from public.commercial_briefings b where b.id=d.current_briefing_id and b.diagnostic_id=d.id),
 'assessment',(select to_jsonb(a) from public.qualification_assessments a where a.id=d.current_assessment_id and a.diagnostic_id=d.id and a.is_current))
 from public.diagnostics d join public.diagnostic_review_states r on r.diagnostic_id=d.id
 left join public.leads l on l.id=d.lead_id left join public.companies c on c.id=l.company_id where d.id=p_id and d.archived_at is null;
$$;

create function public.admin_workflow_can(p_actor uuid,p_id uuid,p_command text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare p public.admin_profiles%rowtype; r public.diagnostic_review_states%rowtype; d public.diagnostics%rowtype; privacy jsonb;
begin
 select * into p from public.admin_profiles where user_id=p_actor and is_active;
 if not found or p.role not in ('ADMIN','CONSULTANT') then return false; end if;
 select * into r from public.diagnostic_review_states where diagnostic_id=p_id;
 select * into d from public.diagnostics where id=p_id and archived_at is null;
 if not found then return false; end if;
 if p_command='REOPEN' then return p.role='ADMIN' and r.status='ARCHIVED'; end if;
 if r.status='ARCHIVED' then return false; end if;
 if p_command='CLAIM' then return r.assignee_profile_id is null and r.status<>'BLOCKED'; end if;
 if p.role='CONSULTANT' and (r.assignee_profile_id is distinct from p.id or r.status='BLOCKED') then return false; end if;
 if p_command in ('ASSIGN','UNASSIGN','ARCHIVE') then return p.role='ADMIN'; end if;
 if p_command='SET_STATUS' then return true; end if;
 if p_command='SET_PRIORITY' then return r.status<>'BLOCKED' and (p.role='ADMIN' or r.priority<>'URGENT'); end if;
 privacy:=public.admin_workflow_privacy(p_id);
 if coalesce((privacy->>'privacyRestricted')::boolean,true) then return false; end if;
 if p_command='ADD_NOTE' then return true; end if;
 if p_command in ('CREATE_OVERRIDE','REVERT_OVERRIDE','REVIEW_HYPOTHESIS','RESOLVE_FLAG','REOPEN_FLAG') then
  return d.status in ('COMPLETED','COMPLETED_NO_CONTACT','EXPIRED','ABANDONED','BLOCKED');
 end if;
 if p_command in ('RECALCULATE_QUALIFICATION','REGENERATE_BRIEFING') then
  return r.status<>'BLOCKED' and d.status in ('COMPLETED','COMPLETED_NO_CONTACT')
   and (p_command<>'REGENERATE_BRIEFING' or (d.current_assessment_id is not null and r.assessment_analysis_revision=r.analysis_revision));
 end if;
 return false;
end $$;

create function public.admin_workflow_status_allowed(p_actor uuid,p_id uuid,p_status text) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare p public.admin_profiles%rowtype; r public.diagnostic_review_states%rowtype; d public.diagnostics%rowtype; g jsonb; critical boolean;
begin
 if not public.admin_workflow_can(p_actor,p_id,'SET_STATUS') then return false; end if;
 select * into p from public.admin_profiles where user_id=p_actor;
 select * into r from public.diagnostic_review_states where diagnostic_id=p_id;
 select * into d from public.diagnostics where id=p_id;
 if not p_status=any(public.admin_workflow_transitions(r.status)) or p_status='ARCHIVED' then return false; end if;
 if p.role<>'ADMIN' and (p_status='BLOCKED' or r.status in ('BLOCKED','NOT_QUALIFIED','OUT_OF_SCOPE')) then return false; end if;
 g:=public.admin_workflow_privacy(p_id);
 critical:=d.status='BLOCKED' or exists(select 1 from public.diagnostic_flags where diagnostic_id=p_id and status='ACTIVE' and severity='S3');
 if p_status='NO_CONTACT_PERMISSION' then return not coalesce((g->>'contactAllowed')::boolean,false); end if;
 if p_status='UNDER_REVIEW' and (critical or (r.status='NO_CONTACT_PERMISSION' and not coalesce((g->>'contactAllowed')::boolean,false))) then return false; end if;
 if p_status='QUALIFIED' then
  return d.status in ('COMPLETED','COMPLETED_NO_CONTACT') and not critical and coalesce((g->>'contactAllowed')::boolean,false)
   and r.assessment_analysis_revision=r.analysis_revision
   and exists(select 1 from public.qualification_assessments a where a.id=d.current_assessment_id and a.diagnostic_id=d.id and a.is_current
    and a.final_score is not null and a.assessment_confidence<>'INSUFFICIENT');
 end if;
 return true;
end $$;

create function public.admin_workflow_summary(p_actor uuid,p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('diagnosticId',d.id,'status',r.status,'priority',r.priority,
 'assignee',case when a.id is not null then jsonb_build_object('profileId',a.id,'displayName',a.display_name,'isActive',a.is_active) end,
 'rowVersion',r.row_version,'diagnosticVersion',d.row_version,'analysisRevision',r.analysis_revision,
 'decisionStale',r.status in ('QUALIFIED','NOT_QUALIFIED','OUT_OF_SCOPE') and
 (r.decision_analysis_revision is distinct from r.analysis_revision or r.status='QUALIFIED' and
 (not (public.admin_workflow_privacy(d.id)->>'contactAllowed')::boolean or r.assessment_analysis_revision is distinct from r.analysis_revision
 or exists(select 1 from public.diagnostic_flags f where f.diagnostic_id=d.id and f.status='ACTIVE' and f.severity='S3'))),
 'qualificationStale',d.current_assessment_id is null or r.assessment_analysis_revision is distinct from r.analysis_revision,
 'briefingStale',d.current_briefing_id is null or r.briefing_analysis_revision is distinct from r.analysis_revision,
 'contactAllowed',(public.admin_workflow_privacy(d.id)->>'contactAllowed')::boolean,
 'privacyRestricted',(public.admin_workflow_privacy(d.id)->>'privacyRestricted')::boolean,'archivedAt',r.archived_at,
 'allowedStatuses',coalesce((select jsonb_agg(s) from unnest(public.admin_workflow_transitions(r.status)) s where public.admin_workflow_status_allowed(p_actor,d.id,s)),'[]'),
 'capabilities',(select jsonb_object_agg(cmd,public.admin_workflow_can(p_actor,d.id,cmd)) from unnest(array[
 'CLAIM','ASSIGN','UNASSIGN','SET_STATUS','SET_PRIORITY','ADD_NOTE','CREATE_OVERRIDE','REVERT_OVERRIDE','REVIEW_HYPOTHESIS','RESOLVE_FLAG','REOPEN_FLAG',
 'RECALCULATE_QUALIFICATION','REGENERATE_BRIEFING','ARCHIVE','REOPEN']) cmd))
 from public.diagnostics d join public.diagnostic_review_states r on r.diagnostic_id=d.id
 left join public.admin_profiles a on a.id=r.assignee_profile_id where d.id=p_id and d.archived_at is null;
$$;

create function public.admin_workflow_request_hash(p_request jsonb) returns text
language sql immutable set search_path='' as $$ select encode(extensions.digest(p_request::text,'sha256'),'hex') $$;
create function public.admin_workflow_receipt(p_actor uuid,p_request jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare receipt public.admin_audit_events%rowtype;
begin
 perform public.admin_workflow_profile(p_actor);
 select * into receipt from public.admin_audit_events where actor_user_id=p_actor and command_id=(p_request->>'clientRequestId')::uuid and succeeded;
 if not found then return null; end if;
 if receipt.diagnostic_id is distinct from (p_request->>'diagnosticId')::uuid or receipt.request_hash<>public.admin_workflow_request_hash(p_request) then
  raise exception using errcode='22023',message='IDEMPOTENCY_KEY_REUSED';
 end if;
 if not exists(select 1 from public.diagnostics where id=receipt.diagnostic_id and archived_at is null) then
  raise exception using errcode='P0002',message='NOT_FOUND';
 end if;
 -- Revalidate current authorization before returning a compact receipt.
 if (select role from public.admin_profiles where user_id=p_actor)='VIEWER' then
  raise exception using errcode='42501',message='ACCESS_DENIED';
 end if;
 if (select role from public.admin_profiles where user_id=p_actor)='CONSULTANT' and (
 receipt.entity_type in ('ASSIGN','UNASSIGN','ARCHIVE','REOPEN') or
 (receipt.entity_type='SET_PRIORITY' and (receipt."before"->>'priority'='URGENT' or receipt."after"->>'priority'='URGENT')) or
 (receipt.entity_type='SET_STATUS' and (receipt."before"->>'status' in ('BLOCKED','NOT_QUALIFIED','OUT_OF_SCOPE') or receipt."after"->>'status'='BLOCKED')) or
 (receipt.entity_type in ('RESOLVE_FLAG','REOPEN_FLAG') and exists(select 1 from public.diagnostic_flags f where f.id=receipt.entity_id and (f.severity='S3' or f.category in ('SECURITY','CONSENT'))))
 ) then raise exception using errcode='42501',message='ACCESS_DENIED'; end if;
 if (select role from public.admin_profiles where user_id=p_actor)='CONSULTANT' and not exists(select 1 from public.diagnostic_review_states r join public.admin_profiles p on p.id=r.assignee_profile_id where r.diagnostic_id=receipt.diagnostic_id and p.user_id=p_actor and p.is_active) then raise exception using errcode='42501',message='ACCESS_DENIED'; end if;
 return (receipt.metadata->'receipt') || jsonb_build_object('replayed',true,'workflow',public.admin_workflow_summary(p_actor,receipt.diagnostic_id));
end $$;

create function public.admin_prepare_workflow_command(p_actor uuid,p_request jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare p public.admin_profiles%rowtype; d public.diagnostics%rowtype; r public.diagnostic_review_states%rowtype; source jsonb; receipt jsonb;
begin
 p:=public.admin_workflow_profile(p_actor);
 receipt:=public.admin_workflow_receipt(p_actor,p_request);
 if receipt is not null then return jsonb_build_object('receipt',receipt); end if;
 select * into d from public.diagnostics where id=(p_request->>'diagnosticId')::uuid and archived_at is null for update;
 if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 select * into r from public.diagnostic_review_states where diagnostic_id=d.id for update;
 if r.row_version<>(p_request->>'expectedReviewVersion')::bigint or d.row_version<>(p_request->>'expectedDiagnosticVersion')::bigint then
  raise exception using errcode='40001',message='STATE_CONFLICT';
 end if;
 if not public.admin_workflow_can(p_actor,d.id,p_request->>'command') then raise exception using errcode='42501',message='ACCESS_DENIED'; end if;
 source:=public.admin_workflow_source(d.id);
 return jsonb_build_object('source',source,'fingerprint',public.admin_workflow_request_hash(source));
end $$;

create function public.admin_workflow_support(p_id uuid,p_ids uuid[]) returns void
language plpgsql set search_path='' as $$
begin
 if cardinality(p_ids)>20 or exists(select 1 from unnest(p_ids) x where not exists(
  select 1 from public.evidence_items e where e.id=x and e.diagnostic_id=p_id and not e.redacted
  and e.source_type not in ('AI_INFERENCE','NOT_CONFIRMED') and e.confidence>=0.6)) then
  raise exception using errcode='22023',message='VALIDATION_ERROR';
 end if;
end $$;

create or replace function public.record_flag_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind text;
begin
 if tg_op='INSERT' then kind:='TRIGGERED';
 elsif old.status is distinct from new.status then kind:=case when new.status='RESOLVED' then 'RESOLVED' else 'REOPENED' end;
 elsif (old.severity,old.reason,old.scheduling_effect) is distinct from (new.severity,new.reason,new.scheduling_effect) then kind:='UPDATED';
 else return new; end if;
 insert into public.diagnostic_flag_events(diagnostic_id,flag_id,event_type,previous_status,new_status,reason,actor_user_id,profile_id,command_id,evidence_ids,context)
 values(new.diagnostic_id,new.id,kind,case when tg_op='UPDATE' then old.status end,new.status,
 coalesce(nullif(current_setting('app.admin_action_reason',true),''),new.reason),
 nullif(current_setting('app.admin_actor',true),'')::uuid,nullif(current_setting('app.admin_profile',true),'')::uuid,
 nullif(current_setting('app.admin_command_id',true),'')::uuid,
 coalesce(nullif(current_setting('app.admin_evidence_ids',true),'')::uuid[],'{}'),
 jsonb_build_object('source',new.source,'severity',new.severity));
 if coalesce(current_setting('app.admin_command_id',true),'')='' then
  update public.diagnostic_review_states set analysis_revision=analysis_revision+1 where diagnostic_id=new.diagnostic_id;
 end if;
 return new;
end $$;

create function public.admin_apply_diagnostic_command(p_actor uuid,p_request jsonb,p_artifact jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' set statement_timeout='8s' as $$
declare
 p public.admin_profiles%rowtype; target public.admin_profiles%rowtype; d public.diagnostics%rowtype; r public.diagnostic_review_states%rowtype;
 o public.diagnostic_field_overrides%rowtype; f public.diagnostic_flags%rowtype;
 receipt jsonb; payload jsonb:=p_request->'payload'; cmd text:=p_request->>'command';
 cid uuid:=(p_request->>'clientRequestId')::uuid; did uuid:=(p_request->>'diagnosticId')::uuid;
 hash text:=public.admin_workflow_request_hash(p_request); idem_key text;
 reason text:=nullif(trim(payload->>'reason'),''); event_name text; entity uuid; entity_version integer;
 result jsonb; before_value jsonb; after_value jsonb; ids uuid[]; status_target text;
 source jsonb; source_hash text; source_text text; path text; head_id uuid; ver integer; snapshot_id uuid;
 item jsonb; criterion jsonb; dimension_id uuid; criterion_id uuid; evidence_id uuid; active_id uuid;
 invalidations jsonb; analysis_change boolean:=false;
begin
 p:=public.admin_workflow_profile(p_actor);
 if p.role='VIEWER' then raise exception using errcode='42501',message='ACCESS_DENIED'; end if;
 receipt:=public.admin_workflow_receipt(p_actor,p_request); if receipt is not null then return receipt; end if;
 idem_key:='admin:'||p_actor||':'||did||':'||cid;
 perform public.begin_idempotency(p_actor,did,idem_key,'ADMIN_'||cmd,hash);
 -- A concurrent command may have committed while begin_idempotency waited for its receipt lock.
 receipt:=public.admin_workflow_receipt(p_actor,p_request); if receipt is not null then return receipt; end if;
 select * into d from public.diagnostics where id=did and archived_at is null for update;
 if not found then raise exception using errcode='P0002',message='NOT_FOUND'; end if;
 select * into r from public.diagnostic_review_states where diagnostic_id=did for update;
 if r.row_version<>(p_request->>'expectedReviewVersion')::bigint or d.row_version<>(p_request->>'expectedDiagnosticVersion')::bigint then
  raise exception using errcode='40001',message='STATE_CONFLICT';
 end if;
 if not public.admin_workflow_can(p_actor,did,cmd) then raise exception using errcode='42501',message='ACCESS_DENIED'; end if;
 if reason is not null and char_length(reason) not between 10 and 1000 then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
 ids:=coalesce(array(select jsonb_array_elements_text(payload->'evidenceIds')::uuid),'{}');
 perform public.admin_workflow_support(did,ids);
 perform set_config('app.admin_target_review_version',(r.row_version+1)::text,true);
 perform set_config('app.admin_diagnostic_id',did::text,true);
 perform set_config('app.admin_actor',p_actor::text,true);
 perform set_config('app.admin_profile',p.id::text,true);
 perform set_config('app.admin_command_id',cid::text,true);
 perform set_config('app.admin_action_reason',coalesce(reason,''),true);
 perform set_config('app.admin_evidence_ids',ids::text,true);
 before_value:=jsonb_build_object('status',r.status,'priority',r.priority,'assigneeProfileId',r.assignee_profile_id,'rowVersion',r.row_version);
 if cmd in ('CREATE_OVERRIDE','REVERT_OVERRIDE','RESOLVE_FLAG','RECALCULATE_QUALIFICATION','REGENERATE_BRIEFING') then
  source:=public.admin_workflow_source(did);
  if p_artifact is null or p_artifact->>'fingerprint' is distinct from public.admin_workflow_request_hash(source) then
   raise exception using errcode='40001',message='STALE_STATE';
  end if;
 end if;
 case cmd
 when 'CLAIM','ASSIGN' then
  if cmd='CLAIM' then target:=p;
  else
   select * into target from public.admin_profiles where id=(payload->>'profileId')::uuid for share;
   if not found or not target.is_active or target.role not in ('ADMIN','CONSULTANT') then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  end if;
  if target.id=r.assignee_profile_id then raise exception using errcode='55000',message='ACTION_NOT_APPLICABLE'; end if;
  if r.assignee_profile_id is not null and reason is null then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  event_name:=case when r.assignee_profile_id is null then 'DIAGNOSTIC_ASSIGNED' else 'DIAGNOSTIC_REASSIGNED' end;
  update public.diagnostic_review_states set assignee_profile_id=target.id,assigned_at=now(),assigned_by=p_actor where diagnostic_id=did;
 when 'UNASSIGN' then
  if r.assignee_profile_id is null then raise exception using errcode='55000',message='ACTION_NOT_APPLICABLE'; end if;
  if reason is null then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  update public.diagnostic_review_states set assignee_profile_id=null,assigned_at=null,assigned_by=null where diagnostic_id=did;
  event_name:='DIAGNOSTIC_UNASSIGNED';
 when 'SET_STATUS','ARCHIVE','REOPEN' then
  status_target:=payload->>'status';
  if cmd='ARCHIVE' then status_target:='ARCHIVED'; end if;
  if cmd='REOPEN' then
   status_target:=case when d.status='BLOCKED' or exists(select 1 from public.diagnostic_flags where diagnostic_id=did and status='ACTIVE' and severity='S3') then 'BLOCKED'
    when not (public.admin_workflow_privacy(did)->>'contactAllowed')::boolean then 'NO_CONTACT_PERMISSION' else 'UNDER_REVIEW' end;
  elsif cmd='SET_STATUS' and not public.admin_workflow_status_allowed(p_actor,did,status_target) then
   raise exception using errcode='55000',message='ACTION_NOT_APPLICABLE';
  end if;
  if status_target=r.status then raise exception using errcode='55000',message='ACTION_NOT_APPLICABLE'; end if;
  if (cmd in ('ARCHIVE','REOPEN') or status_target in ('NOT_QUALIFIED','OUT_OF_SCOPE','BLOCKED') or
   r.status in ('QUALIFIED','NOT_QUALIFIED','OUT_OF_SCOPE','NO_CONTACT_PERMISSION','BLOCKED')) and reason is null then
   raise exception using errcode='22023',message='VALIDATION_ERROR';
  end if;
  update public.diagnostic_review_states set status=status_target,archived_at=case when status_target='ARCHIVED' then now() end,
   decision_analysis_revision=case when status_target in ('QUALIFIED','NOT_QUALIFIED','OUT_OF_SCOPE') then analysis_revision end where diagnostic_id=did;
  event_name:=case cmd when 'ARCHIVE' then 'DIAGNOSTIC_ARCHIVED' when 'REOPEN' then 'DIAGNOSTIC_REOPENED' else 'REVIEW_STATUS_CHANGED' end;
 when 'SET_PRIORITY' then
  if payload->>'priority'=r.priority then raise exception using errcode='55000',message='ACTION_NOT_APPLICABLE'; end if;
  if (r.priority='URGENT' or payload->>'priority'='URGENT') and (p.role<>'ADMIN' or reason is null) then
   raise exception using errcode='42501',message='ACCESS_DENIED';
  end if;
  update public.diagnostic_review_states set priority=payload->>'priority' where diagnostic_id=did;
  event_name:='ADMIN_PRIORITY_CHANGED';
 when 'ADD_NOTE' then
  insert into public.diagnostic_internal_notes(diagnostic_id,category,body,author_user_id,author_profile_id,command_id)
   values(did,payload->>'category',trim(payload->>'body'),p_actor,p.id,cid) returning id into entity;
  event_name:='INTERNAL_NOTE_CREATED';
 when 'CREATE_OVERRIDE','REVERT_OVERRIDE' then
  if reason is null then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  path:=payload->>'fieldPath';
  if cmd='REVERT_OVERRIDE' then
   select * into o from public.diagnostic_field_overrides where id=(payload->>'overrideId')::uuid and diagnostic_id=did;
   if not found or o.operation<>'SET' then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
   path:=o.field_path;
  end if;
  if not public.admin_override_value_valid(path,case when cmd='CREATE_OVERRIDE' then payload->'value' else 'null'::jsonb end,cmd='REVERT_OVERRIDE') then
   raise exception using errcode='22023',message='VALIDATION_ERROR';
  end if;
  select id,version+1 into head_id,ver from public.diagnostic_field_overrides where diagnostic_id=did and field_path=path order by version desc limit 1;
  if cmd='REVERT_OVERRIDE' and head_id<>o.id then raise exception using errcode='40001',message='STALE_STATE'; end if;
  if payload->>'sourceAnswerId' is not null and not exists(select 1 from public.interview_answers where id=(payload->>'sourceAnswerId')::uuid and diagnostic_id=did and is_current and not redacted) then
   raise exception using errcode='22023',message='VALIDATION_ERROR';
  end if;
  insert into public.diagnostic_field_overrides(diagnostic_id,field_path,operation,version,previous_effective_value,new_value,previous_override_id,reverted_override_id,
   reason,source_answer_id,verification_status,evidence_ids,evidence_note,author_user_id,author_profile_id,command_id,base_structured_value)
  values(did,path,case when cmd='CREATE_OVERRIDE' then 'SET' else 'REVERT' end,coalesce(ver,1),p_artifact->'previousEffectiveValue',
   case when cmd='CREATE_OVERRIDE' then payload->'value' end,head_id,case when cmd='REVERT_OVERRIDE' then o.id end,
   reason,case when cmd='CREATE_OVERRIDE' then (payload->>'sourceAnswerId')::uuid else o.source_answer_id end,
   coalesce(payload->>'verificationStatus','UNVERIFIED'),ids,nullif(payload->>'evidenceNote',''),p_actor,p.id,cid,p_artifact->'baseValue') returning id,version into entity,entity_version;
  if cmd='CREATE_OVERRIDE' and payload->>'verificationStatus'='VERIFIED' then
   insert into public.evidence_items(diagnostic_id,target_path,source_type,text,confidence,confirmed)
    values(did,path,'SYSTEM_DERIVED',left(coalesce(nullif(payload->>'evidenceNote',''),'Verificação humana documentada no override.'),500),1,true) returning id into evidence_id;
   insert into public.evidence_sources(evidence_item_id,source_locator) values(evidence_id,'admin_override:'||entity);
  end if;
  analysis_change:=true;event_name:=case when cmd='CREATE_OVERRIDE' then 'FIELD_OVERRIDE_CREATED' else 'FIELD_OVERRIDE_REVERTED' end;
 when 'REVIEW_HYPOTHESIS' then
  if reason is null then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  if payload->>'sourceKind'='BRIEFING' then
   select b.initial_hypotheses->>((payload->>'hypothesisIndex')::integer) into source_text from public.commercial_briefings b
    where b.id=(payload->>'sourceId')::uuid and b.diagnostic_id=did;
   select coalesce(max(version),0)+1 into ver from public.diagnostic_hypothesis_reviews
    where briefing_id=(payload->>'sourceId')::uuid and hypothesis_index=(payload->>'hypothesisIndex')::integer;
  else
   select e.text into source_text from public.evidence_items e where e.id=(payload->>'sourceId')::uuid and e.diagnostic_id=did
    and not e.redacted and e.source_type in ('AI_INFERENCE','NOT_CONFIRMED');
   select coalesce(max(version),0)+1 into ver from public.diagnostic_hypothesis_reviews where evidence_item_id=(payload->>'sourceId')::uuid;
  end if;
  if source_text is null or encode(extensions.digest(source_text,'sha256'),'hex')<>payload->>'sourceHash' then
   raise exception using errcode='40001',message='STALE_STATE';
  end if;
  insert into public.diagnostic_hypothesis_reviews(diagnostic_id,source_kind,briefing_id,evidence_item_id,hypothesis_index,source_hash,version,status,reason,
   supporting_evidence_ids,evidence_note,author_user_id,author_profile_id,command_id)
  values(did,payload->>'sourceKind',case when payload->>'sourceKind'='BRIEFING' then (payload->>'sourceId')::uuid end,
   case when payload->>'sourceKind'='EVIDENCE' then (payload->>'sourceId')::uuid end,(payload->>'hypothesisIndex')::integer,payload->>'sourceHash',ver,payload->>'status',
   reason,ids,nullif(payload->>'evidenceNote',''),p_actor,p.id,cid) returning id,version into entity,entity_version;
  -- Narrative revision does not make unchanged scoring evidence stale.
  update public.diagnostic_review_states set analysis_revision=analysis_revision+1,
   assessment_analysis_revision=case when assessment_analysis_revision=analysis_revision then analysis_revision+1 else assessment_analysis_revision end
   where diagnostic_id=did;
  event_name:=case payload->>'status' when 'CONFIRMED' then 'HYPOTHESIS_CONFIRMED' else 'HYPOTHESIS_REJECTED' end;
 when 'RESOLVE_FLAG','REOPEN_FLAG' then
  select * into f from public.diagnostic_flags where id=(payload->>'flagId')::uuid and diagnostic_id=did for update;
  if not found then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  if (f.severity='S3' or f.category in ('SECURITY','CONSENT')) and p.role<>'ADMIN' then raise exception using errcode='42501',message='ACCESS_DENIED'; end if;
  if reason is null or (cardinality(ids)=0 and coalesce(char_length(trim(payload->>'evidenceNote')),0)<10) then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
  if (cmd='RESOLVE_FLAG' and f.status<>'ACTIVE') or (cmd='REOPEN_FLAG' and f.status<>'RESOLVED') then raise exception using errcode='55000',message='ACTION_NOT_APPLICABLE'; end if;
  if cmd='RESOLVE_FLAG' and coalesce((p_artifact->>'flagResolutionAllowed')::boolean,false)=false then raise exception using errcode='55000',message='ACTION_NOT_APPLICABLE'; end if;
  if cmd='RESOLVE_FLAG' and f.code='COMMERCIAL_CONTACT_NOT_ACCEPTED' and not (public.admin_workflow_privacy(did)->>'contactAllowed')::boolean then raise exception using errcode='42501',message='ACCESS_DENIED'; end if;
  if cmd='REOPEN_FLAG' and exists(select 1 from public.diagnostic_flags where diagnostic_id=did and code=f.code and status='ACTIVE') then raise exception using errcode='40001',message='STATE_CONFLICT'; end if;
  update public.diagnostic_flags set status=case when cmd='RESOLVE_FLAG' then 'RESOLVED'::public.flag_status else 'ACTIVE'::public.flag_status end,
   resolved_at=case when cmd='RESOLVE_FLAG' then now() end where id=f.id;
  entity:=f.id;analysis_change:=true; event_name:=case cmd when 'RESOLVE_FLAG' then 'FLAG_RESOLVED' else 'FLAG_REOPENED' end;
 when 'RECALCULATE_QUALIFICATION','REGENERATE_BRIEFING' then
  select coalesce(max(revision),0)+1 into ver from public.diagnostic_snapshots
   where diagnostic_id=did and snapshot_type=case when cmd='RECALCULATE_QUALIFICATION' then 'ADMIN_QUALIFICATION_INPUT' else 'ADMIN_BRIEFING_INPUT' end;
  insert into public.diagnostic_snapshots(diagnostic_id,snapshot_type,schema_version,revision,payload,payload_hash)
  values(did,case when cmd='RECALCULATE_QUALIFICATION' then 'ADMIN_QUALIFICATION_INPUT' else 'ADMIN_BRIEFING_INPUT' end,
   'adm04.1',ver,p_artifact->'snapshot',public.admin_workflow_request_hash(p_artifact->'snapshot')) returning id into snapshot_id;
  if cmd='RECALCULATE_QUALIFICATION' then
   select coalesce(max(version),0)+1 into entity_version from public.qualification_assessments where diagnostic_id=did;
   update public.qualification_assessments set is_current=false where diagnostic_id=did and is_current;
   item:=p_artifact->'assessment';
   insert into public.qualification_assessments(diagnostic_id,version,earned_points,assessed_weight,normalized_score,final_score,score_cap_applied,classification,
    assessment_confidence,recommended_route,automatic_scheduling_eligible,input_snapshot_id)
   values(did,entity_version,(item->>'earnedPoints')::numeric,(item->>'assessedWeight')::numeric,(item->>'normalizedScore')::numeric,
    (item->>'finalScore')::integer,(item->>'scoreCapApplied')::integer,(item->>'classification')::public.qualification_classification,
    (item->>'assessmentConfidence')::public.assessment_confidence,(p_artifact->>'route')::public.recommended_route,false,snapshot_id) returning id into entity;
   for item in select value from jsonb_array_elements(p_artifact->'assessment'->'criteria') loop
    insert into public.qualification_dimension_results(assessment_id,dimension_code,earned_points,assessed_weight,max_weight)
     values(entity,item->>'dimension',0,0,1) on conflict(assessment_id,dimension_code) do nothing;
    select id into dimension_id from public.qualification_dimension_results where assessment_id=entity and dimension_code=item->>'dimension';
    insert into public.qualification_criterion_results(assessment_id,dimension_result_id,criterion_code,earned_points,assessed_weight,max_weight,rationale)
     values(entity,dimension_id,item->>'code',(item->>'earnedPoints')::numeric,
      case when (item->>'assessed')::boolean then (item->>'maximumPoints')::numeric else 0 end,(item->>'maximumPoints')::numeric,'Deterministic qualification matrix '||(p_artifact->'assessment'->>'version')) returning id into criterion_id;
    for evidence_id in select jsonb_array_elements_text(p_artifact->'criterionEvidence'->(item->>'code'))::uuid loop
     if not exists(select 1 from public.evidence_items where id=evidence_id and diagnostic_id=did and not redacted) then raise exception using errcode='22023',message='VALIDATION_ERROR'; end if;
     insert into public.criterion_evidence_links(criterion_result_id,evidence_item_id) values(criterion_id,evidence_id);
    end loop;
   end loop;
   update public.qualification_dimension_results q set
    earned_points=(select sum(earned_points) from public.qualification_criterion_results where dimension_result_id=q.id),
    assessed_weight=(select sum(assessed_weight) from public.qualification_criterion_results where dimension_result_id=q.id),
    max_weight=(select sum(max_weight) from public.qualification_criterion_results where dimension_result_id=q.id)
    where q.assessment_id=entity;
   for item in select value from jsonb_array_elements(p_artifact->'flags') loop
   select id into active_id from public.diagnostic_flags where diagnostic_id=did and code=item->>'code' and status='ACTIVE';
   if active_id is null or exists(select 1 from public.diagnostic_flags df where df.id=active_id and (df.severity::text,df.reason,df.scheduling_effect::text) is distinct from (item->>'severity',item->>'reason',item->>'schedulingEffect')) then analysis_change:=true; end if;
    if active_id is not null then
     update public.diagnostic_flags df set assessment_id=entity,severity=(item->>'severity')::public.flag_severity,
      reason=item->>'reason',scheduling_effect=(item->>'schedulingEffect')::public.scheduling_effect where df.id=active_id and df.source<>'MANUAL';
    else
     insert into public.diagnostic_flags(diagnostic_id,assessment_id,code,display_name,category,severity,source,reason,scheduling_effect)
      values(did,entity,item->>'code',item->>'displayName',item->>'category',(item->>'severity')::public.flag_severity,'RULE',item->>'reason',(item->>'schedulingEffect')::public.scheduling_effect);
    end if;
   end loop;
   update public.diagnostics set current_assessment_id=entity,recommended_route=case
    when exists(select 1 from public.diagnostic_flags where diagnostic_id=did and status='ACTIVE' and severity='S3') then 'BLOCKED'::public.recommended_route
    when not (public.admin_workflow_privacy(did)->>'contactAllowed')::boolean then 'NO_CONTACT'::public.recommended_route
    else (p_artifact->>'route')::public.recommended_route end,automatic_scheduling_eligible=false where id=did;
   update public.diagnostic_review_states set assessment_analysis_revision=analysis_revision+case when analysis_change then 1 else 0 end,briefing_analysis_revision=null where diagnostic_id=did;
   event_name:='QUALIFICATION_RECALCULATED';
  else
   select coalesce(max(version),0)+1 into entity_version from public.commercial_briefings where diagnostic_id=did;
   item:=p_artifact->'briefing';
   update public.commercial_briefings set status='SUPERSEDED' where diagnostic_id=did and status='FINAL';
   insert into public.commercial_briefings(diagnostic_id,version,status,executive_summary,challenge_summary,current_process_summary,impact_summary,buying_context_summary,technical_context_summary,
    initial_hypotheses,missing_information,recommended_questions,recommended_participants,recommended_offer,input_snapshot_id,generation_mode,fallback_used)
    values(did,entity_version,'FINAL',item->>'executiveSummary',item->>'challengeSummary',item->>'currentProcessSummary',item->>'impactSummary',item->>'buyingContextSummary',
     item->>'technicalContextSummary',item->'initialHypotheses',item->'missingInformation',item->'recommendedQuestions',item->'recommendedParticipants',
     (item->>'recommendedOffer')::public.recommended_offer,snapshot_id,'DETERMINISTIC',false) returning id into entity;
   update public.commercial_briefings set superseded_by_id=entity where id=d.current_briefing_id and diagnostic_id=did;
   update public.diagnostics set current_briefing_id=entity where id=did;
   update public.diagnostic_review_states set briefing_analysis_revision=analysis_revision where diagnostic_id=did;
   event_name:='BRIEFING_REGENERATED';
  end if;
 else raise exception using errcode='22023',message='VALIDATION_ERROR';
 end case;
 -- Several branches touched state; normalize to exactly one public review version per successful command.
 update public.diagnostic_review_states set updated_by=p_actor,analysis_revision=analysis_revision+case when analysis_change then 1 else 0 end where diagnostic_id=did;
 invalidations:=case cmd
 when 'ADD_NOTE' then '["NOTES","AUDIT"]'::jsonb
 when 'CREATE_OVERRIDE' then '["INTERVIEW","OVERVIEW","QUALIFICATION","BRIEFING","AUDIT"]'::jsonb
 when 'REVERT_OVERRIDE' then '["INTERVIEW","OVERVIEW","QUALIFICATION","BRIEFING","AUDIT"]'::jsonb
 when 'REVIEW_HYPOTHESIS' then '["BRIEFING","AUDIT"]'::jsonb
 when 'RESOLVE_FLAG' then '["FLAGS","OVERVIEW","QUALIFICATION","BRIEFING","AUDIT"]'::jsonb
 when 'REOPEN_FLAG' then '["FLAGS","OVERVIEW","QUALIFICATION","BRIEFING","AUDIT"]'::jsonb
 when 'RECALCULATE_QUALIFICATION' then '["QUALIFICATION","FLAGS","OVERVIEW","BRIEFING","AUDIT"]'::jsonb
 when 'REGENERATE_BRIEFING' then '["BRIEFING","OVERVIEW","AUDIT"]'::jsonb else '["OVERVIEW","AUDIT"]'::jsonb end;
 result:=jsonb_build_object('commandId',cid,'replayed',false,'workflow',public.admin_workflow_summary(p_actor,did),'entityId',entity,'entityVersion',entity_version,'invalidatedSections',invalidations);
 after_value:=(result->'workflow')-'capabilities'-'allowedStatuses'-'assignee';
 insert into public.admin_audit_events(actor_user_id,profile_id,event_type,succeeded,diagnostic_id,command_id,request_hash,entity_type,entity_id,"before","after",reason,metadata)
 values(p_actor,p.id,event_name,true,did,cid,hash,cmd,entity,before_value,after_value,reason,
  jsonb_build_object('receipt',result-'workflow','category',case when cmd='ADD_NOTE' then payload->>'category' end));
 perform public.finish_idempotency(p_actor,idem_key,result-'workflow');
 perform set_config('app.admin_command_id','',true); perform set_config('app.admin_actor','',true); perform set_config('app.admin_profile','',true);
 perform set_config('app.admin_action_reason','',true); perform set_config('app.admin_evidence_ids','',true); perform set_config('app.admin_target_review_version','',true);
 return result;
end $$;

-- Only these RPCs are exposed to the trusted Edge client. Helpers are never browser-callable.
do $grants$ declare f record; begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and (p.proname like 'admin_workflow_%' or p.proname in ('admin_override_value_valid','admin_prepare_workflow_command','admin_apply_diagnostic_command')) loop
 execute format('revoke all on function %s from public,anon,authenticated',f.sig);
 execute format('grant execute on function %s to service_role',f.sig);
 end loop; end $grants$;

