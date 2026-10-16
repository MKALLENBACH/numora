-- ADM 04: internal workflow. Public diagnostic status and visitor answers remain unchanged.
create table public.diagnostic_review_states (
 diagnostic_id uuid primary key references public.diagnostics(id) on delete cascade,
 status text not null default 'NEW' check (status in ('NEW','UNDER_REVIEW','NEEDS_INFORMATION','QUALIFIED','NOT_QUALIFIED','OUT_OF_SCOPE','NO_CONTACT_PERMISSION','BLOCKED','ARCHIVED')),
 priority text not null default 'NORMAL' check (priority in ('LOW','NORMAL','HIGH','URGENT')),
 assignee_profile_id uuid references public.admin_profiles(id) on delete set null,
 assigned_at timestamptz, assigned_by uuid,
 row_version bigint not null default 1 check (row_version > 0),
 analysis_revision bigint not null default 1 check (analysis_revision > 0),
 assessment_analysis_revision bigint, briefing_analysis_revision bigint, decision_analysis_revision bigint,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by uuid,
 archived_at timestamptz,
 check ((status = 'ARCHIVED') = (archived_at is not null)),
 check ((assignee_profile_id is null and assigned_at is null and assigned_by is null)
     or (assignee_profile_id is not null and assigned_at is not null and assigned_by is not null))
);
create index review_states_status_idx on public.diagnostic_review_states(status,updated_at desc);
create index review_states_assignee_idx on public.diagnostic_review_states(assignee_profile_id,status,updated_at desc);
create index review_states_priority_idx on public.diagnostic_review_states(priority,updated_at desc);

create table public.diagnostic_internal_notes (
 id uuid primary key default gen_random_uuid(),
 diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
 category text not null check (category in ('GENERAL','COMMERCIAL','TECHNICAL','RISK','FOLLOW_UP','DECISION')),
 body text not null check (char_length(trim(body)) between 1 and 4000),
 author_user_id uuid not null, author_profile_id uuid not null,
 created_at timestamptz not null default now(), command_id uuid not null,
 unique(author_user_id,command_id)
);
create index internal_notes_history_idx on public.diagnostic_internal_notes(diagnostic_id,created_at desc,id desc);

create table public.diagnostic_field_overrides (
 id uuid primary key default gen_random_uuid(),
 diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
 field_path text not null check (char_length(field_path) between 3 and 300),
 operation text not null check (operation in ('SET','REVERT')),
 version integer not null check(version > 0),
 previous_effective_value jsonb, new_value jsonb, base_structured_value jsonb,
 previous_override_id uuid references public.diagnostic_field_overrides(id) deferrable initially deferred,
 reverted_override_id uuid references public.diagnostic_field_overrides(id) deferrable initially deferred,
 reason text not null check(char_length(trim(reason)) between 10 and 1000),
 source_answer_id uuid references public.interview_answers(id) deferrable initially deferred,
 verification_status text not null default 'UNVERIFIED' check(verification_status in ('VERIFIED','UNVERIFIED')),
 evidence_ids uuid[] not null default '{}', evidence_note text check(char_length(evidence_note)<=500),
 author_user_id uuid not null, author_profile_id uuid not null,
 created_at timestamptz not null default now(), command_id uuid not null,
 unique(diagnostic_id,field_path,version), unique(author_user_id,command_id),
 check ((operation='SET' and reverted_override_id is null) or (operation='REVERT' and reverted_override_id is not null)),
 check (verification_status<>'VERIFIED' or cardinality(evidence_ids)>0 or coalesce(char_length(trim(evidence_note)),0)>=10)
);
create index field_overrides_history_idx on public.diagnostic_field_overrides(diagnostic_id,field_path,version desc);

create table public.diagnostic_hypothesis_reviews (
 id uuid primary key default gen_random_uuid(),
 diagnostic_id uuid not null references public.diagnostics(id) on delete cascade,
 source_kind text not null check(source_kind in ('BRIEFING','EVIDENCE')),
 briefing_id uuid references public.commercial_briefings(id) deferrable initially deferred,
 evidence_item_id uuid references public.evidence_items(id) deferrable initially deferred,
 hypothesis_index integer check(hypothesis_index>=0), source_hash text not null check(source_hash ~ '^[a-f0-9]{64}$'),
 version integer not null check(version>0), status text not null check(status in ('CONFIRMED','REJECTED')),
 reason text not null check(char_length(trim(reason)) between 10 and 1000),
 supporting_evidence_ids uuid[] not null default '{}', evidence_note text check(char_length(evidence_note)<=500),
 author_user_id uuid not null, author_profile_id uuid not null,
 created_at timestamptz not null default now(), command_id uuid not null,
 check ((source_kind='BRIEFING' and briefing_id is not null and hypothesis_index is not null and evidence_item_id is null)
     or (source_kind='EVIDENCE' and evidence_item_id is not null and briefing_id is null and hypothesis_index is null)),
 check(status<>'CONFIRMED' or cardinality(supporting_evidence_ids)>0 or coalesce(char_length(trim(evidence_note)),0)>=10),
 unique(author_user_id,command_id)
);
create unique index hypothesis_briefing_versions_idx on public.diagnostic_hypothesis_reviews(briefing_id,hypothesis_index,version) where source_kind='BRIEFING';
create unique index hypothesis_evidence_versions_idx on public.diagnostic_hypothesis_reviews(evidence_item_id,version) where source_kind='EVIDENCE';
create index hypothesis_history_idx on public.diagnostic_hypothesis_reviews(diagnostic_id,created_at desc,id desc);

