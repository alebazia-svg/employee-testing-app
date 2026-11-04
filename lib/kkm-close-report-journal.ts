import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,readdir,link,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import type {PlatformaOfdZReport,SourceSnapshot,loadPlatformaOfdZReports} from './terminal-fiscal-sources';

type Input=Parameters<typeof loadPlatformaOfdZReports>[0];
type Snapshot=SourceSnapshot<PlatformaOfdZReport>;
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
/** Append-only observations on the existing persistent fiscal volume. Empty reads never erase proof. */
export function createKkmCloseReportJournal(directory:string,now=()=>Date.now()) {
 const folder=(input:Input)=>path.join(directory,hash(input));
 const valid=(input:Input,value:Snapshot)=>value?.complete===true&&Array.isArray(value.data)&&value.data.length>0
  &&Number.isFinite(Date.parse(value.checkedAt))&&Date.parse(value.checkedAt)<=now()
  &&value.data.every(r=>r&&r.kktRegistrationNumber===input.kktRegistrationNumber&&r.fiscalDriveNumber&&r.shiftNumber
   &&Number.isFinite(Date.parse(r.openedAt))&&Number.isFinite(Date.parse(r.closedAt))
   &&Date.parse(r.openedAt)<=Date.parse(r.closedAt)&&Date.parse(r.closedAt)<=now()
   &&Date.parse(r.closedAt)>=Date.parse(input.from)&&Date.parse(r.closedAt)<Date.parse(input.to));
 return {
  async write(input:Input,value:Snapshot){
   if(!valid(input,value))return false;
   const dir=folder(input);await mkdir(dir,{recursive:true,mode:0o700});
   // Content-addressed files preserve concurrent observations and conflicting evidence for review.
   const target=path.join(dir,hash(value.data)+'.json'),temporary=target+'.'+randomUUID()+'.tmp';
   try{await writeFile(temporary,JSON.stringify({schema:'kkm-ofd-proof-v1',observedAt:new Date(now()).toISOString(),snapshot:value}),{mode:0o600,flag:'wx'});await link(temporary,target).catch(error=>{if(error.code!=='EEXIST')throw error;});}
   finally{await unlink(temporary).catch(()=>{});}return true;
  },
  async read(input:Input):Promise<Snapshot|null>{
   let names:string[];try{names=await readdir(folder(input));}catch{return null;}
   const reports=new Map<string,PlatformaOfdZReport>();let checkedAt='';
   for(const name of names.filter(n=>/^[a-f0-9]{64}\.json$/.test(n))){
    try{
     const saved=JSON.parse(await readFile(path.join(folder(input),name),'utf8'));
     if(saved.schema!=='kkm-ofd-proof-v1'||!Number.isFinite(Date.parse(saved.observedAt))||Date.parse(saved.observedAt)>now()||!valid(input,saved.snapshot))throw Error('OFD_STORED_EVIDENCE_INVALID');
     const snapshot:Snapshot=saved.snapshot;checkedAt=checkedAt>snapshot.checkedAt?checkedAt:snapshot.checkedAt;
     for(const report of snapshot.data){
      const key=JSON.stringify([report.kktRegistrationNumber,report.fiscalDriveNumber,report.shiftNumber]);
      const previous=reports.get(key);
      if(previous&&(previous.openedAt!==report.openedAt||previous.closedAt!==report.closedAt))throw Error('OFD_STORED_EVIDENCE_CONFLICT');
      reports.set(key,report);
     }
    }catch{throw Error('OFD_STORED_EVIDENCE_INVALID');}
   }
   return reports.size?{complete:true,checkedAt,data:[...reports.values()].sort((a,b)=>Date.parse(a.closedAt)-Date.parse(b.closedAt))}:null;
  },
 };
}
