"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { z } from "zod";
import { executeAdminWorkflow,readAdminWorkflow } from "./admin-workflow-client";
import { AdminClientError } from "./admin-transport";
import { AdminWorkflowCommandSchema,type AdminWorkflowCommand,type WorkflowReadResult,type WorkflowResult,type WorkflowCommand } from "./workflow-contract";
import { useAdminAuth } from "./AdminAuthProvider";

export function useAdminWorkflow(diagnosticId:string|null,onChanged:(sections:string[])=>void){
 const {session,refresh}=useAdminAuth();
 const [data,setData]=useState<WorkflowReadResult|null>(null);
 const [error,setError]=useState<AdminClientError|null>(null);
 const [busy,setBusy]=useState(false);const [loading,setLoading]=useState(true);
 const [message,setMessage]=useState("");
 const attempt=useRef<{signature:string;request:AdminWorkflowCommand}|null>(null);
 const requestController=useRef<AbortController|null>(null);
 const generation=useRef(0);const busyRef=useRef(false);
 const changedRef=useRef(onChanged);
 useEffect(()=>{changedRef.current=onChanged;},[onChanged]);
 const load=useCallback(async()=>{
  if(!diagnosticId)return;
  requestController.current?.abort();const controller=new AbortController();requestController.current=controller;
  setLoading(true);
  try{const result=await readAdminWorkflow(diagnosticId,controller.signal);if(!controller.signal.aborted){setData(result);setError(null);}}
  catch(caught){if(controller.signal.aborted)return;const error=caught instanceof AdminClientError?caught:new AdminClientError("BACKEND_FAILURE","Não foi possível carregar a análise interna.");setError(error);if(error.code==="UNAUTHORIZED" || error.code==="ACCESS_DENIED")void refresh();}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[diagnosticId,refresh]);
 useEffect(()=>{
  const currentGeneration=++generation.current;const timer=window.setTimeout(()=>void load(),0);
  return()=>{window.clearTimeout(timer);generation.current=currentGeneration+1;requestController.current?.abort();attempt.current=null;};
 },[load,session?.userId]);
 const reload=useCallback(async()=>{attempt.current=null;await load();},[load]);
 const execute=useCallback(async(command:WorkflowCommand,payload:unknown):Promise<WorkflowResult>=>{
  if(!diagnosticId || !data || busyRef.current)throw new AdminClientError("ACTION_NOT_APPLICABLE","Aguarde a operação em andamento.");
  const currentGeneration=generation.current;
  const signature=JSON.stringify({command,payload});
  const validated=AdminWorkflowCommandSchema.safeParse({
   diagnosticId,command,payload,clientRequestId:crypto.randomUUID(),expectedReviewVersion:data.workflow.rowVersion,expectedDiagnosticVersion:data.workflow.diagnosticVersion,
  });
  if(!validated.success){const error=new AdminClientError("VALIDATION_ERROR",validated.error.issues.map(i=>i.message).join(" "));setError(error);throw error;}
  const request=attempt.current?.signature===signature?attempt.current.request:validated.data;
  attempt.current={signature,request};busyRef.current=true;setBusy(true);setError(null);setMessage("");
  try{
   const result=await executeAdminWorkflow(request);
   if(currentGeneration===generation.current){
    setData(previous=>previous?{...previous,workflow:result.workflow}:previous);
    changedRef.current(result.invalidatedSections);attempt.current=null;
    setMessage("Alteração confirmada."+ (result.entityVersion?" Nova versão: "+result.entityVersion+".":""));
    await load();
   }
   return result;
  }catch(caught){
   const error=caught instanceof AdminClientError?caught:new AdminClientError("VALIDATION_ERROR",caught instanceof z.ZodError?caught.issues.map(i=>i.message).join(" "):"Revise os campos informados.");
   if(currentGeneration===generation.current){setError(error);if(error.code==="UNAUTHORIZED" || error.code==="ACCESS_DENIED")void refresh();}
   throw error;
  }finally{busyRef.current=false;if(currentGeneration===generation.current)setBusy(false);}
 },[diagnosticId,data,load,refresh]);
 const moreNotes=useCallback(async()=>{
  if(!diagnosticId || !data?.nextCursor || busyRef.current)return;
  const currentGeneration=generation.current;
  try{const page=await readAdminWorkflow(diagnosticId,undefined,data.nextCursor);if(generation.current===currentGeneration)setData(current=>current?{...current,notes:[...current.notes,...page.notes.filter(n=>!current.notes.some(old=>old.id===n.id))],nextCursor:page.nextCursor}:current);}
  catch(caught){if(generation.current===currentGeneration)setError(caught instanceof AdminClientError?caught:new AdminClientError("BACKEND_FAILURE","Não foi possível carregar mais notas."));}
 },[data,diagnosticId]);
 return {data,error,busy,loading,message,execute,reload,moreNotes};
}
export type AdminWorkflowController=ReturnType<typeof useAdminWorkflow>;

