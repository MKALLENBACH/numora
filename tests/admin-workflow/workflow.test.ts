import { before,after,beforeEach,afterEach,test } from "node:test";
import assert from "node:assert/strict";
import { createWorkflowDb,workflowFixture } from "./database.ts";
import { resolveAdminEffectiveData,type AdminSource } from "../../supabase/functions/_shared/admin-effective-data.ts";
import { buildAdminArtifact } from "../../supabase/functions/_shared/admin-workflow-artifacts.ts";
import { AdminWorkflowCommandSchema,WorkflowResultSchema,WorkflowReadResultSchema,type WorkflowCommand } from "../../supabase/functions/_shared/admin-workflow-contract.ts";
let db:Awaited<ReturnType<typeof createWorkflowDb>>,f:Awaited<ReturnType<typeof workflowFixture>>;
before(async()=>{db=await createWorkflowDb();});after(async()=>{await db.close();});
beforeEach(async()=>{await db.exec("begin");f=await workflowFixture(db);});afterEach(async()=>{await db.exec("rollback");});
async function request(command:WorkflowCommand,payload:unknown={}){
 const row=(await db.query<{r:number;d:number}>("select r.row_version r,d.row_version d from public.diagnostics d join public.diagnostic_review_states r on r.diagnostic_id=d.id where d.id=$1",[f.diagnosticId])).rows[0];
 return AdminWorkflowCommandSchema.parse({command,payload,diagnosticId:f.diagnosticId,clientRequestId:crypto.randomUUID(),expectedReviewVersion:Number(row.r),expectedDiagnosticVersion:Number(row.d)});
}
async function execute(req:unknown,artifact:unknown=null,actor=f.admin){
 return WorkflowResultSchema.parse((await db.query<{value:unknown}>("select public.admin_apply_diagnostic_command($1,$2::jsonb,$3::jsonb) value",[actor,JSON.stringify(req),JSON.stringify(artifact)])).rows[0].value);
}
async function source(){
 return (await db.query<{source:AdminSource;fingerprint:string}>("select s source,public.admin_workflow_request_hash(s) fingerprint from (select public.admin_workflow_source($1) s) x",[f.diagnosticId])).rows[0];
}
test("strict command rejects forged actor, arbitrary path, score, and invalid values",async()=>{
 const req=await request("CLAIM");
 assert.equal(AdminWorkflowCommandSchema.safeParse({...req,actor:f.admin}).success,false);
 assert.equal(AdminWorkflowCommandSchema.safeParse({...req,command:"SQL",payload:{}}).success,false);
 for(const fieldPath of ["lead.email","consentRecords.accepted","__proto__.polluted","score"]){
  assert.equal(AdminWorkflowCommandSchema.safeParse({...req,command:"CREATE_OVERRIDE",payload:{fieldPath,value:100,reason:"Motivo documentado",sourceAnswerId:null,verificationStatus:"UNVERIFIED",evidenceIds:[],evidenceNote:""}}).success,false);
 }
});
test("new and legacy list contracts, detail, and NOTES read safely",async()=>{
 const legacy=(await db.query<{value:{items:Array<{reviewStatus:null;adminPriority?:string}>}}>("select public.admin_list_diagnostics('{}') value")).rows[0].value;
 assert.equal(legacy.items[0].reviewStatus,null);assert.equal(legacy.items[0].adminPriority,undefined);
 const current=(await db.query<{value:{items:Array<{reviewStatus:string;adminPriority:string}>}}>("select public.admin_list_diagnostics($1::jsonb) value",[JSON.stringify({workflowVersion:1})])).rows[0].value;
 assert.equal(current.items[0].reviewStatus,"NEW");assert.equal(current.items[0].adminPriority,"NORMAL");
 const read=(await db.query<{value:Record<string,unknown>}>("select public.admin_read_workflow($1,$2) value",[f.viewer,f.diagnosticId])).rows[0].value;
 const {source:_source,...safeRead}=read;void _source;
 WorkflowReadResultSchema.parse({...safeRead,fields:resolveAdminEffectiveData((await source()).source).fields});
 await db.query("select public.admin_get_diagnostic_detail_v4($1,$2,'NOTES')",[f.viewer,f.diagnosticId]);
});
test("verified override preserves original and creates its own eligible evidence",async()=>{
 const prepared=await source();const original=resolveAdminEffectiveData(prepared.source).fields.find(x=>x.path==="challenge.summary")!;
 const result=await execute(await request("CREATE_OVERRIDE",{fieldPath:"challenge.summary",value:"Correção verificada pela análise interna.",verificationStatus:"VERIFIED",sourceAnswerId:f.answer,reason:"Correção sustentada por verificação humana.",evidenceIds:[],evidenceNote:"Validado com documentação operacional."}),{fingerprint:prepared.fingerprint,previousEffectiveValue:original.value,baseValue:original.structuredValue});
 const updated=resolveAdminEffectiveData((await source()).source);const field=updated.fields.find(x=>x.path==="challenge.summary")!;
 assert.equal(field.overrideId,result.entityId);assert.equal(field.scorable,true);assert.equal(field.source,"OVERRIDE");
 assert.equal(updated.evidence.filter(e=>e.path==="challenge.summary").length,1);
 assert.notEqual(updated.evidence.find(e=>e.path==="challenge.summary")?.answerId,f.answer);
 const raw=(await db.query<{v:string}>("select raw_value #>> '{}' v from public.interview_answers where id=$1",[f.answer])).rows[0].v;
 assert.equal(raw,"Resposta original sobre retrabalho no processo financeiro.");
});
test("unverified override suppresses original scoring proof",async()=>{
 const prepared=await source();const original=resolveAdminEffectiveData(prepared.source).fields.find(x=>x.path==="challenge.summary")!;
 await execute(await request("CREATE_OVERRIDE",{fieldPath:"challenge.summary",value:"Correção ainda não comprovada.",verificationStatus:"UNVERIFIED",sourceAnswerId:f.answer,reason:"Aguardando confirmação documental.",evidenceIds:[],evidenceNote:""}),{fingerprint:prepared.fingerprint,previousEffectiveValue:original.value,baseValue:original.structuredValue});
 const result=resolveAdminEffectiveData((await source()).source);
 assert.equal(result.fields.find(f=>f.path==="challenge.summary")?.scorable,false);
 assert.equal(result.evidence.some(e=>e.path==="challenge.summary"),false);
});
test("recalculation and briefing are versioned, atomic, and idempotent",async()=>{
 const req=await request("RECALCULATE_QUALIFICATION");const p=await source();
 const artifact=await buildAdminArtifact(p.source,p.fingerprint,"RECALCULATE_QUALIFICATION");
 const first=await execute(req,artifact);assert.equal(first.entityVersion,1);assert.equal(first.workflow.qualificationStale,false);
 assert.equal((await execute(req,artifact)).entityId,first.entityId);
 let next=await source();const second=await execute(await request("RECALCULATE_QUALIFICATION"),await buildAdminArtifact(next.source,next.fingerprint,"RECALCULATE_QUALIFICATION"));
 assert.equal(second.entityVersion,2);
 const counts=(await db.query<{all:number;current:number}>("select count(*)::int as all,count(*) filter(where is_current)::int as current from public.qualification_assessments where diagnostic_id=$1",[f.diagnosticId])).rows[0];
 assert.deepEqual(counts,{all:2,current:1});
 next=await source();const b1=await execute(await request("REGENERATE_BRIEFING"),await buildAdminArtifact(next.source,next.fingerprint,"REGENERATE_BRIEFING"));assert.equal(b1.entityVersion,1);
 next=await source();const b2=await execute(await request("REGENERATE_BRIEFING"),await buildAdminArtifact(next.source,next.fingerprint,"REGENERATE_BRIEFING"));assert.equal(b2.entityVersion,2);
 const old=(await db.query<{status:string;next:string}>("select status,superseded_by_id as next from public.commercial_briefings where id=$1",[b1.entityId])).rows[0];
 assert.equal(old.status,"SUPERSEDED");assert.equal(old.next,b2.entityId);
 assert.equal((await db.query<{status:string}>("select status from public.diagnostics where id=$1",[f.diagnosticId])).rows[0].status,"COMPLETED");
});
test("a computed artifact cannot commit after source changes",async()=>{
 const req=await request("RECALCULATE_QUALIFICATION");const p=await source();const artifact=await buildAdminArtifact(p.source,p.fingerprint,"RECALCULATE_QUALIFICATION");
 await db.query("update public.interview_answers set normalized_value='{}' where id=$1",[f.answer]);
 await db.exec("savepoint rejected_artifact");
 await assert.rejects(execute(req,artifact),/STALE_STATE/);
 await db.exec("rollback to savepoint rejected_artifact");
 assert.equal((await db.query<{n:number}>("select count(*)::int n from public.qualification_assessments where diagnostic_id=$1",[f.diagnosticId])).rows[0].n,0);
});
test("a valid human qualification has no fixed score threshold",async()=>{
 const a=(await db.query<{id:string}>("insert into public.qualification_assessments(diagnostic_id,earned_points,assessed_weight,final_score,classification,assessment_confidence,recommended_route) values($1,10,100,10,'LOW_FIT','HIGH','NURTURE') returning id",[f.diagnosticId])).rows[0].id;
 await db.query("update public.diagnostics set current_assessment_id=$1 where id=$2",[a,f.diagnosticId]);
 await execute(await request("SET_STATUS",{status:"UNDER_REVIEW"}));
 const result=await execute(await request("SET_STATUS",{status:"QUALIFIED"}));assert.equal(result.workflow.status,"QUALIFIED");
});