alter table public.admin_audit_events
 add column diagnostic_id uuid,
 add column command_id uuid,
 add column request_hash text check(request_hash is null or request_hash ~ '^[a-f0-9]{64}$'),
 add column entity_type text, add column entity_id uuid,
 add column "before" jsonb, add column "after" jsonb,
 add column reason text check(reason is null or char_length(reason)<=1000),
 add column metadata jsonb not null default '{}'::jsonb check(jsonb_typeof(metadata)='object');
alter table public.admin_audit_events drop constraint admin_audit_events_event_type_check;
alter table public.admin_audit_events add constraint admin_audit_events_event_type_check check(event_type in (
 'ADMIN_LOGIN','ADMIN_LOGOUT','ADMIN_ACCESS_DENIED','PASSWORD_RECOVERY_REQUESTED',
 'REVIEW_STATE_INITIALIZED','DIAGNOSTIC_ASSIGNED','DIAGNOSTIC_REASSIGNED','DIAGNOSTIC_UNASSIGNED',
 'REVIEW_STATUS_CHANGED','ADMIN_PRIORITY_CHANGED','INTERNAL_NOTE_CREATED',
 'FIELD_OVERRIDE_CREATED','FIELD_OVERRIDE_REVERTED','HYPOTHESIS_CONFIRMED','HYPOTHESIS_REJECTED',
 'FLAG_RESOLVED','FLAG_REOPENED','QUALIFICATION_RECALCULATED','BRIEFING_REGENERATED',
 'DIAGNOSTIC_ARCHIVED','DIAGNOSTIC_REOPENED'
));
create unique index admin_command_receipt_idx on public.admin_audit_events(actor_user_id,command_id)
 where succeeded and command_id is not null;
create index admin_audit_diagnostic_idx on public.admin_audit_events(diagnostic_id,created_at desc,id desc);

alter table public.diagnostic_flag_events
 add column actor_user_id uuid, add column profile_id uuid, add column command_id uuid,
 add column evidence_ids uuid[] not null default '{}',
 add column context jsonb not null default '{}'::jsonb;
alter table public.diagnostic_flag_events drop constraint diagnostic_flag_events_event_type_check;
alter table public.diagnostic_flag_events add constraint diagnostic_flag_events_event_type_check
 check(event_type in ('TRIGGERED','UPDATED','RESOLVED','REOPENED'));
alter table public.qualification_assessments add column input_snapshot_id uuid references public.diagnostic_snapshots(id) deferrable initially deferred;
alter table public.commercial_briefings
 add column input_snapshot_id uuid references public.diagnostic_snapshots(id) deferrable initially deferred,
 add column generation_mode text check(generation_mode in ('DETERMINISTIC','EXTERNAL')),
 add column fallback_used boolean;
-- Preserve bodies; only fix legacy current markers, using the existing canonical pointer.
update public.commercial_briefings b set status='SUPERSEDED', superseded_by_id=d.current_briefing_id
 from public.diagnostics d where b.diagnostic_id=d.id and b.status='FINAL'
 and d.current_briefing_id is not null and b.id<>d.current_briefing_id;
create unique index one_final_briefing_per_diagnostic on public.commercial_briefings(diagnostic_id) where status='FINAL';
create unique index admin_snapshot_revision_idx on public.diagnostic_snapshots(diagnostic_id,snapshot_type,revision)
 where snapshot_type in ('ADMIN_QUALIFICATION_INPUT','ADMIN_BRIEFING_INPUT');

-- Preserve evidence integrity while permitting diagnostic-wide transactional retention.
-- RESTRICT fires before the other diagnostic cascades can remove criterion links.
alter table public.criterion_evidence_links
 drop constraint criterion_evidence_links_evidence_item_id_fkey,
 add constraint criterion_evidence_links_evidence_item_id_fkey
 foreign key(evidence_item_id) references public.evidence_items(id)
 on delete no action deferrable initially deferred;

create function public.admin_initialize_review_state() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.diagnostic_review_states(diagnostic_id,assessment_analysis_revision,briefing_analysis_revision)
 values(new.id,case when new.current_assessment_id is not null then 1 end,case when new.current_briefing_id is not null then 1 end)
 on conflict do nothing;
 if found then
  insert into public.admin_audit_events(diagnostic_id,event_type,succeeded,metadata)
  values(new.id,'REVIEW_STATE_INITIALIZED',true,'{"actorType":"SYSTEM"}');
 end if;
 return new;
