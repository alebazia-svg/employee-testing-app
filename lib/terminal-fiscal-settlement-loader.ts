import 'server-only';
import {readOneCRuntimeEnv} from './one-c-env';
import {compareFiscalSettlement} from './terminal-fiscal-settlement';
export async function loadFiscalSettlementSource(day:string) {
 const today=new Date(Date.now()+10800000).toISOString().slice(0,10);
 const to=[new Date(Date.parse(day)+4*86400000).toISOString().slice(0,10),today].sort()[0];
 const env=readOneCRuntimeEnv();let raw:unknown=null;
 if(env.baseUrl&&env.user&&env.password&&day<=to)try {
  const q=new URLSearchParams({account:'Т-Банк КБР',date_from:day,date_to:to,limit:'500'});
  const r=await fetch(`${env.baseUrl}/bank-exchange-statement-operations?${q}`,{headers:{Accept:'application/json',Authorization:`Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}`},cache:'no-store',signal:AbortSignal.timeout(20000)});
  if(r.ok)raw=await r.json();
 }catch {/* Missing source cannot produce a balanced result. */}
 return {raw,from:day,to};
}

export async function loadFiscalSettlement(day:string,fiscalKopecks:number,fiscalComplete:boolean) {
 const source=await loadFiscalSettlementSource(day);
 return compareFiscalSettlement(source.raw,{from:source.from,to:source.to,fiscalKopecks,fiscalComplete});
}
