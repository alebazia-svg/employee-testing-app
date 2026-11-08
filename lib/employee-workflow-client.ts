'use client';
import { auditExperience,experienceAttempt } from '@/components/EmployeeExperienceAudit';
import type { workflowActions,workflowStages,WorkflowMetadata } from './employee-experience-policy';
const flows=new Map<string,string>();
const draftFlows=new Map<string,string>(),requestFlows=new Map<string,string>();
/** Deliberate semantic actions only. No interception or replay of business requests. */
export function workflowEvent(action:keyof typeof workflowActions,stage:keyof typeof workflowStages,taskId?:number,period?:string,ref?:string,metadata:WorkflowMetadata={}){
 try{
  const key=`${action}:${taskId||''}:${period||''}:${ref||''}:${metadata.operation||''}`;
  if(stage==='opened'||!flows.has(key))flows.set(key,experienceAttempt());
  if(!ref&&metadata.operation&&stage==='opened')draftFlows.set(`${action}:${metadata.operation}`,flows.get(key)!);
  auditExperience({target:'workflow',action,stage,attemptId:flows.get(key)!,...(taskId?{taskId}:{}),...(period?{period}:{}),...(ref?{ref}:{}),...(metadata.operation?{operation:metadata.operation}:{}),...(metadata.failure?{failure:metadata.failure}:{})});
 }catch{}
}

export function workflowRequestEvent(action:keyof typeof workflowActions,stage:keyof typeof workflowStages,metadata:WorkflowMetadata={}){try{
 const requestId=metadata.attemptId||experienceAttempt();
 if(stage==='submitted'&&!metadata.ref&&metadata.operation){const draft=draftFlows.get(`${action}:${metadata.operation}`);if(draft)requestFlows.set(requestId,draft);}
 const attemptId=requestFlows.get(requestId)||requestId;
 auditExperience({target:'workflow',action,stage,attemptId,...(metadata.ref?{ref:metadata.ref}:{}),...(metadata.operation?{operation:metadata.operation}:{}),...(metadata.failure?{failure:metadata.failure}:{})});
 if(stage==='response_received'||stage==='request_failed')requestFlows.delete(requestId);
}catch{}}

/** Same JSON parse, with a bounded diagnostic if an otherwise successful response is unreadable. */
export async function workflowJson(response:Response,action:keyof typeof workflowActions,ref:string|undefined,operation:NonNullable<WorkflowMetadata['operation']>){try{return await response.json();}catch(error){workflowEvent(action,'error_shown',undefined,undefined,ref,{operation,failure:'response'});throw error;}}
