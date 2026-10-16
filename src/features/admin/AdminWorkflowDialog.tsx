"use client";
import { useEffect,useRef,type ReactNode } from "react";
import type { AdminWorkflowController } from "./useAdminWorkflow";
export function AdminWorkflowDialog({title,description,children,controller,onClose,onSubmit,submitLabel="Confirmar",fieldErrors={}}:{
 title:string;description?:string;children:ReactNode;controller:AdminWorkflowController;onClose:()=>void;onSubmit:()=>Promise<void>;submitLabel?:string;fieldErrors?:Record<string,string>;
}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{
  const trigger=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const dialog=ref.current;dialog?.showModal();
  const initial=dialog?.querySelector<HTMLElement>("input,select,textarea,button");initial?.focus();
  return()=>{dialog?.close();if(trigger?.isConnected)trigger.focus();};
 },[]);
 const error=controller.error;const conflict=error && ["STATE_CONFLICT","STALE_STATE"].includes(error.code);
 return <dialog ref={ref} className="admin-workflow-dialog" aria-labelledby="workflow-dialog-title" aria-describedby={description?"workflow-dialog-description":undefined} onClose={()=>{if(!ref.current?.open)onClose();}} onKeyDown={event=>{
  if(event.key!=="Tab")return;
  const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,[tabindex]')).filter(control=>!control.matches(':disabled,[tabindex="-1"]') && control.getClientRects().length>0);
  const first=controls[0],last=controls.at(-1);
  if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
  else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
 }}>
  <form onSubmit={event=>{event.preventDefault();void onSubmit().catch(()=>undefined);}}>
   <header><h2 id="workflow-dialog-title">{title}</h2><button type="button" aria-label="Fechar" onClick={onClose}>×</button></header>
   {description?<p id="workflow-dialog-description">{description}</p>:null}
   <fieldset disabled={controller.busy} className="admin-workflow-fields">{children}</fieldset>
   {Object.keys(fieldErrors).length?<p role="alert">Revise os campos indicados.</p>:null}
   {error?<p className="admin-workflow-error" role="alert">{error.message}{error.referenceCode?<small> Referência: {error.referenceCode}</small>:null}</p>:null}
   <footer><button type="button" onClick={onClose}>Cancelar</button>
    {conflict?<button type="button" onClick={()=>void controller.reload()}>Recarregar dados</button>:null}
    <button className="admin-primary-button" type="submit" disabled={controller.busy || Boolean(conflict)}>{controller.busy?"Processando…":submitLabel}</button>
   </footer>
  </form>
 </dialog>;
}

