import {workflowFailures} from './employee-experience-policy';
import type { workflowActions,workflowStages,WorkflowMetadata } from './employee-experience-policy';
type Action=keyof typeof workflowActions;
export type ObservedWorkflow={action:Action;ref?:string;operation:NonNullable<WorkflowMetadata['operation']>};
const safeRef=(s:string|undefined)=>s&&/^[a-zA-Z0-9_-]{1,80}$/.test(s)?s:undefined;
/** Explicit routes only. Never read request bodies, answers, query strings or arbitrary error text. */
export function observedRequest(input:RequestInfo|URL,init?:RequestInit):ObservedWorkflow|null{
 const method=(init?.method||(typeof Request!=='undefined'&&input instanceof Request?input.method:'GET')).toUpperCase();
 if(!['POST','PATCH','PUT','DELETE'].includes(method))return null;
 const origin=typeof window==='undefined'?'https://portal.invalid':window.location.origin;
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,origin);
 if(url.origin!==origin)return null;
 const path=url.pathname;
 const workday:Record<string,ObservedWorkflow>={'/api/employee/workday/start-intent':{action:'qr',operation:'workday_qr'},'/api/employee/workday/change-shift':{action:'shift_change',operation:'workday_shift'},'/api/employee/workday/deviations':{action:'deviation',operation:'workday_deviation'},'/api/employee/workday/close-exception':{action:'close_request',operation:'workday_close_request'},'/api/employee/workday/cash-encashment-exception':{action:'encashment_request',operation:'workday_encashment_request'}};
 if(workday[path])return workday[path];
 let m=path.match(/^\/api\/procurement\/payment-plans(?:\/([a-zA-Z0-9_-]{1,80})(?:\/(schedule|receipts|requisites|qr-request|documents)(?:\/[a-zA-Z0-9_-]{1,80})?)?)?$/);
 if(m){const part=m[2];return {action:['receipts','requisites','qr-request','documents'].includes(part)?'procurement_receipt':'procurement_payment',ref:m[1]==='batch'?undefined:safeRef(m[1]),operation:part==='receipts'?'receipt_upload':part==='requisites'?'requisites_save':part==='qr-request'?'qr_request':part==='documents'?'document_change':part==='schedule'?'payment_schedule':m[1]&&m[1]!=='batch'?'payment_edit':'payment_create'};}
 if(path==='/api/procurement/delivery')return {action:'procurement_delivery',operation:'delivery_request'};
 m=path.match(/^\/api\/attestations\/([1-9]\d{0,8})\/(start|progress|finish)$/);
 if(m)return {action:'learning',ref:m[1],operation:m[2]==='start'?'learning_start':m[2]==='finish'?'learning_finish':'learning_progress'};
 m=path.match(/^\/api\/employee\/payroll\/day-reviews(?:\/([a-zA-Z0-9_-]{1,80}))?$/);
 if(m)return {action:'salary_review',ref:m[1]==='batch'?undefined:safeRef(m[1]),operation:method==='DELETE'?'salary_cancel':'salary_send'};
 return null;
}
export function observedRequestAction(input:RequestInfo|URL,init?:RequestInit):Action|null{return observedRequest(input,init)?.action||null;}
export function requestFailure(status:number):NonNullable<WorkflowMetadata['failure']>{return [400,422].includes(status)?'validation':status===409?'conflict':[401,403].includes(status)?'access':status===404?'missing':status>=500?'unavailable':'request';}
export function observedEmployeeRequest(request:typeof fetch,audit:(action:Action,stage:keyof typeof workflowStages,metadata?:WorkflowMetadata)=>void):typeof fetch{
 return async(input,init)=>{
  let flow:ObservedWorkflow|null=null,metadata:WorkflowMetadata={};
  try{flow=observedRequest(input,init);if(flow){metadata={...flow,attemptId:typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():`request-${Date.now()}-${Math.random().toString(36).slice(2,12)}`};delete (metadata as Record<string,unknown>).action;audit(flow.action,'submitted',metadata);}}catch{}
  try{const response=await request(input,init);try{if(flow){const ref=response.ok?safeRef(response.headers.get('X-Portal-Activity-Ref')||undefined):undefined;const supplied=response.headers.get('X-Portal-Activity-Failure');const failure=supplied&&Object.hasOwn(workflowFailures,supplied)?supplied as NonNullable<WorkflowMetadata['failure']>:requestFailure(response.status);audit(flow.action,response.ok?'response_received':'request_failed',{...metadata,...(ref?{ref}:{}),...(!response.ok?{failure}:{})});}}catch{}return response;}
  catch(error){try{if(flow)audit(flow.action,'request_failed',{...metadata,failure:error instanceof Error&&error.name==='TimeoutError'?'timeout':error instanceof Error&&error.name==='AbortError'?'interrupted':'network'});}catch{}throw error;}
 };
}
