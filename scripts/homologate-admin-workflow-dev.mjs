// Explicit DEV-only smoke test. Credentials stay in memory; temporary browser fixtures
// are stored only under ignored supabase/.temp and must be removed with --cleanup.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync,writeFileSync,existsSync,unlinkSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {createClient} from "@supabase/supabase-js";
const ref="tbioidswvkfbnyedulrg";
assert.equal(readFileSync("supabase/.temp/project-ref","utf8").trim(),ref);
const cli=(...args)=>execFileSync(process.execPath,["node_modules/supabase/dist/supabase.js",...args,"--agent","no"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
const keys=JSON.parse(cli("projects","api-keys","--project-ref",ref,"--output","json"));
const anon=keys.find(k=>k.name==="anon").api_key;
const secret=keys.find(k=>k.name==="service_role").api_key;
const url=`https://${ref}.supabase.co`;
const options={auth:{persistSession:false,autoRefreshToken:false}};
const service=createClient(url,secret,options);
const fixturePath="supabase/.temp/adm04-fixture.json";
const reportPath="supabase/.temp/adm04-http-results.json";
const results=[];
const check=(name,value)=>{assert.ok(value,name);results.push({name,status:"PASS"});console.log("PASS",name);};
function checked({data,error}){if(error)throw new Error(error.message);return data;}
async function insert(table,row){return checked(await service.from(table).insert(row).select().single());}
async function call(token,body,fn="admin-diagnostic-workflow"){
 const response=await fetch(`${url}/functions/v1/${fn}`,{method:"POST",headers:{origin:"http://localhost:3000",apikey:anon,...(token?{authorization:`Bearer ${token}`}:{ }),"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
 return {status:response.status,...await response.json()};
}
if(process.argv.includes("--cleanup")){
 const f=JSON.parse(readFileSync(fixturePath,"utf8"));
 const ids=[f.diagnosticId,f.lead,f.company,...(f.extraDiagnostics??[]),...(f.extraLeads??[]),...(f.extraCompanies??[]),...f.users.map(u=>u.id)].filter(Boolean);
 assert.ok(ids.every(id=>/^[a-f0-9-]{36}$/.test(id)));
 const list=values=>values.filter(Boolean).map(value=>`'${value}'`).join(",")||"null";
 const sql=`begin;set local app.retention_cleanup='on';delete from public.diagnostics where id in (${list([f.diagnosticId,...(f.extraDiagnostics??[])])});delete from public.leads where id in (${list([f.lead,...(f.extraLeads??[])])});delete from public.companies where id in (${list([f.company,...(f.extraCompanies??[])])});delete from public.admin_profiles where user_id in (${list(f.users.map(u=>u.id))});delete from auth.users where id in (${list(f.users.map(u=>u.id))});commit;`;
 writeFileSync("supabase/.temp/adm04-cleanup.sql",sql);cli("db","query","--linked","--file","supabase/.temp/adm04-cleanup.sql","--output","json");
 const verify=`select jsonb_build_object('diagnostics',(select count(*) from public.diagnostics where id in (${list([f.diagnosticId,...(f.extraDiagnostics??[])])})),'users',(select count(*) from auth.users where id in (${list(f.users.map(u=>u.id))})),'profiles',(select count(*) from public.admin_profiles where user_id in (${list(f.users.map(u=>u.id))})),'leads',(select count(*) from public.leads where id in (${list([f.lead,...(f.extraLeads??[])])})),'companies',(select count(*) from public.companies where id in (${list([f.company,...(f.extraCompanies??[])])})),'auditReceiptsPreserved',(select count(*) from public.admin_audit_events where diagnostic_id in (${list([f.diagnosticId,...(f.extraDiagnostics??[])])}))) result`;
 const final=JSON.parse(cli("db","query","--linked",verify,"--output","json"))[0].result;
 for(const key of ["diagnostics","users","profiles","leads","companies"])assert.equal(final[key],0);
 assert.ok(final.auditReceiptsPreserved>0);writeFileSync("docs/evidencias/adm-04/cleanup-dev.json",JSON.stringify({at:new Date().toISOString(),projectRef:ref,...final},null,2));
 unlinkSync(fixturePath);unlinkSync("supabase/.temp/adm04-cleanup.sql");console.log("Disposable DEV fixtures removed; audit receipts preserved.");process.exit(0);
}
assert.equal(existsSync(fixturePath),false,"Clean up the previous disposable fixture first.");
const f={users:[],diagnosticId:crypto.randomUUID(),company:null,lead:null};
writeFileSync(fixturePath,JSON.stringify(f));
try{
 for(const [i,role] of ["ADMIN","CONSULTANT","CONSULTANT","VIEWER",null].entries()){
  const email=`adm04-${crypto.randomUUID()}@example.invalid`;const password=randomBytes(24).toString("base64url")+"aA1!";
  const user=checked(await service.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{test_fixture:"ADM04_DEV"}})).user;
  const client=createClient(url,anon,options);const session=checked(await client.auth.signInWithPassword({email,password})).session;
  const profile=role?await insert("admin_profiles",{user_id:user.id,display_name:`ADM04 Test ${role} ${i}`,role}):null;
  f.users.push({id:user.id,email,password,role,profileId:profile?.id,token:session.access_token});writeFileSync(fixturePath,JSON.stringify(f));
 }
 const [admin,c1,c2,viewer,visitor]=f.users;
 f.company=(await insert("companies",{name:"ADM04 Empresa de homologação descartável",industry:"TECHNOLOGY",employee_range:"51_100"})).id;
 writeFileSync(fixturePath,JSON.stringify(f));
 f.lead=(await insert("leads",{company_id:f.company,owner_user_id:visitor.id,name:"ADM04 Visitante Teste",role:"Diretor",email:visitor.email})).id;
 writeFileSync(fixturePath,JSON.stringify(f));
 await insert("diagnostics",{id:f.diagnosticId,lead_id:f.lead,owner_user_id:visitor.id,status:"COMPLETED",current_stage:"COMPLETION",completed_at:new Date().toISOString()});
 const session=await insert("diagnostic_sessions",{diagnostic_id:f.diagnosticId,owner_user_id:visitor.id,status:"COMPLETED"});
 for(const consent_type of ["PRIVACY","COMMERCIAL"])await insert("consent_records",{diagnostic_id:f.diagnosticId,owner_user_id:visitor.id,consent_type,decision:"ACCEPTED",policy_version:"adm04-test"});
 const answer=await insert("interview_answers",{session_id:session.id,diagnostic_id:f.diagnosticId,owner_user_id:visitor.id,question_code:"CHALLENGE_001",question_version:"1.0.0",response_type:"LONG_TEXT",raw_value:"Resposta de homologação preservada.",display_value:"Resposta de homologação preservada.",normalized_value:{"challenge.summary":"Retrabalho financeiro na homologação.","challenge.primaryAffectedArea":"FINANCE"}});
 await insert("evidence_items",{diagnostic_id:f.diagnosticId,answer_id:answer.id,target_path:"challenge.summary",source_type:"REPORTED_FACT",text:"Resposta de homologação",confidence:1,confirmed:true});
 const hypothesis=await insert("evidence_items",{diagnostic_id:f.diagnosticId,target_path:"challenge.summary",source_type:"AI_INFERENCE",text:"Hipótese de homologação, ainda não é fato.",confidence:0.4,confirmed:false});
 writeFileSync(fixturePath,JSON.stringify(f));
 const read=async(user=admin)=>{const r=await call(user.token,{operation:"READ",diagnosticId:f.diagnosticId});assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 const request=async(command,payload={},user=admin)=>{const data=await read(user);return {diagnosticId:f.diagnosticId,command,payload,clientRequestId:crypto.randomUUID(),expectedReviewVersion:data.workflow.rowVersion,expectedDiagnosticVersion:data.workflow.diagnosticVersion};};
 const command=async(name,payload={},user=admin)=>{const r=await call(user.token,await request(name,payload,user));assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 check("unauthenticated denied",(await call(null,{operation:"READ",diagnosticId:f.diagnosticId})).status===401);
 check("visitor denied",(await call(visitor.token,{operation:"READ",diagnosticId:f.diagnosticId})).status===403);
 check("VIEWER cannot mutate",(await call(viewer.token,await request("CLAIM",{},viewer))).status===403);
 const claim=await request("CLAIM",{},c1);const claims=await Promise.all([call(c1.token,claim),call(c2.token,{...claim,clientRequestId:crypto.randomUUID()})]);
 check("concurrent CLAIM: one winner and one version conflict",claims.filter(r=>r.status===200).length===1&&claims.filter(r=>r.status===409&&r.error.code==="STATE_CONFLICT").length===1);
 if((await read()).workflow.assignee?.profileId!==c1.profileId)await command("ASSIGN",{profileId:c1.profileId,reason:"Redistribuição de homologação controlada."});
 check("other consultant denied",(await call(c2.token,await request("ADD_NOTE",{category:"GENERAL",body:"Tentativa de outro responsável."},c2))).status===403);
 await command("SET_STATUS",{status:"UNDER_REVIEW"},c1);
 await command("SET_PRIORITY",{priority:"HIGH"},c1);
 const note=await request("ADD_NOTE",{category:"TECHNICAL",body:"Nota descartável de homologação sem conteúdo pessoal."},c1);
 const first=await call(c1.token,note);const retry=await call(c1.token,note);
 check("durable retry returns one note",first.status===200&&retry.data.replayed&&first.data.entityId===retry.data.entityId);
 check("idempotency key rejects changed body",(await call(c1.token,{...note,payload:{...note.payload,body:"Outro conteúdo"}})).error.code==="IDEMPOTENCY_KEY_REUSED");
 check("forged actor rejected",(await call(admin.token,{...await request("CLAIM"),actor:admin.id})).status===422);
 const field=(await read()).fields.find(x=>x.path==="challenge.summary");
 await command("CREATE_OVERRIDE",{fieldPath:field.path,value:"Correção verificada de homologação.",sourceAnswerId:field.sourceAnswerId,verificationStatus:"VERIFIED",reason:"Correção para verificar a cadeia de evidência.",evidenceIds:[],evidenceNote:"Verificado no cenário descartável de DEV."});
 check("override keeps original response",checked(await service.from("interview_answers").select("raw_value").eq("id",answer.id).single()).raw_value==="Resposta de homologação preservada.");
 const h=(await read()).hypotheses.find(h=>h.sourceId===hypothesis.id);
 await command("REVIEW_HYPOTHESIS",{sourceKind:h.sourceKind,sourceId:h.sourceId,hypothesisIndex:h.hypothesisIndex,sourceHash:h.sourceHash,status:"REJECTED",reason:"Hipótese recusada após avaliação da fonte.",evidenceIds:[],evidenceNote:""});
 const a1=await command("RECALCULATE_QUALIFICATION");const a2=await command("RECALCULATE_QUALIFICATION");check("qualification creates versions",a2.entityVersion===a1.entityVersion+1);
 const b1=await command("REGENERATE_BRIEFING");const b2=await command("REGENERATE_BRIEFING");check("briefing preserves previous version",b2.entityVersion===b1.entityVersion+1);
 const flag=await insert("diagnostic_flags",{diagnostic_id:f.diagnosticId,code:"ADM04_DISPOSABLE_FLAG",display_name:"Flag de homologação",category:"DATA_QUALITY",severity:"S2",source:"MANUAL",reason:"Razão original preservada da flag."});
 await command("RESOLVE_FLAG",{flagId:flag.id,reason:"Condição de teste verificada e resolvida.",evidenceIds:[],evidenceNote:"Verificação humana documentada em homologação."});
 await command("REOPEN_FLAG",{flagId:flag.id,reason:"Reabertura para validar o evento histórico.",evidenceIds:[],evidenceNote:"Novo cenário controlado de homologação."});
 check("flag original reason preserved",checked(await service.from("diagnostic_flags").select("reason").eq("id",flag.id).single()).reason==="Razão original preservada da flag.");
 await command("ARCHIVE",{reason:"Arquivamento administrativo em homologação."});
 check("archive preserves public status",checked(await service.from("diagnostics").select("status,archived_at").eq("id",f.diagnosticId).single()).archived_at===null);
 check("archived note rejected",[403,409].includes((await call(admin.token,await request("ADD_NOTE",{category:"GENERAL",body:"Bloqueada pelo arquivamento"}))).status));
 const reopened=await command("REOPEN",{reason:"Reabertura administrativa em homologação."});check("reopen computes current destination",reopened.workflow.status==="UNDER_REVIEW");
 checked(await service.from("admin_profiles").update({is_active:false}).eq("id",c2.profileId));
 check("inactive profile denied",(await call(c2.token,{operation:"READ",diagnosticId:f.diagnosticId})).status===403);
 for(const section of ["OVERVIEW","INTERVIEW","QUALIFICATION","FLAGS","BRIEFING","AUDIT","NOTES"]){
  const r=await call(viewer.token,{diagnosticId:f.diagnosticId,section,workflowVersion:1},"admin-diagnostic-detail");check(`detail ${section}`,r.status===200);
 }
 for(const kind of ["AUDIT","OVERRIDES","HYPOTHESES","FLAGS","QUALIFICATION","BRIEFING"]){check(`history ${kind}`,(await call(viewer.token,{operation:"HISTORY",diagnosticId:f.diagnosticId,kind})).status===200);}
 check("list old and new contract",(await call(viewer.token,{},"admin-diagnostics-list")).status===200&&(await call(viewer.token,{workflowVersion:1},"admin-diagnostics-list")).status===200);
 const publicBefore=checked(await service.from("diagnostics").select("status,archived_at").eq("id",f.diagnosticId).single());check("public completion unchanged",publicBefore.status==="COMPLETED"&&publicBefore.archived_at===null);
 writeFileSync(reportPath,JSON.stringify({projectRef:ref,at:new Date().toISOString(),results},null,2));
 // Only synthetic test credentials are retained for the browser pass, never service keys.
 f.users=f.users.map(({token,...user})=>{void token;return user;});writeFileSync(fixturePath,JSON.stringify(f));
 console.log("DEV HTTP validation passed. Browser fixture ready; run --cleanup when finished.");
}catch(error){writeFileSync(reportPath,JSON.stringify({projectRef:ref,at:new Date().toISOString(),results,failure:error.message},null,2));throw error;}
