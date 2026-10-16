"use client";
import { useEffect,useState } from "react";
import { readWorkflowHistory } from "./admin-workflow-client";
import type { WorkflowHistoryKind,WorkflowHistoryResult } from "./workflow-contract";
import { displayEffectiveValue } from "./AdminFieldOverrideDialog";
const titles:Record<WorkflowHistoryKind,string>={AUDIT:"Histórico completo de auditoria",OVERRIDES:"Histórico de correções",HYPOTHESES:"Histórico de revisões de hipóteses",FLAGS:"Histórico completo de flags",QUALIFICATION:"Todas as avaliações",BRIEFING:"Todas as versões de briefing"};
const labels:Record<string,string>={SET:"Correção registrada",REVERT:"Correção revertida",CONFIRMED:"Hipótese confirmada",REJECTED:"Hipótese rejeitada",TRIGGERED:"Flag criada",UPDATED:"Flag atualizada",RESOLVED:"Flag resolvida",REOPENED:"Flag reaberta",QUALIFICATION_RECALCULATED:"Avaliação de qualificação",BRIEFING_REGENERATED:"Versão de briefing",REVIEW_STATE_INITIALIZED:"Análise inicializada",DIAGNOSTIC_ASSIGNED:"Responsável atribuído",DIAGNOSTIC_REASSIGNED:"Responsável alterado",DIAGNOSTIC_UNASSIGNED:"Responsável removido",REVIEW_STATUS_CHANGED:"Status administrativo alterado",ADMIN_PRIORITY_CHANGED:"Prioridade alterada",INTERNAL_NOTE_CREATED:"Nota registrada",FIELD_OVERRIDE_CREATED:"Correção registrada",FIELD_OVERRIDE_REVERTED:"Correção revertida",HYPOTHESIS_CONFIRMED:"Hipótese confirmada",HYPOTHESIS_REJECTED:"Hipótese rejeitada",FLAG_RESOLVED:"Flag resolvida",FLAG_REOPENED:"Flag reaberta",DIAGNOSTIC_ARCHIVED:"Diagnóstico arquivado",DIAGNOSTIC_REOPENED:"Diagnóstico reaberto"};
export function AdminWorkflowHistory({diagnosticId,kind}:{diagnosticId:string;kind:WorkflowHistoryKind}){
 const [open,setOpen]=useState(false);const [page,setPage]=useState<WorkflowHistoryResult|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState("");
 useEffect(()=>{
  if(!open)return;const abort=new AbortController();
  readWorkflowHistory(diagnosticId,kind,abort.signal).then(value=>{if(!abort.signal.aborted)setPage(value);}).catch(()=>{if(!abort.signal.aborted)setError("Não foi possível carregar o histórico.");});
  return()=>abort.abort();
 },[open,diagnosticId,kind]);
 async function more(){
  setLoading(true);setError("");
  try{const value=await readWorkflowHistory(diagnosticId,kind,undefined,page?.nextCursor??undefined);setPage(old=>({items:[...(old?.items??[]),...value.items.filter(item=>!old?.items.some(o=>o.id===item.id))],nextCursor:value.nextCursor}));}
  catch{setError("Não foi possível carregar o histórico.");}finally{setLoading(false);}
 }
 return <details className="admin-workflow-history" onToggle={event=>setOpen(event.currentTarget.open)}><summary>{titles[kind]}</summary>
  {open?<><ol>{page?.items.map(item=>{
   const details=item.details as Record<string,unknown>;
   return <li key={item.id}><strong>{labels[item.action]??item.action}</strong> · {item.author} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("pt-BR")}</time>
    {details.version?<p>Versão {String(details.version)}</p>:null}
    {details.path?<p>Campo: {String(details.path)} · Anterior: {displayEffectiveValue(details.previousValue)} · Novo: {displayEffectiveValue(details.value)}</p>:null}
    {details.verification?<p>{details.verification==="VERIFIED"?"Verificação humana registrada":"Sem verificação"}</p>:null}
    {details.score!==undefined?<p>Score: {displayEffectiveValue(details.score)} · {String(details.classification)}</p>:null}
    {details.status?<p>Estado: {String(details.status)}</p>:null}
    {details.priority?<p>Prioridade: {String(details.priority)}</p>:null}
    {item.reason?<p>Motivo: {item.reason}</p>:null}{details.support?<p>Suporte: {String(details.support)}</p>:null}
   </li>;
  })}</ol>{!page && !error?<p role="status">Carregando histórico…</p>:page?.items.length===0?<p>Nenhum registro.</p>:null}
  {error?<p role="alert">{error}</p>:null}{error || page?.nextCursor?<button type="button" disabled={loading} onClick={()=>void more()}>{loading?"Carregando…":error?"Tentar novamente":"Carregar mais registros"}</button>:null}</>:null}
 </details>;
}
