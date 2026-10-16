"use client";
import { useState } from "react";
import { z } from "zod";
import { AdminWorkflowDialog } from "./AdminWorkflowDialog";
import { OVERRIDE_PATHS,OVERRIDE_VALUES,type EffectiveField } from "./workflow-contract";
import type { AdminWorkflowController } from "./useAdminWorkflow";
const fieldLabels:Record<string,string>={"lead.company":"Empresa","lead.role":"Cargo","lead.industry":"Setor","lead.employeeRange":"Porte da empresa","challenge.summary":"Desafio","challenge.process":"Processo afetado","challenge.desiredOutcome":"Resultado esperado","challenge.primaryAffectedArea":"Área afetada","challenge.symptoms":"Sintomas","currentProcess.description":"Descrição do processo","currentProcess.participants":"Participantes","currentProcess.systems":"Sistemas","currentProcess.involvedAreas":"Áreas envolvidas","currentProcess.participantCount":"Número de participantes","currentProcess.manualDependency":"Dependência manual","currentProcess.duplicateDataEntry":"Redigitação de dados","impact.categories":"Impactos","impact.reportedFinancialImpact":"Impacto financeiro reportado","impact.riskOfInaction":"Risco de não agir","buyingContext.priority":"Prioridade declarada","buyingContext.deadline":"Prazo","buyingContext.decisionMakers":"Decisores","buyingContext.processRedesignOpenness":"Abertura para redesenho","technicalContext.dataAvailability":"Disponibilidade de dados","technicalContext.itAvailability":"Disponibilidade de TI","technicalContext.integrationLikely":"Integração provável"};
export function displayEffectiveValue(value:unknown):string{
 if(value===null || value===undefined || value==="")return "Não informado";
 if(typeof value==="boolean")return value?"Sim":"Não";
 return Array.isArray(value)?value.join(", "):typeof value==="object"?JSON.stringify(value):String(value);
}
function OverrideForm({field,controller,onClose}:{field:EffectiveField;controller:AdminWorkflowController;onClose:()=>void}){
 const [value,setValue]=useState(Array.isArray(field.value)?field.value.join("\n"):field.value===null?"":String(field.value));
 const [reason,setReason]=useState("");const [support,setSupport]=useState("");const [verified,setVerified]=useState(false);const [revert,setRevert]=useState(false);
 const path=field.path as keyof typeof OVERRIDE_VALUES;const schema=OVERRIDE_VALUES[path];
 const isArray=schema instanceof z.ZodArray;const isNumber=schema instanceof z.ZodNumber;const isBoolean=schema instanceof z.ZodBoolean;const isEnum=schema instanceof z.ZodEnum;
 const [fieldError,setFieldError]=useState("");
 async function submit(){
  if(revert && field.overrideId){await controller.execute("REVERT_OVERRIDE",{overrideId:field.overrideId,reason});onClose();return;}
  const parsed=schema.safeParse(isArray?value.split("\n").map(s=>s.trim()).filter(Boolean):isNumber?Number(value):isBoolean?value==="true":value);
  if(!parsed.success){setFieldError("Informe um valor válido para este campo.");return;}
  setFieldError("");await controller.execute("CREATE_OVERRIDE",{fieldPath:path,value:parsed.data,verificationStatus:verified?"VERIFIED":"UNVERIFIED",sourceAnswerId:field.sourceAnswerId,reason,evidenceIds:[],evidenceNote:support});onClose();
 }
 return <AdminWorkflowDialog controller={controller} title={revert?"Reverter correção":"Corrigir dado estruturado"} description="A resposta original será preservada. A correção altera apenas o valor utilizado na análise interna." onClose={onClose} onSubmit={submit} submitLabel={revert?"Reverter correção":"Salvar correção"}>
  <p><strong>{fieldLabels[field.path]??field.path}</strong></p><dl className="admin-workflow-values"><div><dt>Valor original permitido</dt><dd>{field.originalValue??"Não informado"}</dd></div><div><dt>Valor estruturado atual</dt><dd>{displayEffectiveValue(field.structuredValue)}</dd></div><div><dt>Override atual</dt><dd>{displayEffectiveValue(field.overrideValue)}</dd></div><div><dt>Valor efetivo</dt><dd>{displayEffectiveValue(field.value)}</dd></div></dl>
  {field.stale?<p role="status">A fonte mudou. A correção anterior está desatualizada e não está sendo aplicada.</p>:null}
  {field.overrideProvenance?<p>Correção v{field.overrideProvenance.version} · {new Date(field.overrideProvenance.createdAt).toLocaleString("pt-BR")} · {field.overrideProvenance.reason}</p>:null}
  {field.overrideId && controller.data?.workflow.capabilities.REVERT_OVERRIDE?<label><input type="checkbox" checked={revert} onChange={e=>setRevert(e.target.checked)}/> Reverter a correção vigente e voltar à base estruturada atual</label>:null}
  {!revert?<><label htmlFor="override-value">Novo valor</label>
   {isEnum?<select id="override-value" value={value} onChange={e=>setValue(e.target.value)} required><option value="">Selecione</option>{schema.options.map(v=><option key={v} value={v}>{v}</option>)}</select>:
    isBoolean?<select id="override-value" value={value} onChange={e=>setValue(e.target.value)} required><option value="">Selecione</option><option value="true">Sim</option><option value="false">Não</option></select>:
    isNumber?<input id="override-value" type="number" value={value} onChange={e=>setValue(e.target.value)} required aria-invalid={Boolean(fieldError)} aria-describedby="override-value-error"/>:
    <textarea id="override-value" value={value} onChange={e=>setValue(e.target.value)} required maxLength={5000} aria-invalid={Boolean(fieldError)} aria-describedby="override-value-error"/>}
   {isArray?<small>Informe um item por linha.</small>:null}<span id="override-value-error" role={fieldError?"alert":undefined}>{fieldError}</span>
   <label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/> Correção verificada pela equipe</label>
   {verified?<><label htmlFor="override-support">Justificativa da verificação</label><textarea id="override-support" value={support} onChange={e=>setSupport(e.target.value)} minLength={10} maxLength={500} required/></>:<p>Correções sem verificação não entram automaticamente na pontuação.</p>}
  </>:null}
  <label htmlFor="override-reason">Motivo</label><textarea id="override-reason" value={reason} onChange={e=>setReason(e.target.value)} minLength={10} maxLength={1000} required/>
 </AdminWorkflowDialog>;
}
export function AdminEffectiveFields({controller}:{controller:AdminWorkflowController}){
 const [selected,setSelected]=useState("challenge.summary");const [open,setOpen]=useState(false);
 if(!controller.data || controller.data.workflow.privacyRestricted)return null;
 const fields=controller.data.fields.filter(f=>OVERRIDE_PATHS.includes(f.path as keyof typeof OVERRIDE_VALUES));const field=fields.find(f=>f.path===selected);
 return <section className="admin-workflow-effective"><h2>Dados internos vigentes</h2><label htmlFor="effective-field">Campo estruturado</label><select id="effective-field" value={selected} onChange={e=>setSelected(e.target.value)}>{fields.map(f=><option key={f.path} value={f.path}>{fieldLabels[f.path]??f.path}</option>)}</select>
  {field?<><p>{displayEffectiveValue(field.value)}</p><small>Origem: {field.source==="OVERRIDE"?"correção interna":field.source==="ORIGINAL"?"resposta original sanitizada":"dado estruturado"} · {field.scorable?"Com evidência pontuável":"Sem evidência pontuável"}</small>
   {field.stale?<p role="status">Há uma correção desatualizada para este campo.</p>:null}
   {controller.data.workflow.capabilities.CREATE_OVERRIDE?<button type="button" onClick={()=>setOpen(true)}>Corrigir dado estruturado</button>:null}
   {open?<OverrideForm key={field.path} field={field} controller={controller} onClose={()=>setOpen(false)}/>:null}
  </>:null}
 </section>;
}

