import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFile,readdir } from "node:fs/promises";
export async function createWorkflowDb(){
 const db=new PGlite({extensions:{pgcrypto,citext}});
 await db.exec(`
 create schema auth;create schema extensions;
 create role anon;create role authenticated;create role service_role bypassrls;
 create table auth.users(id uuid primary key default gen_random_uuid(),is_anonymous boolean default false,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth,public,extensions to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to service_role;
 alter default privileges in schema public grant all on sequences to service_role;`);
 for(const file of (await readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort())await db.exec(await readFile("supabase/migrations/"+file,"utf8"));
 return db;
}
export async function workflowFixture(db:PGlite){
 const ids=Array.from({length:9},()=>crypto.randomUUID());
 const [admin,consultant,viewer,visitor,ap,cp,vp,diagnosticId,sessionId]=ids;
 await db.query("insert into auth.users(id,is_anonymous) values($1,false),($2,false),($3,false),($4,true)",[admin,consultant,viewer,visitor]);
 await db.query("insert into public.admin_profiles(id,user_id,display_name,role) values($1,$2,'Admin fixture','ADMIN'),($3,$4,'Consultor fixture','CONSULTANT'),($5,$6,'Viewer fixture','VIEWER')",[ap,admin,cp,consultant,vp,viewer]);
 const company=(await db.query<{id:string}>("insert into public.companies(name,industry,employee_range) values('Empresa fixture','TECHNOLOGY','51_100') returning id")).rows[0].id;
 const lead=(await db.query<{id:string}>("insert into public.leads(company_id,owner_user_id,name,role,email) values($1,$2,'Visitante fixture','Diretor','fixture@example.invalid') returning id",[company,visitor])).rows[0].id;
 await db.query("insert into public.diagnostics(id,lead_id,owner_user_id,status,current_stage,completed_at) values($1,$2,$3,'COMPLETED','COMPLETION',now())",[diagnosticId,lead,visitor]);
 await db.query("insert into public.diagnostic_sessions(id,diagnostic_id,owner_user_id,status) values($1,$2,$3,'COMPLETED')",[sessionId,diagnosticId,visitor]);
 await db.query("insert into public.consent_records(diagnostic_id,owner_user_id,consent_type,decision,policy_version) values($1,$2,'PRIVACY','ACCEPTED','test'),($1,$2,'COMMERCIAL','ACCEPTED','test')",[diagnosticId,visitor]);
 const answer=(await db.query<{id:string}>("insert into public.interview_answers(session_id,diagnostic_id,owner_user_id,question_code,question_version,response_type,raw_value,normalized_value,display_value) values($1,$2,$3,'CHALLENGE_001','1.0.0','LONG_TEXT',to_jsonb($4::text),$5::jsonb,$4) returning id",[sessionId,diagnosticId,visitor,"Resposta original sobre retrabalho no processo financeiro.",JSON.stringify({"challenge.summary":"Desafio estruturado de retrabalho no processo financeiro.","challenge.primaryAffectedArea":"FINANCE"})])).rows[0].id;
 await db.query("insert into public.evidence_items(diagnostic_id,answer_id,target_path,source_type,text,confidence,confirmed) values($1,$2,'challenge.summary','REPORTED_FACT','Resposta original',1,true)",[diagnosticId,answer]);
 return {admin,consultant,viewer,visitor,ap,cp,vp,diagnosticId,sessionId,answer,company,lead};
}