test("briefing hypotheses support public object and legacy string formats without changing score",async()=>{
 const texts=["Hipótese pública em formato estruturado.","Hipótese legada em texto simples."];
 const briefing=(await db.query<{id:string}>("insert into public.commercial_briefings(diagnostic_id,status,executive_summary,challenge_summary,current_process_summary,impact_summary,buying_context_summary,technical_context_summary,initial_hypotheses) values($1,'FINAL','Resumo','Desafio','Processo','Impacto','Compra','TI',$2::jsonb) returning id",[f.diagnosticId,JSON.stringify([{text:texts[0],sourceType:"AI_INFERENCE",confirmed:false},texts[1]])])).rows[0].id;
 await db.query("update public.diagnostics set current_briefing_id=$1 where id=$2",[briefing,f.diagnosticId]);
 const read=(await db.query<{v:{hypotheses:Array<{text:string;sourceId:string;sourceHash:string;hypothesisIndex:number}>}}>("select public.admin_read_workflow($1,$2) v",[f.admin,f.diagnosticId])).rows[0].v;
 assert.deepEqual(read.hypotheses.map(h=>h.text),texts);
 const h=read.hypotheses[0];
 await execute(await request("REVIEW_HYPOTHESIS",{sourceKind:"BRIEFING",sourceId:h.sourceId,hypothesisIndex:h.hypothesisIndex,sourceHash:h.sourceHash,status:"CONFIRMED",reason:"Revisão humana do formato público.",evidenceIds:[],evidenceNote:"Suporte documental verificado pela equipe."}));
 assert.equal((await db.query<{id:string|null}>("select current_assessment_id id from public.diagnostics where id=$1",[f.diagnosticId])).rows[0].id,null);
 const result=(await db.query<{v:{hypotheses:Array<{status:string}>}}>("select public.admin_read_workflow($1,$2) v",[f.viewer,f.diagnosticId])).rows[0].v;
 assert.equal(result.hypotheses[0].status,"CONFIRMED");assert.equal(result.hypotheses[1].status,"PENDING");
});

