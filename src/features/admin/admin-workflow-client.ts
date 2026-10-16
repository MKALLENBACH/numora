import { z } from "zod";
import { AdminClientError,adminFunctionJson,currentAdminAccessToken,type AdminErrorCode } from "./admin-transport";
import { AdminWorkflowCommandSchema,WorkflowReadResultSchema,WorkflowResultSchema,type AdminWorkflowCommand } from "./workflow-contract";
import { WorkflowHistoryResultSchema,type WorkflowHistoryKind } from "./workflow-contract";
export async function readWorkflowHistory(diagnosticId:string,kind:WorkflowHistoryKind,signal?:AbortSignal,before?:{createdAt:string;id:string}){
 return WorkflowHistoryResultSchema.parse(await workflowRequest({operation:"HISTORY",diagnosticId,kind,...(before?{before}:{})},signal));
}

const codes=new Set(["UNAUTHORIZED","ACCESS_DENIED","NOT_FOUND","STATE_CONFLICT","STALE_STATE","ACTION_NOT_APPLICABLE","IDEMPOTENCY_KEY_REUSED","VALIDATION_ERROR","RATE_LIMITED","BACKEND_FAILURE","QUERY_TIMEOUT"]);
export async function workflowRequest(body:unknown,signal?:AbortSignal):Promise<unknown>{
 try {
  const {response,payload}=await adminFunctionJson({functionName:"admin-diagnostic-workflow",accessToken:await currentAdminAccessToken(),body,signal});
  const result=payload as {data?:unknown;error?:{code?:string;message?:string;referenceCode?:string}}|null;
  if(!response.ok || !result || result.error){
   const code=result?.error?.code;
   throw new AdminClientError(codes.has(code??"")?code as AdminErrorCode:"BACKEND_FAILURE",result?.error?.message??"Não foi possível concluir a operação.",result?.error?.referenceCode);
  }
  return result.data;
 }catch(error){
  if(signal?.aborted)throw error;
  if(error instanceof AdminClientError || error instanceof z.ZodError)throw error;
  if(error instanceof DOMException && ["AbortError","TimeoutError"].includes(error.name))throw new AdminClientError("REQUEST_TIMEOUT","A operação pode ter sido concluída. Tente novamente com a mesma solicitação para verificar o resultado.");
  throw new AdminClientError("NETWORK_ERROR","A conexão foi interrompida. Tente novamente para verificar o resultado da mesma solicitação.");
 }
}
export async function readAdminWorkflow(diagnosticId:string,signal?:AbortSignal,before?:{createdAt:string;id:string}){
 return WorkflowReadResultSchema.parse(await workflowRequest({operation:"READ",diagnosticId,...(before?{before}:{})},signal));
}
export async function executeAdminWorkflow(request:AdminWorkflowCommand){
 return WorkflowResultSchema.parse(await workflowRequest(AdminWorkflowCommandSchema.parse(request)));
}
export async function listWorkflowAssignees(search="",signal?:AbortSignal,page=0){
 return z.array(z.object({id:z.uuid(),display_name:z.string(),role:z.enum(["ADMIN","CONSULTANT"]),is_active:z.literal(true)}).strict()).parse(await workflowRequest({operation:"LIST_ASSIGNEES",search,page},signal));
}

