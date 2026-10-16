import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFile,readdir } from "node:fs/promises";
const db=new PGlite({extensions:{pgcrypto,citext}});
try {
 await db.exec(`
 create schema auth; create schema extensions;
 create role anon; create role authenticated; create role service_role bypassrls;
 create table auth.users(id uuid primary key default gen_random_uuid(),is_anonymous boolean default false,email text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 grant usage on schema auth,public,extensions to anon,authenticated,service_role;
 grant execute on all functions in schema auth to anon,authenticated,service_role;
 alter default privileges in schema public grant all on tables to service_role;
 alter default privileges in schema public grant all on sequences to service_role;
 `);
 for(const name of (await readdir("supabase/migrations")).filter(x=>x.endsWith(".sql")).sort()){
  await db.exec(await readFile("supabase/migrations/"+name,"utf8"));
  console.log("Migration OK: "+name);
 }
 const testFile="supabase/tests/admin_workflow.sql";
 try { await db.exec(await readFile(testFile,"utf8"));console.log("SQL workflow scenarios: passed"); }
 catch(error){ if(error.code!=="ENOENT")throw error; }
} catch(error) {
 console.error(JSON.stringify({message:error.message,code:error.code,detail:error.detail,where:error.where},null,2));
 process.exitCode=1;
} finally {await db.close();}

