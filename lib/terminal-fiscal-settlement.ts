/** Read-only bank credits are settlement evidence, never fiscal receipt proof. */
type Row=Record<string,unknown>;
const record=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
export function statementDay(v:unknown):string {
 if(typeof v!=='string')return '';const s=v.slice(0,10),d=/^\d{2}\.\d{2}\.\d{4}$/.test(s)?s.split('.').reverse().join('-'):s;
 return /^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:'';
}
export function compareFiscalSettlement(raw:unknown,input:{from:string;to:string;fiscalKopecks:number;fiscalComplete:boolean}) {
 const root=record(raw),period=record(root.control_period),warnings:string[]=[];
 const rows=Array.isArray(root.operations)?root.operations.map(record):[];
 const summaries=Array.isArray(root.statement_summaries)?root.statement_summaries.map(record):[];
 const covered=(day:string)=>summaries.some(s=>statementDay(s.period_start)<=day&&statementDay(s.period_end)>=day&&s.statement_balance_valid===true);
 let complete=root.ok===true&&root.endpoint==='bank-exchange-statement-operations'&&period.date_from===input.from&&period.date_to===input.to
  &&Number.isSafeInteger(root.operations_found)&&root.operations_found===root.operations_returned&&root.operations_returned===rows.length&&rows.length<=500
  &&Array.isArray(root.warnings)&&root.warnings.length===0;
 for(let t=Date.parse(input.from);t<=Date.parse(input.to);t+=86400000)if(!covered(new Date(t).toISOString().slice(0,10)))complete=false;
 const unique=new Map<string,{day:string;documentDay:string;number:string;amountKopecks:number;kind:'card'|'sbp'}>();
 let commissionKopecks=0;
 for(const r of rows){
  const day=statementDay(r.operation_date),number=typeof r.document_number==='string'?r.document_number.trim():'';
  if(!day||day<input.from||day>input.to)continue;
  const purpose=String(r.purpose??'').toLocaleLowerCase('ru-RU');
  const card=/зачисление средств по терминалам эквайринга/.test(purpose),sbp=/пополнение по операции сбп/.test(purpose),fee=/комисси/.test(purpose)&&/эквайр|сбп|терминал/.test(purpose);
  if(!card&&!sbp&&!fee)continue;
  const amount=typeof r.amount==='number'?r.amount:Number(String(r.amount).replace(/\s/g,'').replace(',','.')),minor=Math.round(amount*100);
  if(!number||!Number.isSafeInteger(minor)||minor<0||Math.abs(amount*100-minor)>0.001){complete=false;continue;}
  const key=`${r.direction}|${number}|${statementDay(r.document_date)}|${minor}`;
  if(fee&&r.direction==='outgoing') {if(!unique.has(key)){commissionKopecks+=minor;unique.set(key,{day,documentDay:statementDay(r.document_date),number,amountKopecks:minor,kind:'card'});}continue;}
  if(r.direction==='incoming'&&!unique.has(key))unique.set(key,{day,documentDay:statementDay(r.document_date),number,amountKopecks:minor,kind:sbp?'sbp':'card'});
 }
 const credits=[...unique.entries()].filter(([key])=>key.startsWith('incoming|')).map(([,v])=>v).sort((a,b)=>a.day.localeCompare(b.day)||a.number.localeCompare(b.number));
 const daily=[...new Set(credits.map(c=>c.day))].map(day=>({day,amountKopecks:credits.filter(c=>c.day===day).reduce((n,c)=>n+c.amountKopecks,0)}));
 // Card settlement is a dated D+1 hypothesis; SBP settles on the sale day.
 // Keep document and posting dates distinct (weekend packets post on Monday).
 const nextDay=new Date(Date.parse(input.from)+86400000).toISOString().slice(0,10);
 const selected=credits.filter(c=>c.kind==='card'?c.documentDay===nextDay:c.documentDay===input.from);
 const settlementKopecks=selected.reduce((n,c)=>n+c.amountKopecks,0);
 const candidates=input.fiscalKopecks>0&&selected.length>0&&settlementKopecks===input.fiscalKopecks?[{day:nextDay,amountKopecks:settlementKopecks}]:[];
 if(!complete)warnings.push('Выписка за период получена не полностью.');
 if(commissionKopecks)warnings.push('В выписке есть комиссии. Их связь с зачислениями требует проверки.');
 return {complete,from:input.from,to:input.to,fiscalKopecks:input.fiscalKopecks,credits,daily,selected,settlementKopecks,differenceKopecks:settlementKopecks-input.fiscalKopecks,commissionKopecks,candidates,
  status:!complete||!input.fiscalComplete?'incomplete':candidates.length===1?'amount_equal':candidates.length>1?'ambiguous':'not_linked',warnings};
}
export type FiscalSettlement=ReturnType<typeof compareFiscalSettlement>;
