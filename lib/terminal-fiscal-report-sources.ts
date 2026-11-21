import {loadCompleteTBankOperations,loadOneCTerminalFiscalEvidence,loadPlatformaOfdReceipts,type SourceSnapshot} from './terminal-fiscal-sources';
const DAY=86400000;
const WEEK=7*DAY;
const iso=(ms:number)=>new Date(ms).toISOString();
const moscowDay=(ms:number)=>iso(ms+10800000).slice(0,10);
const midnight=(day:string)=>Date.parse(day+'T00:00:00+03:00');

// Memoize only within one refresh. Return a separate array because the runner
// may append archived bank evidence. Partial upstream reads remain partial.
function windows<T>(anchor:number,end:number,read:(key:string,a:number,b:number)=>Promise<SourceSnapshot<T>>,date:(row:T)=>string){
  const pending=new Map<string,Promise<SourceSnapshot<T>>>();
  return async(key:string,from:number,to:number):Promise<SourceSnapshot<T>>=>{
    to=Math.min(to,end);
    const reads:Promise<SourceSnapshot<T>>[]=[];
    for(let a=anchor+Math.floor((from-anchor)/WEEK)*WEEK;a<to;a+=WEEK){
      const b=Math.min(a+WEEK,end),id=key+'|'+a;
      let part=pending.get(id);
      if(!part){part=read(key,a,b);pending.set(id,part);}
      reads.push(part);
    }
    const parts=await Promise.all(reads);
    return {complete:parts.length>0&&parts.every(p=>p.complete),checkedAt:parts.map(p=>p.checkedAt).sort()[0]??iso(end),
      errorCode:parts.find(p=>!p.complete)?.errorCode,
      data:parts.flatMap(p=>p.data.filter(r=>{const t=Date.parse(date(r));return t>=from&&t<to;}))};
  };
}

export function fiscalReportSources(day:string,now=Date.now()){
  const anchor=midnight(day);
  const bank=windows(anchor,now,(terminalKey,a,b)=>loadCompleteTBankOperations({terminalKey,from:iso(a),to:iso(b)}),r=>r.transactionDate);
  const ofd=windows(anchor,now,(kktRegistrationNumber,a,b)=>loadPlatformaOfdReceipts({kktRegistrationNumber,from:iso(a),to:iso(b)}),r=>r.receiptAt);
  const oneC=windows(anchor,midnight(moscowDay(now))+DAY,(_,a,b)=>loadOneCTerminalFiscalEvidence({fromDate:moscowDay(a),toDate:moscowDay(b)}),r=>r.dateTime);
  return {
    loadTbank:(p:Parameters<typeof loadCompleteTBankOperations>[0])=>bank(p.terminalKey,Date.parse(p.from),Date.parse(p.to)),
    loadOfd:(p:Parameters<typeof loadPlatformaOfdReceipts>[0])=>ofd(p.kktRegistrationNumber,Date.parse(p.from),Date.parse(p.to)),
    loadOneC:(p:Parameters<typeof loadOneCTerminalFiscalEvidence>[0])=>oneC('',midnight(p.fromDate),midnight(p.toDate))
  };
}
