"use client";
import { useState } from "react";
import { AdminWorkflowDialog } from "./AdminWorkflowDialog";
import type { AdminWorkflowController } from "./useAdminWorkflow";
import type { WorkflowReadResult } from "./workflow-contract";
type Hypothesis=WorkflowReadResult["hypotheses"][number];
export function AdminHypothesisReview({controller}:{controller:AdminWorkflowController}){
 const [selected,setSelected]=useState<Hypothesis|null>(null);const [decision,setDecision]=useState<"CONFIRMED"|"REJECTED">("CONFIRMED");const [reason,setReason]=useState("");const [support,setSupport]=useState("");
 if(!controller.data || controller.data.workflow.privacyRestricted || !controller.data.hypotheses.length)return null;
 async function submit(){if(!selected)return;await controller.execute("REVIEW_HYPOTHESIS",{sourceKind:selected.sourceKind,sourceId:selected.sourceId,hypothesisIndex:selected.hypothesisIndex,sourceHash:selected.sourceHash,status:decision,reason,evidenceIds:[],evidenceNote:support});setSelected(null);}
 return <section aria-label="Revisão humana de hipóteses"><h2>Revisão de hipóteses</h2><p>A revisão humana não altera automaticamente a pontuação.</p>
  {controller.data.hypotheses.map(h=><article key={h.sourceKind+h.sourceId+h.hypothesisIndex} className="admin-workflow-hypothesis">
   <p>{h.text}</p><strong>{h.status==="PENDING"?"Hipótese não confirmada":h.status==="CONFIRMED"?"Confirmada por revisão humana":"Hipótese rejeitada"}</strong>
   {h.author?<p>{h.author}: {h.reason}</p>:null}
   {controller.data?.workflow.capabilities.REVIEW_HYPOTHESIS?<div className="admin-workflow-toolbar">{(["CONFIRMED","REJECTED"] as const).map(d=><button key={d} disabled={controller.busy || h.status===d} onClick={()=>{setSelected(h);setDecision(d);setReason("");setSupport("");}}>{d==="CONFIRMED"?"Confirmar":"Rejeitar"}</button>)}</div>:null}
  </article>)}
  {selected?<AdminWorkflowDialog controller={controller} title={decision==="CONFIRMED"?"Confirmar hipótese":"Rejeitar hipótese"} description="A decisão ficará registrada com sua autoria e motivo. Ela não transforma esta hipótese em fato pontuável." onClose={()=>setSelected(null)} onSubmit={submit}>
   <p>{selected.text}</p><label htmlFor="hypothesis-reason">Motivo</label><textarea id="hypothesis-reason" value={reason} onChange={e=>setReason(e.target.value)} required minLength={10} maxLength={1000}/>
   {decision==="CONFIRMED"?<><label htmlFor="hypothesis-support">Evidência ou justificativa da confirmação</label><textarea id="hypothesis-support" value={support} onChange={e=>setSupport(e.target.value)} required minLength={10} maxLength={500}/></>:null}
  </AdminWorkflowDialog>:null}
 </section>;
}

