import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,rename,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createKkmCloseReportJournal} from './kkm-close-report-journal';
import {readOneCRuntimeEnv} from './one-c-env';
import {loadPlatformaOfdZReports,type PlatformaOfdZReport,type SourceSnapshot} from './terminal-fiscal-sources';

type Input=Parameters<typeof loadPlatformaOfdZReports>[0];
export type KkmCloseReportSnapshot=SourceSnapshot<PlatformaOfdZReport> & {fromCache?:boolean;storedEvidence?:boolean;liveReadComplete?:boolean;liveErrorCode?:string};
type Snapshot=KkmCloseReportSnapshot;
export function createKkmCloseReportCache(directory:string,now=()=>Date.now()) {
 const location=(input:Input)=>path.join(directory,createHash('sha256').update(JSON.stringify(input)).digest('hex')+'.json');
 const valid=(input:Input,value:Snapshot)=>value?.complete===true&&Array.isArray(value.data)&&value.data.length>0
  &&Number.isFinite(Date.parse(value.checkedAt))&&Date.parse(value.checkedAt)<=now()&&now()-Date.parse(value.checkedAt)<=75000
  &&value.data.every(r=>r.kktRegistrationNumber===input.kktRegistrationNumber&&r.fiscalDriveNumber&&r.shiftNumber
   &&Date.parse(r.openedAt)<=Date.parse(r.closedAt)&&Date.parse(r.closedAt)>=Date.parse(input.from)&&Date.parse(r.closedAt)<Date.parse(input.to));
 return {
  async read(input:Input):Promise<Snapshot|null>{try{const saved=JSON.parse(await readFile(location(input),'utf8'));return saved.schema==='kkm-ofd-v1'&&valid(input,saved.snapshot)?{...saved.snapshot,fromCache:true}:null;}catch{return null;}},
  async write(input:Input,value:Snapshot){if(!valid(input,value))return false;await mkdir(directory,{recursive:true,mode:0o700});const target=location(input),temporary=target+'.'+randomUUID()+'.tmp';try{await writeFile(temporary,JSON.stringify({schema:'kkm-ofd-v1',snapshot:{...value,fromCache:undefined}}),{mode:0o600,flag:'wx'});await rename(temporary,target);}finally{await unlink(temporary).catch(()=>{});}return true;}
 };
}
export function createKkmCloseReportLoader(options:{load:typeof loadPlatformaOfdZReports;cache:ReturnType<typeof createKkmCloseReportCache>;journal?:ReturnType<typeof createKkmCloseReportJournal>;now?:()=>number}) {
 const pending=new Map<string,Promise<Snapshot>>(),clock=options.now??Date.now;
 return async(input:Input,mode:{force?:boolean;prefetch?:boolean}={}):Promise<Snapshot>=>{
  if(!mode.force){const saved=await options.cache.read(input);if(saved&&!options.journal)return saved;}
  const key=JSON.stringify(input),started=clock();
  const fresh=()=>{
   if(!pending.has(key))pending.set(key,(async()=>{
    const result:Snapshot=await options.load(input).catch(()=>({complete:false,checkedAt:new Date(clock()).toISOString(),data:[],errorCode:'OFD_REQUEST_FAILED'}));
    await options.cache.write(input,result).catch(()=>false);return result;
   })().finally(()=>pending.delete(key)));
   return pending.get(key)!;
  };
  let result=await fresh();
  // An employee joining a background request still gets their own quick retry.
  if(!mode.prefetch&&(!result.complete||result.data.length===0)&&clock()-started<1000){await new Promise(resolve=>setTimeout(resolve,200));result=await fresh();}
  if(options.journal){
   if(result.complete)await options.journal.write(input,result).catch(()=>false);
   let saved;try{saved=await options.journal.read(input);}catch{return {complete:false,checkedAt:new Date(clock()).toISOString(),data:[],errorCode:'OFD_STORED_EVIDENCE_INVALID'};}
   if(saved)return {...saved,fromCache:true,storedEvidence:true,liveReadComplete:result.complete,
    ...(result.errorCode?{liveErrorCode:result.errorCode}:{}),providerFetchedAt:result.providerFetchedAt};
  }
  return result;
 };
}
let shared:ReturnType<typeof createKkmCloseReportLoader>|undefined;
export function loadKkmCloseReports(input:Input,mode:{force?:boolean;prefetch?:boolean}={}) {
 if(!shared){const env=readOneCRuntimeEnv(),scope=createHash('sha256').update(`${env.baseUrl}\n${env.user}\n${process.env.DATABASE_URL||''}\n${process.env.PLATFORMA_OFD_PROXY_BASE_URL||''}`).digest('hex');shared=createKkmCloseReportLoader({load:loadPlatformaOfdZReports,cache:createKkmCloseReportCache(path.join(process.env.FISCAL_REPORT_CACHE_DIR||path.join(process.cwd(),'.cache','fiscal-reports'),scope,'kkm-closures')),journal:createKkmCloseReportJournal(path.join(process.env.FISCAL_REPORT_CACHE_DIR||path.join(process.cwd(),'.cache','fiscal-reports'),scope,'kkm-closure-proof'))});}
 return shared(input,mode);
}
