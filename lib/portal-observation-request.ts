import type { AppObservation } from './portal-app-observation';

type Report = Record<string,unknown> & {app?:AppObservation};
/** Optional new telemetry must not break the original journal during rollback.
 * Retry only a rejected format, never an accepted business request. */
export async function postPortalObservation(payload:Report,signal:AbortSignal,legacyUi=false,request:typeof fetch=fetch, foregroundAt=0) {
 const withoutUi=()=>{if(!payload.app)return payload;const {ui:_,...app}=payload.app;return {...payload,app};};
 const send=(value:Report)=>request('/api/auth/activity',{method:'POST',headers:{'Content-Type':'application/json', ...(foregroundAt ? {'X-Portal-Foreground-At': String(foregroundAt)} : {})},body:JSON.stringify(value),signal});
 let response=await send(legacyUi?withoutUi():payload);
 if(!legacyUi&&response.status===400&&payload.app?.ui){response=await send(withoutUi());legacyUi=true;}
 return {response,legacyUi};
}