test("notes pagination uses timestamp and UUID without dropping ties",async()=>{
 await db.query("insert into public.diagnostic_internal_notes(diagnostic_id,category,body,author_user_id,author_profile_id,command_id) select $1,'GENERAL','Nota fixture '||g,$2,$3,gen_random_uuid() from generate_series(1,27) g",[f.diagnosticId,f.admin,f.ap]);
 const page=(await db.query<{value:{notes:Array<{id:string}>;nextCursor:unknown}}>("select public.admin_read_workflow($1,$2) value",[f.viewer,f.diagnosticId])).rows[0].value;
 assert.equal(page.notes.length,25);assert.ok(page.nextCursor);
 const last=(await db.query<{value:{notes:Array<{id:string}>;nextCursor:unknown}}>("select public.admin_read_workflow($1,$2,$3::jsonb) value",[f.viewer,f.diagnosticId,JSON.stringify(page.nextCursor)])).rows[0].value;
 assert.equal(last.notes.length,2);assert.equal(last.nextCursor,null);
 assert.equal(new Set([...page.notes,...last.notes].map(n=>n.id)).size,27);
});

test("complete histories paginate ties and expose override provenance",async()=>{
 const prepared=await source();const original=resolveAdminEffectiveData(prepared.source).fields.find(x=>x.path==="challenge.summary")!;
 await execute(await request("CREATE_OVERRIDE",{fieldPath:"challenge.summary",value:"Correção rastreável",verificationStatus:"UNVERIFIED",sourceAnswerId:f.answer,reason:"Correção justificada para teste.",evidenceIds:[],evidenceNote:""}),{fingerprint:prepared.fingerprint,previousEffectiveValue:original.value,baseValue:original.structuredValue});
 assert.equal(resolveAdminEffectiveData((await source()).source).fields.find(x=>x.path==="challenge.summary")?.overrideProvenance?.version,1);
 await db.query("insert into public.audit_events(diagnostic_id,event_type) select $1,'FIXTURE_EVENT' from generate_series(1,120)",[f.diagnosticId]);
 for(const kind of ["AUDIT","OVERRIDES","HYPOTHESES","FLAGS","QUALIFICATION","BRIEFING"]){
  let before:unknown=null;const ids=new Set<string>();let count=0;
  do{
   const data=(await db.query<{v:{items:Array<{id:string}>;nextCursor:unknown}}>("select public.admin_read_workflow_history($1,$2,$3,$4::jsonb) v",[f.viewer,f.diagnosticId,kind,before?JSON.stringify(before):null])).rows[0].v;
   for(const item of data.items){assert.equal(ids.has(item.id),false);ids.add(item.id);count++;}before=data.nextCursor;
  }while(before);
  if(kind==="AUDIT")assert.equal(count,122);
  if(kind==="OVERRIDES")assert.equal(count,1);
 }
});

