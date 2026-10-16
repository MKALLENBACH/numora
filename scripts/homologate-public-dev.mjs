import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {createClient} from "@supabase/supabase-js";
const ref="tbioidswvkfbnyedulrg";assert.equal(readFileSync("supabase/.temp/project-ref","utf8").trim(),ref);
const keys=JSON.parse(execFileSync(process.execPath,["node_modules/supabase/dist/supabase.js","projects","api-keys","--project-ref",ref,"--agent","no","--output","json"],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}));
const anon=keys.find(x=>x.name==="anon").api_key;const url=`https://${ref}.supabase.co`;const options={auth:{autoRefreshToken:false,persistSession:false}};
const service=createClient(url,keys.find(x=>x.name==="service_role").api_key,options);
const f=JSON.parse(readFileSync("supabase/.temp/adm04-fixture.json","utf8"));
const client=createClient(url,anon,options);const login=await client.auth.signInAnonymously();if(login.error)throw login.error;
f.users.push({id:login.data.user.id,role:null});writeFileSync("supabase/.temp/adm04-fixture.json",JSON.stringify(f));
const token=login.data.session.access_token;const results=[];
async function call(name,body){
 for(let attempt=0;attempt<4;attempt++){
  const r=await fetch(`${url}/functions/v1/${name}`,{method:"POST",headers:{origin:"http://localhost:3000",apikey:anon,authorization:`Bearer ${token}`,"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(25000)});
  const json=await r.json();
  if(r.status===429 && attempt<3){console.log("Public rate limit respected; waiting 55 seconds.");await new Promise(resolve=>setTimeout(resolve,55000));continue;}
  assert.equal(r.status,200,JSON.stringify(json));assert.equal(json.error,null);return json.data;
 }
}
function safe(value){if(value&&typeof value==="object")for(const [k,v] of Object.entries(value)){assert.ok(!["score","finalScore","flags","briefing","capabilities","assignee","reviewStatus"].includes(k),`private public response key ${k}`);safe(v);}}
const id=()=>crypto.randomUUID();let state=await call("diagnostic-start",{clientRequestId:id(),locale:"pt-BR",timezone:"America/Sao_Paulo"});
f.extraDiagnostics=[...(f.extraDiagnostics??[]),state.diagnosticId];writeFileSync("supabase/.temp/adm04-fixture.json",JSON.stringify(f));
const identity=()=>({diagnosticId:state.diagnosticId,sessionId:state.sessionId});
for(const type of ["PRIVACY","COMMERCIAL"])state=await call("diagnostic-consent",{...identity(),type,decision:"ACCEPTED",policyVersion:"adm04-disposable-test",clientRequestId:id()});
state=await call("diagnostic-identification",{...identity(),clientRequestId:id(),company:{name:"ADM04 Regressão pública descartável",industry:"TECHNOLOGY",employeeRange:"51_100"},lead:{name:"Visitante Teste",role:"Diretor",email:"public-fixture@example.invalid"}});
const d=await service.from("diagnostics").select("lead_id").eq("id",state.diagnosticId).single();const l=await service.from("leads").select("company_id").eq("id",d.data.lead_id).single();
f.extraLeads=[...(f.extraLeads??[]),d.data.lead_id];f.extraCompanies=[...(f.extraCompanies??[]),l.data.company_id];writeFileSync("supabase/.temp/adm04-fixture.json",JSON.stringify(f));
for(let n=0;n<40&&state.stage!=="REVIEW";n++){
 if(!state.currentQuestion){state=await call("diagnostic-next-action",identity());if(state.stage==="REVIEW")break;}
 const q=state.currentQuestion;assert.ok(q,JSON.stringify(state));const validation=q.validation??{};
 let value="O processo financeiro depende de planilhas e ERP, com conciliação manual diária de 200 documentos por seis analistas. Há retrabalho, atrasos e erros. Buscamos integrar dados e reduzir o prazo de fechamento com apoio do diretor financeiro e de TI.";
 if(q.responseType==="SINGLE_CHOICE"||q.responseType==="CURRENCY_RANGE")value=q.options?.find(x=>x.value==="FINANCE")?.value??q.options?.find(x=>!x.value.includes("UNKNOWN"))?.value??"De R$ 10 mil a R$ 50 mil";
 if(q.responseType==="MULTIPLE_CHOICE")value=q.options.slice(0,2).map(x=>x.value);
 if(["NUMBER","SCALE"].includes(q.responseType))value=Math.min(validation.max??20,Math.max(validation.min??0,5));
 if(q.responseType==="NUMBER_WITH_UNIT")value={value:20,unit:validation.units?.[0]??"horas"};
 if(["YES_NO","CONFIRMATION"].includes(q.responseType))value=true;
 if(q.responseType==="DATE")value="2026-12-01";
 const version=await service.from("diagnostics").select("row_version").eq("id",state.diagnosticId).single();
 await new Promise(resolve=>setTimeout(resolve,1100));
 state=await call("diagnostic-submit-answer",{...identity(),questionCode:q.id,questionVersion:q.version,responseType:q.responseType,value,clientRequestId:id(),rowVersion:version.data.row_version,elapsedMs:5000,startedAt:new Date(Date.now()-5000).toISOString()});safe(state);console.log("Public answer accepted:",q.id);
}
assert.equal(state.stage,"REVIEW");state=await call("diagnostic-generate-review",{...identity(),clientRequestId:id()});assert.ok(state.review);safe(state);
state=await call("diagnostic-confirm-review",{...identity(),reviewVersion:state.review.version,clientRequestId:id()});
const complete={...identity(),clientRequestId:id()};state=await call("diagnostic-complete",complete);assert.equal(state.status,"COMPLETED");safe(state);
const replay=await call("diagnostic-complete",complete);assert.equal(replay.status,"COMPLETED");
const workflow=await service.from("diagnostic_review_states").select("status,priority,assignee_profile_id").eq("diagnostic_id",state.diagnosticId).single();assert.deepEqual(workflow.data,{status:"NEW",priority:"NORMAL",assignee_profile_id:null});
results.push("Anonymous auth","Start","Consents","Identification","Interview","Review","Confirm","Completion","Completion retry","Safe public projection","New workflow initialized independently");
writeFileSync("supabase/.temp/adm04-public-results.json",JSON.stringify({projectRef:ref,at:new Date().toISOString(),status:"PASS",results},null,2));console.log("Public end-to-end regression passed.");
