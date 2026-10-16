import { calculateQualification,determineInternalRoute,evaluateFlags,DeterministicInterviewAIService } from "./generated/domain-runtime.js";
import { flattenStructuredData,missingCriticalPaths } from "./interview.ts";
import { resolveAdminEffectiveData, type AdminSource } from "./admin-effective-data.ts";

export async function buildAdminArtifact(source:AdminSource,fingerprint:string,kind:"RECALCULATE_QUALIFICATION"|"REGENERATE_BRIEFING"){
 const resolved=resolveAdminEffectiveData(source);
 const context=resolved.context;
 const snapshot={
  schemaVersion:"adm04.1",analysisRevision:source.analysisRevision,sourceFingerprint:fingerprint,
  diagnosticVersion:source.diagnostic.row_version,
  currentAssessment:source.assessment?{id:source.assessment.id,version:source.assessment.version}:null,
  currentBriefing:source.briefing?{id:source.briefing.id,version:source.briefing.version}:null,
  structuredData:Object.fromEntries(Object.entries(resolved.flat).filter(([key])=>!["lead.name","lead.email","lead.phone"].includes(key))),
  evidence:resolved.evidence.map(e=>({id:e.evidenceId,path:e.path,sourceType:e.sourceType,confidence:e.confidence})),
  overrides:source.overrides.map(o=>({id:o.id,version:o.version,operation:o.operation})),
  hypothesisReviews:source.hypothesisReviews.map(h=>({id:h.id,status:h.status,sourceHash:h.source_hash})),
  consentIds:source.consents.map(c=>(c as unknown as Record<string,unknown>).id),
  qualificationPolicyVersion:"1.0.0",
 };
 const assessment=calculateQualification({structuredData:context.structuredData,evidence:resolved.evidence});
 const flags=evaluateFlags({state:{...context,reviewConfirmed:true},assessment});
 const activeFlags:Array<Record<string,unknown>>=source.flags.filter(f=>f.status==="ACTIVE").map(f=>({...f,schedulingEffect:f.scheduling_effect}));
 const route=determineInternalRoute({privacyConsent:context.privacyConsent,commercialConsent:context.commercialConsent,assessment,flags:[...activeFlags,...flags]});
 const effectiveRoute=[...activeFlags,...flags].some(flag=>flag.severity==="S3")?"BLOCKED":route.route;
 if(kind==="RECALCULATE_QUALIFICATION"){
  const criterionEvidence=Object.fromEntries(assessment.criteria.map(c=>[c.code,c.evidencePaths.flatMap(path=>{
   const choices=resolved.evidence.filter(e=>e.path===path);
   const current=choices.reduce<(typeof choices)[number]|undefined>((best,e)=>!best || (e.revision??0)>=(best.revision??0)?e:best,undefined);
   return current?.evidenceId && current.confidence>=0.6 && !["AI_INFERENCE","NOT_CONFIRMED"].includes(current.sourceType)?[current.evidenceId]:[];
  })]));
  return {fingerprint,snapshot,assessment,flags,route:effectiveRoute,criterionEvidence};
 }
 // Unverified corrections and inferences are never silently rendered as facts.
 const narrativeData=structuredClone(context.structuredData);
 resolved.fields.filter(f=>!f.verified).forEach(f=>{
  const keys=f.path.split(".");let node:Record<string,unknown>=narrativeData;
  for(const key of keys.slice(0,-1))node=node[key] as Record<string,unknown>;
  if(node)delete node[keys[keys.length-1]];
 });
 const ai=new DeterministicInterviewAIService();
 const flat=flattenStructuredData(narrativeData);
 // Narrative summaries have narrower limits than canonical stored fields.
 // Only this presentation copy is shortened; the snapshot preserves the full input.
 const limits:Record<string,number>={"lead.company":200,"challenge.primaryAffectedArea":100,"challenge.summary":800,"currentProcess.description":1200,"currentProcess.participants":500,"challenge.desiredOutcome":800,"buyingContext.deadline":300};
 for(const [path,limit] of Object.entries(limits))if(typeof flat[path]==="string")flat[path]=(flat[path] as string).slice(0,limit);
 for(const [path,count,width] of [["currentProcess.systems",20,70],["impact.categories",15,90],["buyingContext.decisionMakers",20,38]] as const){
  if(Array.isArray(flat[path]))flat[path]=(flat[path] as unknown[]).slice(0,count).map(value=>String(value).slice(0,width));
 }
 const review=await ai.generateReview({structuredData:flat});
 const briefing=await ai.generateBriefing({structuredData:flat,review,missingCriticalPaths:missingCriticalPaths({...context,structuredData:narrativeData})});
 const recommendedOffer=!source.privacy.contactAllowed || ["BLOCKED","OUT_OF_SCOPE","NO_CONTACT"].includes(effectiveRoute)?"NO_OFFER":
  effectiveRoute==="MANUAL_REVIEW"?"MANUAL_EVALUATION":effectiveRoute==="NURTURE"?"EXPLORATORY_CONVERSATION":"NUMORA_DIAGNOSE";
 return {fingerprint,snapshot,briefing:{...briefing,recommendedOffer},generationMode:"DETERMINISTIC",fallbackUsed:false};
}
export function adminFlagResolutionAllowed(source:AdminSource,flagId:string){
 const flag=source.flags.find(f=>f.id===flagId);if(!flag)return false;
 const without={...source,flags:source.flags.filter(f=>f.id!==flagId)};
 const resolved=resolveAdminEffectiveData(without);
 const assessment=calculateQualification({structuredData:resolved.context.structuredData,evidence:resolved.evidence});
 const flags=evaluateFlags({state:{...resolved.context,reviewConfirmed:true},assessment});
 return !flags.some(f=>f.code===flag.code);
}