test("long valid overrides generate bounded narrative while preserving full snapshot",async()=>{
 const p=await source();const full="Texto de verificação extensa. ".repeat(66).slice(0,1900);
 p.source.overrides=[{id:crypto.randomUUID(),field_path:"challenge.summary",operation:"SET",version:1,new_value:full,base_structured_value:resolveAdminEffectiveData(p.source).flat["challenge.summary"],source_answer_id:f.answer,verification_status:"VERIFIED",author_profile_id:f.ap,created_at:new Date().toISOString(),reason:"Teste de limites narrativos",evidence_ids:[],evidence_note:"Verificado manualmente."}];
 const result=await buildAdminArtifact(p.source,p.fingerprint,"REGENERATE_BRIEFING");
 assert.ok("briefing" in result);assert.equal(result.snapshot.structuredData["challenge.summary"],full);
 if(result.briefing)assert.equal(result.briefing.challengeSummary.length,800);
});
test("privacy restriction removes narrative source and write capabilities",async()=>{
 const consent=(await db.query<{id:string}>("select id from public.consent_records where diagnostic_id=$1 and consent_type='PRIVACY'",[f.diagnosticId])).rows[0].id;
 await db.query("insert into public.consent_records(diagnostic_id,owner_user_id,consent_type,decision,policy_version,supersedes_id) values($1,$2,'PRIVACY','DECLINED','test',$3)",[f.diagnosticId,f.visitor,consent]);
 const data=(await db.query<{value:{source?:unknown;notes:unknown[];workflow:{contactAllowed:boolean;privacyRestricted:boolean;capabilities:Record<string,boolean>}}}>("select public.admin_read_workflow($1,$2) value",[f.admin,f.diagnosticId])).rows[0].value;
 assert.equal(data.source,undefined);assert.equal(data.notes.length,0);assert.equal(data.workflow.contactAllowed,false);
 assert.equal(data.workflow.privacyRestricted,true);assert.equal(data.workflow.capabilities.ADD_NOTE,false);
});
test("source changes make an existing override inapplicable",async()=>{
 const p=await source();const original=resolveAdminEffectiveData(p.source).fields.find(x=>x.path==="challenge.summary")!;
 await execute(await request("CREATE_OVERRIDE",{fieldPath:"challenge.summary",value:"Correção anterior.",verificationStatus:"UNVERIFIED",sourceAnswerId:f.answer,reason:"Motivo documentado para correção.",evidenceIds:[],evidenceNote:""}),{fingerprint:p.fingerprint,previousEffectiveValue:original.value,baseValue:original.structuredValue});
 await db.query("update public.interview_answers set normalized_value=jsonb_set(normalized_value,'{challenge.summary}',to_jsonb($2::text)) where id=$1",[f.answer,"Nova base estruturada válida."]);
 const field=resolveAdminEffectiveData((await source()).source).fields.find(x=>x.path==="challenge.summary")!;
 assert.equal(field.stale,true);assert.equal(field.source,"STRUCTURED");assert.equal(field.value,"Nova base estruturada válida.");
});
test("evidence from another diagnostic is rejected",async()=>{
 const other=await workflowFixture(db);
 const proof=(await db.query<{id:string}>("select id from public.evidence_items where diagnostic_id=$1",[other.diagnosticId])).rows[0].id;
 const p=await source();const field=resolveAdminEffectiveData(p.source).fields.find(x=>x.path==="challenge.summary")!;
 await db.exec("savepoint invalid_evidence");
 await assert.rejects(execute(await request("CREATE_OVERRIDE",{fieldPath:"challenge.summary",value:"Correção sem prova deste diagnóstico.",verificationStatus:"VERIFIED",sourceAnswerId:f.answer,reason:"Justificativa documentada de teste.",evidenceIds:[proof],evidenceNote:""}),{fingerprint:p.fingerprint,previousEffectiveValue:field.value,baseValue:field.structuredValue}),/VALIDATION_ERROR/);
 await db.exec("rollback to savepoint invalid_evidence");
});
test("no-contact consent remains authoritative through qualification and briefing",async()=>{
 const consent=(await db.query<{id:string}>("select id from public.consent_records where diagnostic_id=$1 and consent_type='COMMERCIAL'",[f.diagnosticId])).rows[0].id;
 await db.query("insert into public.consent_records(diagnostic_id,owner_user_id,consent_type,decision,policy_version,supersedes_id) values($1,$2,'COMMERCIAL','DECLINED','test',$3)",[f.diagnosticId,f.visitor,consent]);
 let p=await source();const artifact=await buildAdminArtifact(p.source,p.fingerprint,"RECALCULATE_QUALIFICATION");
 const result=await execute(await request("RECALCULATE_QUALIFICATION"),artifact);assert.equal(result.workflow.contactAllowed,false);
 p=await source();const briefing=await buildAdminArtifact(p.source,p.fingerprint,"REGENERATE_BRIEFING");
 assert.equal("briefing" in briefing && briefing.briefing?.recommendedOffer,"NO_OFFER");
 await execute(await request("REGENERATE_BRIEFING"),briefing);
});
test("retention removes the disposable diagnostic and all append-only children",async()=>{
 const p=await source();await execute(await request("RECALCULATE_QUALIFICATION"),await buildAdminArtifact(p.source,p.fingerprint,"RECALCULATE_QUALIFICATION"));
 for(let i=0;i<2;i++){const input=await source();await execute(await request("REGENERATE_BRIEFING"),await buildAdminArtifact(input.source,input.fingerprint,"REGENERATE_BRIEFING"));}
 await execute(await request("ADD_NOTE",{category:"GENERAL",body:"Nota da fixture a ser removida por retenção."}));
 await db.exec("savepoint orphan_evidence");
 await db.query("delete from public.evidence_items where answer_id=$1",[f.answer]);
 await assert.rejects(db.exec("set constraints criterion_evidence_links_evidence_item_id_fkey immediate"),/foreign key constraint/);
 await db.exec("rollback to savepoint orphan_evidence");
 await db.exec("select set_config('app.retention_cleanup','on',true)");
 await db.query("delete from public.diagnostics where id=$1",[f.diagnosticId]);
 await db.exec("set constraints all immediate");
 assert.equal((await db.query<{n:number}>("select count(*)::int n from public.diagnostic_internal_notes where diagnostic_id=$1",[f.diagnosticId])).rows[0].n,0);
 assert.ok((await db.query<{n:number}>("select count(*)::int n from public.admin_audit_events where diagnostic_id=$1",[f.diagnosticId])).rows[0].n>0);
});


