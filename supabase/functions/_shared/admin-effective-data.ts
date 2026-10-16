import { createInterviewContext, flattenStructuredData, getCatalogQuestion, parseClarificationCode, type StoredAnswer, type StoredEvidence } from "./interview.ts";
import { OVERRIDE_PATHS, type EffectiveField } from "./admin-workflow-contract.ts";
import type { Json } from "./types.ts";

type Row=Record<string,unknown>;
export type AdminSource={
 diagnostic:Row; analysisRevision:number; privacy:{privacyRestricted:boolean;contactAllowed:boolean};
 lead:Row|null;company:Row|null;session:Row|null;
 answers:Array<StoredAnswer & {is_current:boolean;redacted:boolean;confirmed:boolean;source_type:string}>;
 evidence:Array<StoredEvidence & {id:string;redacted:boolean;source_locator?:string|null;confirmed:boolean}>;
 consents:Array<{consent_type:string;decision:string;policy_version:string}>;
 flags:Row[];overrides:Row[];hypothesisReviews:Row[];briefing:Row|null;assessment:Row|null;
};
const json=(value:unknown):Json=>value===undefined?null:value as Json;
export function canonicalJson(value:unknown):string {
 if(Array.isArray(value))return "["+value.map(canonicalJson).join(",")+"]";
 if(value!==null && typeof value==="object")return "{"+Object.keys(value).sort().map(key=>JSON.stringify(key)+":"+canonicalJson((value as Row)[key])).join(",")+"}";
 return JSON.stringify(value)??"null";
}
export function setInternalPath(data:Row,path:string,value:unknown){
 const keys=path.split(".");
 if(keys.some(key=>!key || ["__proto__","prototype","constructor"].includes(key)))throw new Error("VALIDATION_ERROR");
 let node=data;
 for(const key of keys.slice(0,-1)){
  if(!node[key] || typeof node[key]!=="object" || Array.isArray(node[key]))node[key]={};
  node=node[key] as Row;
 }
 node[keys[keys.length-1]]=value;
}
export function resolveAdminEffectiveData(source:AdminSource){
 const safeAnswers=source.answers.filter(answer=>answer.validation_status==="VALID" && !answer.redacted && answer.confirmed && !["AI_INFERENCE","NOT_CONFIRMED"].includes(answer.source_type));
 const context=createInterviewContext({
  diagnostic:{status:String(source.diagnostic.status),created_at:String(source.diagnostic.created_at)},
  session:{expires_at:String(source.session?.expires_at??source.diagnostic.created_at)},
  answers:safeAnswers,evidence:source.evidence.filter(e=>!e.redacted),
  consents:source.consents,lead:source.lead,company:source.company,
  signals:source.flags.filter(f=>f.status==="ACTIVE" && (f.category==="SECURITY" || f.source==="MANUAL")).map(f=>String(f.code)),
 });
 context.privacyConsent=!source.privacy.privacyRestricted;
 context.commercialConsent=source.privacy.contactAllowed;
 const base=flattenStructuredData(context.structuredData);
 const evidence=context.evidence.map(item=>{
  const row=source.evidence.findLast(e=>e.answer_id===item.answerId && e.target_path===item.path && e.text===item.evidenceText && !e.redacted);
  return {...item,evidenceId:row?.id??null};
 });
 const fields:EffectiveField[]=[];
 const effectiveEvidence=[...evidence];
 for(const path of new Set([...Object.keys(base),...OVERRIDE_PATHS])){
  let answer:AdminSource["answers"][number]|undefined;
  for(const candidate of safeAnswers){
   const related=parseClarificationCode(candidate.question_code)?.relatedQuestionId??candidate.question_code;
   const question=getCatalogQuestion(related);
   if(candidate.normalized_value && typeof candidate.normalized_value==="object" && path in candidate.normalized_value || question?.targetPaths[0]===path)answer=candidate;
  }
  const candidates=evidence.filter(e=>e.path===path);
  const current=candidates.reduce<(typeof evidence)[number]|undefined>((latest,e)=>!latest || (e.revision??0)>=(latest.revision??0)?e:latest,undefined);
  const field:EffectiveField={
   path,value:json(base[path]),structuredValue:json(base[path]),originalValue:answer?.display_value??null,
   source:answer && !(answer.normalized_value && typeof answer.normalized_value==="object" && path in answer.normalized_value)?"ORIGINAL":"STRUCTURED",
   sourceAnswerId:answer?.id??null,overrideId:null,overrideValue:null,verified:Boolean(answer || path.startsWith("lead.")),
   scorable:Boolean(current && current.confidence>=0.6 && !["AI_INFERENCE","NOT_CONFIRMED"].includes(current.sourceType)),
   confidence:current?.confidence??0,stale:false,overrideProvenance:null,
  };
  if(current && ["AI_INFERENCE","NOT_CONFIRMED"].includes(current.sourceType))field.verified=false;
  const override=source.overrides.find(o=>o.field_path===path && o.operation==="SET");
  if(override){
   field.overrideProvenance={version:Number(override.version),authorProfileId:String(override.author_profile_id),createdAt:String(override.created_at),reason:String(override.reason),verificationStatus:String(override.verification_status),evidenceIds:(override.evidence_ids??[]) as string[],evidenceNote:override.evidence_note as string|null};
   field.overrideId=String(override.id);field.overrideValue=json(override.new_value);
   const matches=(override.source_answer_id??null)===field.sourceAnswerId && canonicalJson(override.base_structured_value)===canonicalJson(base[path]??null);
   field.stale=!matches;
   if(matches){
    field.source="OVERRIDE";field.value=json(override.new_value);field.overrideId=String(override.id);
    field.verified=override.verification_status==="VERIFIED";field.confidence=field.verified?1:0;
    const proof=source.evidence.find(e=>e.source_locator==="admin_override:"+override.id && !e.redacted);
    field.scorable=field.verified && Boolean(proof);
    setInternalPath(context.structuredData,path,field.value);
    for(let i=effectiveEvidence.length-1;i>=0;i--)if(effectiveEvidence[i].path===path)effectiveEvidence.splice(i,1);
    if(field.scorable && proof)effectiveEvidence.push({path,sourceType:"SYSTEM_DERIVED",confidence:1,
     answerId:proof.id,questionId:"ADMIN_OVERRIDE",evidenceText:proof.text,revision:Number(override.version),
     isCurrent:true,evidenceId:proof.id});
   }
  }
  fields.push(field);
 }
 context.evidence=effectiveEvidence;
 return {context,fields,evidence:effectiveEvidence,flat:flattenStructuredData(context.structuredData)};
}

