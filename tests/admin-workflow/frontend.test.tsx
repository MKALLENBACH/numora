import test from "node:test";
import assert from "node:assert/strict";
import React,{act} from "react";
import {JSDOM} from "jsdom";
import type {AdminSession} from "../../src/features/admin/types";
import type {AdminWorkflowController} from "../../src/features/admin/useAdminWorkflow";
import type {WorkflowSummary} from "../../src/features/admin/workflow-contract";

test("frontend preserves retries, drafts, refresh, conflicts, and clears identity on logout",async()=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:"http://localhost:3000"});
 Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,HTMLTextAreaElement:dom.window.HTMLTextAreaElement,Event:dom.window.Event,React,IS_REACT_ACT_ENVIRONMENT:true});
 process.env.NEXT_PUBLIC_SUPABASE_URL="https://fixture.supabase.co";process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY="fixture-public-key";
 const {createRoot}=await import("react-dom/client");
 const {getAdminSupabaseBrowserClient}=await import("../../src/lib/supabase/browser");
 const {adminClient}=await import("../../src/features/admin/admin-client");
 const {AdminAuthProvider,useAdminAuth}=await import("../../src/features/admin/AdminAuthProvider");
 const {useAdminWorkflow}=await import("../../src/features/admin/useAdminWorkflow");
 const {AdminInternalNotes}=await import("../../src/features/admin/AdminInternalNotes");
 const {WORKFLOW_COMMANDS}=await import("../../src/features/admin/workflow-contract");
 const user:AdminSession={userId:crypto.randomUUID(),profileId:crypto.randomUUID(),displayName:"Fixture",email:"fixture@example.invalid",role:"ADMIN",isActive:true};
 const diagnosticId=crypto.randomUUID();
 let rv=3;let failure="TIMEOUT";let authEvent:(event:string,session:unknown)=>void=()=>undefined;
 const client=getAdminSupabaseBrowserClient()!;
 client.auth.getSession=async()=>({data:{session:{access_token:"fixture-token"}},error:null}) as Awaited<ReturnType<typeof client.auth.getSession>>;
 client.auth.onAuthStateChange=((callback:typeof authEvent)=>{authEvent=callback;return {data:{subscription:{unsubscribe(){}}}};}) as typeof client.auth.onAuthStateChange;
 const originalRestore=adminClient.restore;const originalLogout=adminClient.logout;
 adminClient.restore=async()=>user;adminClient.logout=async()=>undefined;
 const summary=():WorkflowSummary=>({diagnosticId,status:"UNDER_REVIEW",priority:"NORMAL",assignee:null,rowVersion:rv,diagnosticVersion:1,analysisRevision:1,decisionStale:false,qualificationStale:false,briefingStale:false,contactAllowed:true,privacyRestricted:false,archivedAt:null,allowedStatuses:[],capabilities:Object.fromEntries(WORKFLOW_COMMANDS.map(c=>[c,true])) as WorkflowSummary["capabilities"]});
 const requests:Array<Record<string,unknown>>=[];const invalidations:string[][]=[];const originalFetch=globalThis.fetch;
 globalThis.fetch=async(_input,init)=>{
  const body=JSON.parse(String(init?.body));
  if(body.operation==="READ")return Response.json({data:{workflow:summary(),fields:[],notes:[],nextCursor:null,hypotheses:[]},error:null});
  requests.push(body);
  if(failure==="TIMEOUT")throw new DOMException("timeout","TimeoutError");
  if(failure==="NETWORK")throw new TypeError("network unavailable");
  if(failure==="CONFLICT")return Response.json({data:null,error:{code:"STATE_CONFLICT",message:"Recarregue os dados."}},{status:409});
  rv++;return Response.json({data:{commandId:body.clientRequestId,replayed:false,workflow:summary(),entityId:crypto.randomUUID(),entityVersion:null,invalidatedSections:["NOTES","AUDIT"]},error:null});
 };
 let controller:AdminWorkflowController;let auth:ReturnType<typeof useAdminAuth>;
 function Harness(){auth=useAdminAuth();controller=useAdminWorkflow(diagnosticId,sections=>invalidations.push(sections));return auth.status==="authenticated"?<AdminInternalNotes controller={controller}/>:<p>Sem sessão</p>;}
 const root=createRoot(document.getElementById("root")!);
 const settle=async()=>{await act(async()=>{await new Promise(resolve=>setTimeout(resolve,20));});};
 try{
  await act(async()=>root.render(<AdminAuthProvider><Harness/></AdminAuthProvider>));await settle();await settle();
  assert.ok(controller!.data);
  const payload={category:"GENERAL",body:"Nota mantida após falha."};
  await act(async()=>{await assert.rejects(controller!.execute("ADD_NOTE",payload),error=>(error as {code:string}).code==="REQUEST_TIMEOUT");});
  failure="NETWORK";
  await act(async()=>{await assert.rejects(controller!.execute("ADD_NOTE",payload),error=>(error as {code:string}).code==="NETWORK_ERROR");});
  assert.equal(requests[0].clientRequestId,requests[1].clientRequestId);assert.equal(requests[0].expectedReviewVersion,3);
  await act(async()=>{await assert.rejects(controller!.execute("ADD_NOTE",{...payload,body:"Conteúdo alterado"}));});
  assert.notEqual(requests[1].clientRequestId,requests[2].clientRequestId);
  failure="CONFLICT";
  await act(async()=>{await assert.rejects(controller!.execute("ADD_NOTE",payload));});
  assert.equal(controller!.error?.code,"STATE_CONFLICT");
  await act(async()=>{await controller!.reload();});failure="";
  await act(async()=>{await controller!.execute("ADD_NOTE",payload);});
  assert.notEqual(requests[3].clientRequestId,requests[4].clientRequestId);assert.deepEqual(invalidations,[["NOTES","AUDIT"]]);
  const textarea=document.getElementById("note-body") as HTMLTextAreaElement;
  await act(async()=>{
   Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,"value")!.set!.call(textarea,"Rascunho após refresh válido");
   textarea.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
  });
  await act(async()=>{await auth!.refresh();});await settle();
  assert.equal((document.getElementById("note-body") as HTMLTextAreaElement).value,"Rascunho após refresh válido");
  await act(async()=>{authEvent("TOKEN_REFRESHED",null);});await settle();
  assert.equal((document.getElementById("note-body") as HTMLTextAreaElement).value,"Rascunho após refresh válido");
  await act(async()=>{authEvent("SIGNED_OUT",null);});
  assert.equal(document.getElementById("note-body"),null);assert.match(document.body.textContent??"",/Sem sessão/);
 }finally{
  await act(async()=>root.unmount());await client.auth.stopAutoRefresh();(client.auth as unknown as {broadcastChannel:BroadcastChannel|null}).broadcastChannel?.close();globalThis.fetch=originalFetch;adminClient.restore=originalRestore;adminClient.logout=originalLogout;dom.window.close();
 }
});
