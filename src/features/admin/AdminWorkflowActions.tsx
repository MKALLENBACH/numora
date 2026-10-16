"use client";
import { useEffect,useState } from "react";
import { useAdminAuth } from "./AdminAuthProvider";
import { listWorkflowAssignees } from "./admin-workflow-client";
import { AdminWorkflowDialog } from "./AdminWorkflowDialog";
import { ADMIN_PRIORITIES,type WorkflowCommand } from "./workflow-contract";
import type { AdminWorkflowController } from "./useAdminWorkflow";
export const reviewLabels:Record<string,string>={NEW:"Novo",UNDER_REVIEW:"Em análise",NEEDS_INFORMATION:"Aguardando informação",QUALIFIED:"Qualificado pela equipe",NOT_QUALIFIED:"Não qualificado",OUT_OF_SCOPE:"Fora do escopo",NO_CONTACT_PERMISSION:"Sem permissão de contato",BLOCKED:"Bloqueado",ARCHIVED:"Arquivado"};
export const priorityLabels:Record<string,string>={LOW:"Baixa",NORMAL:"Normal",HIGH:"Alta",URGENT:"Urgente"};
const titles:Partial<Record<WorkflowCommand,string>>={CLAIM:"Assumir diagnóstico",ASSIGN:"Atribuir responsável",UNASSIGN:"Remover responsável",SET_STATUS:"Alterar status de análise",SET_PRIORITY:"Definir prioridade administrativa",ARCHIVE:"Arquivar diagnóstico",REOPEN:"Reabrir diagnóstico",RECALCULATE_QUALIFICATION:"Recalcular a qualificação",REGENERATE_BRIEFING:"Regenerar briefing",RESOLVE_FLAG:"Resolver flag",REOPEN_FLAG:"Reabrir flag"};
type Flag={id:string;displayName:string;severity:string;category:string;status:string};
export function AdminWorkflowActions({controller,placement="header",flags=[]}:{controller:AdminWorkflowController;placement?:string;flags?:Flag[]}){
 const {session}=useAdminAuth();const [action,setAction]=useState<WorkflowCommand|null>(null);const [flag,setFlag]=useState<Flag|null>(null);
 const [reason,setReason]=useState("");const [support,setSupport]=useState("");const [selected,setSelected]=useState("");
 const [search,setSearch]=useState("");const [assignees,setAssignees]=useState<Awaited<ReturnType<typeof listWorkflowAssignees>>>([]);
 const [directoryError,setDirectoryError]=useState("");
 const [directoryPage,setDirectoryPage]=useState(0);const [directoryMore,setDirectoryMore]=useState(false);
 useEffect(()=>{
  if(action!=="ASSIGN")return;const abort=new AbortController();
  const timer=window.setTimeout(()=>{void listWorkflowAssignees(search,abort.signal,directoryPage).then(rows=>{if(abort.signal.aborted)return;setAssignees(old=>directoryPage?[...old,...rows.filter(row=>!old.some(o=>o.id===row.id))]:rows);setDirectoryMore(rows.length===50);setDirectoryError("");}).catch(()=>{if(!abort.signal.aborted)setDirectoryError("Não foi possível carregar os responsáveis.");});},200);
  return()=>{window.clearTimeout(timer);abort.abort();};
 },[action,search,directoryPage]);
 const data=controller.data;
 if(!data)return placement==="header"?<div role="status">{controller.loading?"Carregando análise interna…":<button onClick={()=>void controller.reload()}>Tentar carregar análise interna</button>}</div>:null;
 const w=data.workflow;const cap=w.capabilities;
 function open(command:WorkflowCommand,selectedFlag?:Flag){setReason("");setSupport("");setSelected("");setFlag(selectedFlag??null);setAction(command);}
 async function submit(){
  if(!action)return;
  const why=reason.trim()?{reason:reason.trim()}:{};
  let payload:unknown={};
  if(action==="ASSIGN")payload={profileId:selected,...why};
  else if(action==="SET_STATUS")payload={status:selected,...why};
  else if(action==="SET_PRIORITY")payload={priority:selected,...why};
  else if(action==="UNASSIGN" || action==="ARCHIVE" || action==="REOPEN")payload={reason};
  else if(action==="RESOLVE_FLAG" || action==="REOPEN_FLAG")payload={flagId:flag?.id,reason,evidenceIds:[],evidenceNote:support};
  await controller.execute(action,payload);setAction(null);
 }
 const reasonRequired=Boolean(action && (["UNASSIGN","ARCHIVE","REOPEN","RESOLVE_FLAG","REOPEN_FLAG"].includes(action) ||
  action==="ASSIGN" && w.assignee || action==="SET_PRIORITY" && (selected==="URGENT" || w.priority==="URGENT") ||
  action==="SET_STATUS" && (["NOT_QUALIFIED","OUT_OF_SCOPE","BLOCKED"].includes(selected) || ["QUALIFIED","NOT_QUALIFIED","OUT_OF_SCOPE","NO_CONTACT_PERMISSION","BLOCKED"].includes(w.status))));
 const description=action==="RECALCULATE_QUALIFICATION"?"Uma nova avaliação será criada com base nos dados vigentes. A avaliação anterior será preservada no histórico.":
  action==="REGENERATE_BRIEFING"?"Uma nova versão será criada com base nos dados vigentes. O briefing anterior será preservado no histórico.":
  action==="ARCHIVE"?"O diagnóstico será retirado da fila interna. Seu conteúdo e histórico serão preservados.":
  action==="REOPEN"?"O destino será calculado conforme os impedimentos e a permissão de contato atuais.":"";
 return <>
  {placement==="header"?<section className="admin-workflow-summary" aria-label="Análise interna">
   <h2>Análise interna</h2><dl><div><dt>Status administrativo</dt><dd>{reviewLabels[w.status]}</dd></div>
    <div><dt>Prioridade administrativa</dt><dd>{priorityLabels[w.priority]}</dd></div><div><dt>Responsável</dt><dd>{w.assignee?.displayName??"Não atribuído"}{w.assignee && !w.assignee.isActive?" · Perfil inativo":""}</dd></div></dl>
   {!w.contactAllowed?<p className="admin-contact-state--denied">Contato não autorizado</p>:null}
   {w.decisionStale?<p role="status">Decisão precisa de revisão</p>:null}
   <div className="admin-workflow-toolbar">
    {cap.CLAIM?<button className="admin-primary-button" onClick={()=>open("CLAIM")} disabled={controller.busy}>Assumir diagnóstico</button>:null}
    {cap.SET_STATUS && w.allowedStatuses.length?<button onClick={()=>open("SET_STATUS")} disabled={controller.busy}>Alterar status</button>:null}
    {cap.SET_PRIORITY?<button onClick={()=>open("SET_PRIORITY")} disabled={controller.busy}>Prioridade</button>:null}
    {cap.ASSIGN || cap.ARCHIVE || cap.REOPEN?<details className="admin-workflow-menu"><summary>Mais ações</summary><div>
     {cap.ASSIGN?<button onClick={()=>open("ASSIGN")}>{w.assignee?"Reatribuir responsável":"Atribuir responsável"}</button>:null}
     {cap.UNASSIGN && w.assignee?<button onClick={()=>open("UNASSIGN")}>Remover responsável</button>:null}
     {cap.ARCHIVE?<button onClick={()=>open("ARCHIVE")}>Arquivar diagnóstico</button>:null}
     {cap.REOPEN?<button onClick={()=>open("REOPEN")}>Reabrir diagnóstico</button>:null}
    </div></details>:null}
   </div>
  </section>:null}
  {placement==="qualification"?<div className="admin-workflow-toolbar">
   {w.qualificationStale?<p role="status">A qualificação precisa ser recalculada com os dados vigentes.</p>:null}
   {cap.RECALCULATE_QUALIFICATION?<button onClick={()=>open("RECALCULATE_QUALIFICATION")} disabled={controller.busy}>Recalcular qualificação</button>:null}
  </div>:null}
  {placement==="briefing"?<div className="admin-workflow-toolbar">
   {w.briefingStale?<p role="status">O briefing está desatualizado.</p>:null}
   {cap.REGENERATE_BRIEFING?<button onClick={()=>open("REGENERATE_BRIEFING")} disabled={controller.busy}>Regenerar briefing</button>:null}
   {w.qualificationStale?<p>Recalcule a qualificação antes de regenerar o briefing.</p>:null}
  </div>:null}
  {placement==="flags"?<section aria-label="Ações humanas sobre flags"><h2>Ações sobre flags</h2>
   {flags.map(f=>{
    const restricted=f.severity==="S3" || ["SECURITY","CONSENT"].includes(f.category);
    const allowed=(!restricted || session?.role==="ADMIN") && (f.status==="ACTIVE"?cap.RESOLVE_FLAG:cap.REOPEN_FLAG);
    return <div className="admin-workflow-flag-action" key={f.id}><span>{f.displayName} · {f.severity} · {f.status==="ACTIVE"?"Ativa":"Resolvida"}</span>
     {allowed?<button disabled={controller.busy} onClick={()=>open(f.status==="ACTIVE"?"RESOLVE_FLAG":"REOPEN_FLAG",f)}>{f.status==="ACTIVE"?"Resolver":"Reabrir"}</button>:restricted?<span>Revisão administrativa restrita</span>:null}</div>;
   })}
  </section>:null}
  {action?<AdminWorkflowDialog controller={controller} title={titles[action]??"Confirmar alteração"} description={description} onClose={()=>setAction(null)} onSubmit={submit} submitLabel={titles[action]??"Confirmar"}>
   {action==="SET_STATUS"?<><label htmlFor="workflow-status">Novo status</label><select id="workflow-status" required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecione</option>{w.allowedStatuses.map(s=><option key={s} value={s}>{reviewLabels[s]}</option>)}</select></>:null}
   {action==="SET_PRIORITY"?<><label htmlFor="workflow-priority">Nova prioridade</label><select id="workflow-priority" required value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Selecione</option>{ADMIN_PRIORITIES.filter(p=>session?.role==="ADMIN" || p!=="URGENT").map(p=><option key={p} value={p}>{priorityLabels[p]}</option>)}</select></>:null}
   {action==="ASSIGN"?<><label htmlFor="assignee-search">Buscar responsável</label><input id="assignee-search" value={search} onChange={e=>{setSearch(e.target.value);setDirectoryPage(0);}} maxLength={150}/>
    <label htmlFor="workflow-assignee">Responsável ativo</label><select id="workflow-assignee" value={selected} required onChange={e=>setSelected(e.target.value)}><option value="">Selecione</option>{assignees.map(a=><option key={a.id} value={a.id}>{a.display_name}</option>)}</select>{directoryMore?<button type="button" onClick={()=>setDirectoryPage(page=>page+1)}>Carregar mais responsáveis</button>:null}{directoryError?<p role="alert">{directoryError}</p>:null}</>:null}
   {flag?<p>{flag.displayName} · {flag.severity}</p>:null}
   {!["CLAIM","RECALCULATE_QUALIFICATION","REGENERATE_BRIEFING"].includes(action)?<><label htmlFor="workflow-reason">Motivo{reasonRequired?" (obrigatório)":""}</label><textarea id="workflow-reason" value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={1000} required={reasonRequired} aria-describedby="workflow-reason-help" aria-invalid={controller.error?.code==="VALIDATION_ERROR"}/><small id="workflow-reason-help">Entre 10 e 1.000 caracteres quando informado.</small></>:null}
   {flag?<><label htmlFor="workflow-support">Evidência ou justificativa de verificação</label><textarea id="workflow-support" value={support} onChange={e=>setSupport(e.target.value)} minLength={10} maxLength={500} required/></>:null}
  </AdminWorkflowDialog>:null}
 </>;
}

