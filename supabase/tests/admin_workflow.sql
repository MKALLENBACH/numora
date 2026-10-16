-- Disposable integration fixtures. This file always rolls back, including on remote DEV.
begin;
create temporary table workflow_test_marker(id int);
create function pg_temp.request(p_actor uuid,p_id uuid,p_cmd text,p_payload jsonb default '{}',p_cid uuid default gen_random_uuid()) returns jsonb language sql as $$
 select jsonb_build_object('diagnosticId',p_id,'command',p_cmd,'clientRequestId',p_cid,'expectedReviewVersion',r.row_version,'expectedDiagnosticVersion',d.row_version,'payload',p_payload)
 from public.diagnostics d join public.diagnostic_review_states r on r.diagnostic_id=d.id where d.id=p_id;
$$;
create function pg_temp.reject(p_actor uuid,p_request jsonb,p_expected text,p_artifact jsonb default null) returns void language plpgsql as $$
begin
 begin
  perform public.admin_apply_diagnostic_command(p_actor,p_request,p_artifact);
 exception when others then
  if position(p_expected in sqlerrm)>0 then return; end if;
  raise exception 'Unexpected rejection: %, expected %',sqlerrm,p_expected;
 end;
 raise exception 'Command should have failed: %',p_expected;
end $$;
do $tests$
declare
 a uuid:=gen_random_uuid(); c1 uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); visitor uuid:=gen_random_uuid();
 ap uuid; cp1 uuid; cp2 uuid; vp uuid; company uuid; lead uuid; did uuid; sid uuid;
 req jsonb; result jsonb; source jsonb; artifact jsonb; old_version bigint; old_d_version bigint;
 reason text:='Justificativa de teste verificável'; consent_id uuid; flag_id uuid; bid uuid; n integer; override_id uuid; hypo_hash text;
