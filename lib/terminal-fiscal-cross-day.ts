import {TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS} from './terminal-fiscal-matching';
import type {FiscalTransactionRow} from './terminal-fiscal-transaction-report';

const DAY = 86400000;
export type FiscalClaimDay = {transactions:FiscalTransactionRow[]; complete:boolean};
const dayKey = (time:number) => new Date(time + 3*3600000).toISOString().slice(0,10);
const successful = (row:FiscalTransactionRow) => row.status==='matched'||row.status==='covered';

// Each daily matcher reads fiscal evidence from its Moscow midnight through
// the late window. Only reports capable of reading this actual receipt compete.
export async function checkCrossDayClaims(day:string, rows:FiscalTransactionRow[], load:(day:string)=>Promise<FiscalClaimDay>) {
  const byDay=new Map<string,Map<string,FiscalTransactionRow[]>>();
  for(const row of rows){
    if(!successful(row)||!row.bank.length)continue;
    for(const receipt of row.ofd){
      const receiptDay=dayKey(Date.parse(receipt.at));
      const midnight=Date.parse(receiptDay+'T00:00:00+03:00');
      for(let offset=0;offset<=TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS;offset+=DAY){
        const other=dayKey(midnight-offset);
        if(other===day)continue;
        const keys=byDay.get(other)??new Map<string,FiscalTransactionRow[]>();
        keys.set(receipt.key,[...(keys.get(receipt.key)??[]),row]);
        byDay.set(other,keys);
      }
    }
  }
  const conflict=new Set<FiscalTransactionRow>(),unknown=new Set<FiscalTransactionRow>();
  for(const [other,keys] of byDay){
      const peer=await load(other).catch(():FiscalClaimDay=>({complete:false,transactions:[]}));
      if(!peer.complete)for(const targets of keys.values())for(const t of targets)unknown.add(t);
      for(const candidate of peer.transactions){
        if(!candidate.bank.length||!successful(candidate))continue;
        for(const receipt of candidate.ofd)for(const target of keys.get(receipt.key)??[]){
          if(candidate.bank.some(b=>!target.bank.some(v=>v.key===b.key)))conflict.add(target);
        }
      }
  }
  for(const row of new Set([...unknown,...conflict])){
    row.status='review';
    row.message=conflict.has(row)?'Этот чек указан у оплат за разные дни':'Не удалось проверить использование чека за другие дни';
    delete row.timeNote;
  }
  return new Set([...unknown,...conflict].flatMap(row=>row.bank.map(b=>b.key)));
}
