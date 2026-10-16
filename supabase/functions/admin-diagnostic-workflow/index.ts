import { z } from "zod";
import { AdminAuthError,requireAdminUser,requireRole } from "../_shared/admin-auth.ts";
import { assertAdminOrigin,adminCorsHeaders } from "../_shared/admin-cors.ts";
import { AdminWorkflowCommandSchema,WorkflowReadSchema,WorkflowReadResultSchema,WorkflowResultSchema,AssigneesRequestSchema } from "../_shared/admin-workflow-contract.ts";
import { resolveAdminEffectiveData,type AdminSource } from "../_shared/admin-effective-data.ts";
import { buildAdminArtifact,adminFlagResolutionAllowed } from "../_shared/admin-workflow-artifacts.ts";
import { redactValue } from "../_shared/redaction.ts";
import { WorkflowHistorySchema,WorkflowHistoryResultSchema } from "../_shared/admin-workflow-contract.ts";
import { GENERATION_COMMANDS,PREPARED_COMMANDS } from "../_shared/admin-workflow-policy.ts";

const messages:Record<string,string>={
 UNAUTHORIZED:"Não foi possível validar sua sessão.",ACCESS_DENIED:"Esta ação não está autorizada para sua conta e este diagnóstico.",
 NOT_FOUND:"Diagnóstico não encontrado.",STATE_CONFLICT:"Este diagnóstico foi atualizado por outro usuário. Recarregue os dados antes de continuar.",
 STALE_STATE:"Os dados usados na análise mudaram. Recarregue antes de continuar.",ACTION_NOT_APPLICABLE:"Esta ação não é permitida no estado atual.",
 IDEMPOTENCY_KEY_REUSED:"Esta tentativa já foi utilizada com outro conteúdo. Revise os dados e tente novamente.",
 VALIDATION_ERROR:"Revise os campos informados.",RATE_LIMITED:"Aguarde um momento antes de tentar novamente.",
 BACKEND_FAILURE:"Não foi possível concluir a operação.",QUERY_TIMEOUT:"A operação demorou mais que o esperado. Verifique o resultado antes de tentar novamente.",
};
const statuses:Record<string,number>={UNAUTHORIZED:401,ACCESS_DENIED:403,NOT_FOUND:404,STATE_CONFLICT:409,STALE_STATE:409,ACTION_NOT_APPLICABLE:409,IDEMPOTENCY_KEY_REUSED:409,VALIDATION_ERROR:422,RATE_LIMITED:429,BACKEND_FAILURE:503,QUERY_TIMEOUT:504};
class WorkflowError extends Error {constructor(readonly code:string){super(code);}}
Deno.serve(async request=>{
 let origin="";
 try{origin=assertAdminOrigin(request.headers.get("origin"));}catch{return Response.json({data:null,error:{code:"ACCESS_DENIED",message:"Origem não autorizada."}},{status:403,headers:{"Cache-Control":"no-store"}});}
 const headers={...adminCorsHeaders(origin),"Content-Type":"application/json"};
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
 const referenceCode="NUMW"+crypto.randomUUID().replaceAll("-","").slice(0,12).toUpperCase();
 try{
  if(request.method!=="POST")throw new WorkflowError("VALIDATION_ERROR");
  const {admin,context}=await requireAdminUser(request);
  if(Number(request.headers.get("content-length")??0)>32768)throw new WorkflowError("VALIDATION_ERROR");
  const text=await request.text();if(new TextEncoder().encode(text).byteLength>32768)throw new WorkflowError("VALIDATION_ERROR");
  let raw:unknown;try{raw=JSON.parse(text);}catch{throw new WorkflowError("VALIDATION_ERROR");}
  const read=WorkflowReadSchema.safeParse(raw);const assignees=AssigneesRequestSchema.safeParse(raw);
  const history=WorkflowHistorySchema.safeParse(raw);
  const input=read.success||assignees.success||history.success?null:AdminWorkflowCommandSchema.parse(raw);
  const generate=Boolean(input && GENERATION_COMMANDS.includes(input.command));
  if(input){
   requireRole(context,["ADMIN","CONSULTANT"]);
   if((Deno.env.get("ADMIN_WORKFLOW_COMMANDS_ENABLED")??"false")!=="true")throw new WorkflowError("ACCESS_DENIED");
   if((await redactValue(input.payload as never,"admin.payload")).redactions.length)throw new WorkflowError("VALIDATION_ERROR");
  }
  async function rpc(name:string,args:Record<string,unknown>):Promise<unknown>{
   const {data,error}=await admin.rpc(name,args);
   if(error){
    const code=Object.keys(messages).find(key=>error.message?.includes(key))??(error.code==="57014"?"QUERY_TIMEOUT":error.code==="40001"?"STATE_CONFLICT":error.code==="42501"?"ACCESS_DENIED":["22023","23514","23502","22P02"].includes(error.code)?"VALIDATION_ERROR":"BACKEND_FAILURE");
    throw new WorkflowError(code);
   }
   return data;
  }
  const limit=await rpc("diagnostic_consume_rate_limit",{p_owner_user_id:context.userId,p_scope:input?(generate?"admin-workflow-generation":"admin-workflow-command"):"admin-workflow-read",p_max_requests:input?(generate?5:30):120,p_window_seconds:60});
  if(limit!==true)throw new WorkflowError("RATE_LIMITED");
  let data:unknown;
  if(history.success){
   data=WorkflowHistoryResultSchema.parse(await rpc("admin_read_workflow_history",{p_actor:context.userId,p_id:history.data.diagnosticId,p_kind:history.data.kind,p_before:history.data.before??null}));
  }else if(assignees.success){
   requireRole(context,["ADMIN"]);
   let query=admin.from("admin_profiles").select("id,display_name,role,is_active").eq("is_active",true).in("role",["ADMIN","CONSULTANT"]).order("display_name").order("id").range(assignees.data.page*50,assignees.data.page*50+49);
   if(assignees.data.search)query=query.ilike("display_name","%"+assignees.data.search.replaceAll("%","").replaceAll("_","")+"%");
   const result=await query;if(result.error)throw new WorkflowError("BACKEND_FAILURE");
   data=z.array(z.object({id:z.uuid(),display_name:z.string(),role:z.enum(["ADMIN","CONSULTANT"]),is_active:z.literal(true)}).strict()).parse(result.data);
  }else if(read.success){
   const result=await rpc("admin_read_workflow",{p_actor:context.userId,p_id:read.data.diagnosticId,p_before:read.data.before??null}) as Record<string,unknown>;
   const workflow=result.workflow as {privacyRestricted:boolean};
   let fields:unknown[]=[];
   if(!workflow.privacyRestricted){
    const source=result.source as AdminSource;
    fields=resolveAdminEffectiveData(source).fields;
   }
   const {source: _source,...safeRead}=result;
   void _source;
   data=WorkflowReadResultSchema.parse({...safeRead,fields});
  }else if(input){
   let artifact:unknown=null;
   if(PREPARED_COMMANDS.includes(input.command)){
    const prepared=await rpc("admin_prepare_workflow_command",{p_actor:context.userId,p_request:input}) as {receipt?:unknown;source:AdminSource;fingerprint:string};
    if(prepared.receipt)data=WorkflowResultSchema.parse(prepared.receipt);
    else{
     if(generate)artifact=await buildAdminArtifact(prepared.source,prepared.fingerprint,input.command as "RECALCULATE_QUALIFICATION"|"REGENERATE_BRIEFING");
     else if(input.command==="RESOLVE_FLAG")artifact={fingerprint:prepared.fingerprint,flagResolutionAllowed:adminFlagResolutionAllowed(prepared.source,input.payload.flagId)};
     else{
      const fields=resolveAdminEffectiveData(prepared.source).fields;
      const overrideId=input.command==="REVERT_OVERRIDE"?input.payload.overrideId:null;
      const path=input.command==="CREATE_OVERRIDE"?input.payload.fieldPath:String(prepared.source.overrides.find(o=>o.id===overrideId)?.field_path);
      const field=fields.find(f=>f.path===path);
      if(!field)throw new WorkflowError("STALE_STATE");
      if(input.command==="CREATE_OVERRIDE" && input.payload.sourceAnswerId!==field.sourceAnswerId)throw new WorkflowError("STALE_STATE");
      artifact={fingerprint:prepared.fingerprint,previousEffectiveValue:field.value,baseValue:field.structuredValue};
     }
    }
   }
   if(!data)data=WorkflowResultSchema.parse(await rpc("admin_apply_diagnostic_command",{p_actor:context.userId,p_request:input,p_artifact:artifact}));
  }else throw new WorkflowError("VALIDATION_ERROR");
  return Response.json({data,error:null},{headers});
 }catch(error){
  const code=error instanceof WorkflowError?error.code:error instanceof AdminAuthError?error.code==="UNAUTHORIZED"?"UNAUTHORIZED":"ACCESS_DENIED":error instanceof z.ZodError?"VALIDATION_ERROR":"BACKEND_FAILURE";
  if(code==="BACKEND_FAILURE" || code==="QUERY_TIMEOUT")console.error("Admin workflow failed.",{referenceCode,code});
  return Response.json({data:null,error:{code,message:messages[code],referenceCode,...(code==="RATE_LIMITED"?{retryAfterSeconds:60}:{})}},{status:statuses[code]??503,headers:{...headers,...(code==="RATE_LIMITED"?{"Retry-After":"60"}:{})}});
 }
});