begin
 insert into auth.users(id,is_anonymous) values(a,false),(c1,false),(c2,false),(v,false),(visitor,true);
 insert into public.admin_profiles(user_id,display_name,role) values(a,'Admin teste','ADMIN') returning id into ap;
 insert into public.admin_profiles(user_id,display_name,role) values(c1,'Consultor um','CONSULTANT') returning id into cp1;
 insert into public.admin_profiles(user_id,display_name,role) values(c2,'Consultor dois','CONSULTANT') returning id into cp2;
 insert into public.admin_profiles(user_id,display_name,role) values(v,'Leitura teste','VIEWER') returning id into vp;
 insert into public.companies(name,industry) values('Empresa teste','TECHNOLOGY') returning id into company;
 insert into public.leads(company_id,owner_user_id,name,role,email) values(company,visitor,'Visitante teste','Diretor','fixture@example.invalid') returning id into lead;
 insert into public.diagnostics(lead_id,owner_user_id,status,current_stage,completed_at) values(lead,visitor,'COMPLETED','COMPLETION',now()) returning id into did;
 insert into public.diagnostic_sessions(diagnostic_id,owner_user_id,status) values(did,visitor,'COMPLETED') returning id into sid;
 insert into public.consent_records(diagnostic_id,owner_user_id,consent_type,decision,policy_version) values(did,visitor,'PRIVACY','ACCEPTED','test');
 insert into public.consent_records(diagnostic_id,owner_user_id,consent_type,decision,policy_version) values(did,visitor,'COMMERCIAL','ACCEPTED','test') returning id into consent_id;
 if (select status from public.diagnostic_review_states where diagnostic_id=did)<>'NEW' then raise exception 'Initialization failed'; end if;
 perform pg_temp.reject(v,pg_temp.request(v,did,'CLAIM'),'ACCESS_DENIED');
 perform pg_temp.reject(visitor,pg_temp.request(visitor,did,'CLAIM'),'ACCESS_DENIED');
 req:=pg_temp.request(c2,did,'CLAIM');
 result:=public.admin_apply_diagnostic_command(c1,pg_temp.request(c1,did,'CLAIM'));
 if (result#>>'{workflow,rowVersion}')::bigint<>2 then raise exception 'Review version must increment exactly once'; end if;
 -- Stale claim never steals assignment, regardless of rejection code.
 begin perform public.admin_apply_diagnostic_command(c2,req); raise exception 'Concurrent claim stole assignment';
 exception when sqlstate '42501' then null;
 when sqlstate 'P0001' then if sqlerrm<>'STATE_CONFLICT' then raise; end if; end;
 if (select assignee_profile_id from public.diagnostic_review_states where diagnostic_id=did)<>cp1 then raise exception 'Claim owner changed'; end if;
 perform pg_temp.reject(c2,pg_temp.request(c2,did,'ADD_NOTE','{"category":"GENERAL","body":"Tentativa indevida"}'),'ACCESS_DENIED');
 perform pg_temp.reject(c1,pg_temp.request(c1,did,'SET_STATUS','{"status":"QUALIFIED"}'),'ACTION_NOT_APPLICABLE');
 perform public.admin_apply_diagnostic_command(c1,pg_temp.request(c1,did,'SET_STATUS','{"status":"UNDER_REVIEW"}'));
 perform pg_temp.reject(c1,pg_temp.request(c1,did,'SET_PRIORITY',jsonb_build_object('priority','URGENT','reason',reason)),'ACCESS_DENIED');
 perform public.admin_apply_diagnostic_command(c1,pg_temp.request(c1,did,'SET_PRIORITY','{"priority":"HIGH"}'));
 req:=pg_temp.request(c1,did,'ADD_NOTE','{"category":"GENERAL","body":"Nota interna preservada"}');
 result:=public.admin_apply_diagnostic_command(c1,req);
 if public.admin_apply_diagnostic_command(c1,req)->>'replayed'<>'true' then raise exception 'Replay failed'; end if;
 delete from public.idempotency_records where owner_user_id=c1;
 if public.admin_apply_diagnostic_command(c1,req)->>'replayed'<>'true' then raise exception 'Durable replay failed'; end if;
 perform pg_temp.reject(c1,jsonb_set(req,'{payload,body}','"Outro texto da nota"'),'IDEMPOTENCY_KEY_REUSED');
 if (select count(*) from public.diagnostic_internal_notes where diagnostic_id=did)<>1 then raise exception 'Duplicate note'; end if;
 if (select count(*) from public.admin_audit_events where actor_user_id=c1 and command_id=(req->>'clientRequestId')::uuid)<>1 then raise exception 'Duplicate root audit'; end if;
 begin update public.diagnostic_internal_notes set body='Texto alterado' where diagnostic_id=did; raise exception 'Note update accepted';
 exception when sqlstate '55000' then null; end;
 old_version:=(select row_version from public.diagnostic_review_states where diagnostic_id=did);
 req:=pg_temp.request(c1,did,'SET_PRIORITY','{"priority":"NORMAL"}');
 perform public.admin_apply_diagnostic_command(a,pg_temp.request(a,did,'SET_PRIORITY',jsonb_build_object('priority','URGENT','reason',reason)));
 perform pg_temp.reject(c1,req,'STATE_CONFLICT');
 update public.admin_profiles set is_active=false where id=cp1;
 perform pg_temp.reject(c1,pg_temp.request(c1,did,'ADD_NOTE','{"category":"GENERAL","body":"Inativo"}'),'ACCESS_DENIED');
 update public.admin_profiles set is_active=true where id=cp1;
 source:=public.admin_workflow_source(did);
 artifact:=jsonb_build_object('fingerprint',public.admin_workflow_request_hash(source),'previousEffectiveValue','Original');
 req:=pg_temp.request(c1,did,'CREATE_OVERRIDE',jsonb_build_object('fieldPath','challenge.summary','value','Descrição corrigida e verificada','verificationStatus','VERIFIED','sourceAnswerId',null,'reason',reason,'evidenceIds','[]'::jsonb,'evidenceNote',reason));
 result:=public.admin_apply_diagnostic_command(c1,req,artifact); override_id:=(result->>'entityId')::uuid;
 if not exists(select 1 from public.evidence_sources where source_locator='admin_override:'||override_id) then raise exception 'Override evidence missing'; end if;
 if exists(select 1 from public.interview_answers where diagnostic_id=did) then raise exception 'Override invented visitor answer'; end if;
 source:=public.admin_workflow_source(did);
 artifact:=jsonb_build_object('fingerprint',public.admin_workflow_request_hash(source),'previousEffectiveValue','Descrição corrigida e verificada');
 perform public.admin_apply_diagnostic_command(c1,pg_temp.request(c1,did,'REVERT_OVERRIDE',jsonb_build_object('overrideId',override_id,'reason',reason)),artifact);
 begin update public.diagnostic_field_overrides set new_value='"apagado"' where id=override_id; raise exception 'Override update accepted';
 exception when sqlstate '55000' then null; end;
 insert into public.commercial_briefings(diagnostic_id,status,executive_summary,challenge_summary,current_process_summary,impact_summary,buying_context_summary,technical_context_summary,initial_hypotheses)
 values(did,'FINAL','Resumo','Desafio','Processo','Impacto','Contexto','Técnico','["Hipótese a verificar"]') returning id into bid;
 update public.diagnostics set current_briefing_id=bid where id=did;
 hypo_hash:=encode(extensions.digest('Hipótese a verificar','sha256'),'hex');
 perform public.admin_apply_diagnostic_command(c1,pg_temp.request(c1,did,'REVIEW_HYPOTHESIS',jsonb_build_object('sourceKind','BRIEFING','sourceId',bid,'hypothesisIndex',0,'sourceHash',hypo_hash,'status','CONFIRMED','reason',reason,'evidenceIds','[]'::jsonb,'evidenceNote',reason)));
 if (select current_assessment_id from public.diagnostics where id=did) is not null then raise exception 'Hypothesis changed score'; end if;
 insert into public.commercial_briefings(diagnostic_id,version,status,executive_summary,challenge_summary,current_process_summary,impact_summary,buying_context_summary,technical_context_summary,initial_hypotheses)
 values(did,2,'DRAFT','Resumo','Desafio','Processo','Impacto','Compra','TI','[{"text":"Hipótese pública estruturada","sourceType":"AI_INFERENCE","confirmed":false}]') returning id into bid;
 update public.diagnostics set current_briefing_id=bid where id=did;
 result:=public.admin_read_workflow(a,did);
 if result#>>'{hypotheses,0,text}'<>'Hipótese pública estruturada' then raise exception 'Object hypothesis not projected'; end if;
 perform public.admin_apply_diagnostic_command(a,pg_temp.request(a,did,'REVIEW_HYPOTHESIS',jsonb_build_object('sourceKind','BRIEFING','sourceId',bid,'hypothesisIndex',0,'sourceHash',result#>>'{hypotheses,0,sourceHash}','status','REJECTED','reason',reason,'evidenceIds','[]'::jsonb,'evidenceNote','')));
 insert into public.diagnostic_flags(diagnostic_id,code,display_name,category,severity,reason) values(did,'ILLEGAL_REQUEST','S3 teste','SECURITY','S3',reason) returning id into flag_id;
 source:=public.admin_workflow_source(did);artifact:=jsonb_build_object('fingerprint',public.admin_workflow_request_hash(source),'flagResolutionAllowed',true);
 perform pg_temp.reject(c1,pg_temp.request(c1,did,'RESOLVE_FLAG',jsonb_build_object('flagId',flag_id,'reason',reason,'evidenceIds','[]'::jsonb,'evidenceNote',reason)),'ACCESS_DENIED',artifact);
 perform public.admin_apply_diagnostic_command(a,pg_temp.request(a,did,'RESOLVE_FLAG',jsonb_build_object('flagId',flag_id,'reason',reason,'evidenceIds','[]'::jsonb,'evidenceNote',reason)),artifact);
 if (select f.reason from public.diagnostic_flags f where f.id=flag_id)<>reason then raise exception 'Original flag reason overwritten'; end if;
 perform public.admin_apply_diagnostic_command(a,pg_temp.request(a,did,'REOPEN_FLAG',jsonb_build_object('flagId',flag_id,'reason',reason,'evidenceIds','[]'::jsonb,'evidenceNote',reason)));
 if (select count(*) from public.diagnostic_flag_events where diagnostic_id=did and event_type='REOPENED')<1 then raise exception 'Reopen history missing'; end if;
 insert into public.consent_records(diagnostic_id,owner_user_id,consent_type,decision,policy_version,supersedes_id) values(did,visitor,'COMMERCIAL','DECLINED','test',consent_id);
 if (public.admin_workflow_privacy(did)->>'contactAllowed')::boolean then raise exception 'Contact restriction lost'; end if;
 old_d_version:=(select row_version from public.diagnostics where id=did);
 perform public.admin_apply_diagnostic_command(a,pg_temp.request(a,did,'ARCHIVE',jsonb_build_object('reason',reason)));
 if (select status from public.diagnostics where id=did)<>'COMPLETED' or (select archived_at from public.diagnostics where id=did) is not null
 or (select row_version from public.diagnostics where id=did)<>old_d_version then raise exception 'Archive changed public state'; end if;
 perform pg_temp.reject(c1,pg_temp.request(c1,did,'ADD_NOTE','{"category":"GENERAL","body":"Arquivado"}'),'ACCESS_DENIED');
 result:=public.admin_apply_diagnostic_command(a,pg_temp.request(a,did,'REOPEN',jsonb_build_object('reason',reason)));
 if result#>>'{workflow,status}'<>'BLOCKED' then raise exception 'Reopen ignored active S3'; end if;
 if has_function_privilege('authenticated','public.admin_apply_diagnostic_command(uuid,jsonb,jsonb)','execute') or has_function_privilege('anon','public.admin_apply_diagnostic_command(uuid,jsonb,jsonb)','execute') then raise exception 'Browser can execute workflow'; end if;
 if has_table_privilege('authenticated','public.diagnostic_internal_notes','select') then raise exception 'Internal notes exposed'; end if;
end $tests$;
-- Audit failure must roll back content, state version, and idempotency, tested with a deliberately failing trigger.
create function pg_temp.fail_admin_note_audit() returns trigger language plpgsql as $$ begin if new.event_type='INTERNAL_NOTE_CREATED' then raise exception 'TEST_AUDIT_FAILURE'; end if; return new; end $$;
create trigger test_audit_failure before insert on public.admin_audit_events for each row execute function pg_temp.fail_admin_note_audit();
do $$ declare a uuid; did uuid; v bigint; count_before bigint; begin
 select user_id into a from public.admin_profiles where display_name='Admin teste';
 select diagnostic_id into did from public.diagnostic_review_states where status='BLOCKED' order by created_at desc limit 1;
 select row_version into v from public.diagnostic_review_states where diagnostic_id=did;
 select count(*) into count_before from public.diagnostic_internal_notes where diagnostic_id=did;
 perform pg_temp.reject(a,pg_temp.request(a,did,'ADD_NOTE','{"category":"GENERAL","body":"Esta nota deve sofrer rollback"}'),'TEST_AUDIT_FAILURE');
 if (select row_version from public.diagnostic_review_states where diagnostic_id=did)<>v or
 (select count(*) from public.diagnostic_internal_notes where diagnostic_id=did)<>count_before then raise exception 'Audit did not roll back note and version'; end if;
end $$;
rollback;