end $$;
create trigger diagnostic_review_state_after_insert after insert on public.diagnostics
 for each row execute function public.admin_initialize_review_state();
insert into public.diagnostic_review_states(diagnostic_id,assessment_analysis_revision,briefing_analysis_revision)
 select id,case when current_assessment_id is not null then 1 end,case when current_briefing_id is not null then 1 end
 from public.diagnostics where archived_at is null;
insert into public.admin_audit_events(diagnostic_id,event_type,succeeded,metadata)
 select diagnostic_id,'REVIEW_STATE_INITIALIZED',true,'{"actorType":"SYSTEM"}' from public.diagnostic_review_states;

create function public.admin_review_state_version() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.assignee_profile_id is not null and new.assignee_profile_id is null then
  new.assigned_at:=null; new.assigned_by:=null;
  if coalesce(current_setting('app.admin_command_id',true),'')='' then
   insert into public.admin_audit_events(diagnostic_id,event_type,succeeded,"before","after",metadata)
    values(old.diagnostic_id,'DIAGNOSTIC_UNASSIGNED',true,
      jsonb_build_object('assigneeProfileId',old.assignee_profile_id),
      '{"assigneeProfileId":null}','{"actorType":"SYSTEM","reasonCode":"PROFILE_REMOVED"}');
  end if;
 end if;
 new.row_version:=case when nullif(current_setting('app.admin_target_review_version',true),'') is not null
  and current_setting('app.admin_diagnostic_id',true)=new.diagnostic_id::text
  then current_setting('app.admin_target_review_version',true)::bigint else old.row_version+1 end;
 new.updated_at:=now(); return new;
end $$;
create trigger review_state_version_before_update before update on public.diagnostic_review_states
 for each row execute function public.admin_review_state_version();

create function public.admin_guard_artifact_content() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='qualification_assessments' then
  if (to_jsonb(new)-'is_current') is distinct from (to_jsonb(old)-'is_current') then
   raise exception using errcode='55000',message='ASSESSMENT_CONTENT_IMMUTABLE';
  end if;
 elsif tg_table_name='commercial_briefings' then
  if (to_jsonb(new)-'status'-'superseded_by_id') is distinct from (to_jsonb(old)-'status'-'superseded_by_id') then
   raise exception using errcode='55000',message='BRIEFING_CONTENT_IMMUTABLE';
  end if;
 elsif old.snapshot_type in ('ADMIN_QUALIFICATION_INPUT','ADMIN_BRIEFING_INPUT') then
  if (to_jsonb(new)-'superseded_by_id') is distinct from (to_jsonb(old)-'superseded_by_id') then
   raise exception using errcode='55000',message='SNAPSHOT_CONTENT_IMMUTABLE';
  end if;
 end if;
 return new;
end $$;
create trigger assessment_content_guard before update on public.qualification_assessments for each row execute function public.admin_guard_artifact_content();
create trigger briefing_content_guard before update on public.commercial_briefings for each row execute function public.admin_guard_artifact_content();
create trigger internal_snapshot_content_guard before update on public.diagnostic_snapshots for each row execute function public.admin_guard_artifact_content();

do $block$
declare t text;
begin
 foreach t in array array['diagnostic_internal_notes','diagnostic_field_overrides','diagnostic_hypothesis_reviews'] loop
  execute format('create trigger immutable_admin_history before update or delete on public.%I for each row execute function public.guard_immutable_event()',t);
  execute format('create trigger admin_text_secret_guard before insert on public.%I for each row execute function public.guard_unredacted_secret()',t);
 end loop;
 foreach t in array array['diagnostic_review_states','diagnostic_internal_notes','diagnostic_field_overrides','diagnostic_hypothesis_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $block$;
create trigger admin_audit_secret_guard before insert on public.admin_audit_events for each row execute function public.guard_unredacted_secret();
revoke all on function public.admin_initialize_review_state(),public.admin_review_state_version(),public.admin_guard_artifact_content() from public,anon,authenticated;

-- Public completion can produce the first canonical artifacts after workflow initialization.
create function public.admin_sync_public_artifact_revisions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if coalesce(current_setting('app.admin_command_id',true),'')='' then
  update public.diagnostic_review_states set
   assessment_analysis_revision=case when new.current_assessment_id is distinct from old.current_assessment_id then analysis_revision else assessment_analysis_revision end,
   briefing_analysis_revision=case when new.current_briefing_id is distinct from old.current_briefing_id then analysis_revision else briefing_analysis_revision end
   where diagnostic_id=new.id;
 end if;
 return new;
end $$;
create trigger public_artifacts_review_revision after update of current_assessment_id,current_briefing_id on public.diagnostics
 for each row when (old.current_assessment_id is distinct from new.current_assessment_id or old.current_briefing_id is distinct from new.current_briefing_id)
 execute function public.admin_sync_public_artifact_revisions();
revoke all on function public.admin_sync_public_artifact_revisions() from public,anon,authenticated;


