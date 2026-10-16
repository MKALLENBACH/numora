"use client";
import { useState } from "react";
import { NOTE_CATEGORIES } from "./workflow-contract";
import type { AdminWorkflowController } from "./useAdminWorkflow";
const labels:Record<string,string>={GENERAL:"Geral",COMMERCIAL:"Comercial",TECHNICAL:"Técnica",RISK:"Risco",FOLLOW_UP:"Acompanhamento",DECISION:"Decisão"};
export function AdminInternalNotes({controller}:{controller:AdminWorkflowController}){
 const [body,setBody]=useState("");const [category,setCategory]=useState("GENERAL");
 if(controller.loading && !controller.data)return <p role="status">Carregando notas…</p>;
 if(!controller.data)return <div role="alert"><p>{controller.error?.message}</p><button onClick={()=>void controller.reload()}>Tentar novamente</button></div>;
 if(controller.data.workflow.privacyRestricted)return <p>Conteúdo interno restrito por privacidade.</p>;
 return <section className="admin-workflow-notes" aria-labelledby="internal-notes-title">
  <h2 id="internal-notes-title">Notas internas</h2>
  {controller.data.workflow.capabilities.ADD_NOTE?<form onSubmit={event=>{event.preventDefault();void controller.execute("ADD_NOTE",{category,body}).then(()=>setBody("")).catch(()=>undefined);}}>
   <label htmlFor="note-category">Categoria</label><select id="note-category" value={category} onChange={e=>setCategory(e.target.value)} disabled={controller.busy}>{NOTE_CATEGORIES.map(c=><option key={c} value={c}>{labels[c]}</option>)}</select>
   <label htmlFor="note-body">Nota interna</label><textarea id="note-body" value={body} onChange={e=>setBody(e.target.value)} minLength={1} maxLength={4000} required disabled={controller.busy} aria-describedby="note-help note-error" aria-invalid={controller.error?.code==="VALIDATION_ERROR"}/>
   <p id="note-help">{body.length}/4.000 caracteres. A nota não pode ser editada; correções são adicionadas em uma nova nota.</p>
   {controller.error?<p id="note-error" role="alert">{controller.error.message}</p>:<span id="note-error"/>}
   <button className="admin-primary-button" disabled={controller.busy} type="submit">{controller.busy?"Salvando…":"Adicionar nota"}</button>
  </form>:null}
  {!controller.data.notes.length?<p>Nenhuma nota interna registrada</p>:<ol className="admin-workflow-history">{controller.data.notes.map(note=><li key={note.id}><article>
   <header><strong>{labels[note.category]}</strong><span>{note.author}</span><time dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString("pt-BR")}</time></header><p className="admin-preserve-lines">{note.body}</p>
  </article></li>)}</ol>}
  {controller.data.nextCursor?<button onClick={()=>void controller.moreNotes()} disabled={controller.busy}>Carregar notas anteriores</button>:null}
 </section>;
}

