import type { DailyFiscalReport, DailyFiscalRow } from './terminal-fiscal-daily-report';
export type FiscalManager = {
  name: string; key: string; state: 'shift' | 'confirmed' | 'one_c' | 'conflict' | 'unknown'; note: string;
};
type Person = { id: number; name: string; cashierRef?: string | null };
export function fiscalManager(input: { expected: Person | null; cashiers: Array<{ref:string;name:string}>; people: Person[] }): FiscalManager {
  const cashiers=[...new Map(input.cashiers.filter(c=>c.ref).map(c=>[c.ref,c])).values()];
  const actual=cashiers.length===1?cashiers[0]:null;
  const expected=input.expected;
  const owner=actual?input.people.find(p=>p.cashierRef===actual.ref):null;
  if(cashiers.length>1)return {name:cashiers.map(c=>c.name||'Кассир 1С без имени').join(', '),key:'unassigned',state:'conflict',note:'В связанных документах указаны разные кассиры 1С. Проверьте ответственного.'};
  if(actual){
    const name=actual.name||owner?.name||'Кассир 1С без имени';
    if(expected&&owner?.id!==expected.id)return {name,key:`cashier:${actual.ref}`,state:'conflict',note:`По рабочему месту и смене: ${expected.name}. Кассир 1С: ${name}. Проверьте назначение рабочего места и документ 1С.`};
    return {name,key:`cashier:${actual.ref}`,state:expected?'confirmed':'one_c',note:expected?'Подтверждено 1С · совпадает со сменой':'Кассир из 1С · ответственный по смене не подтверждён'};
  }
  if(expected)return {name:expected.name,key:expected.cashierRef?`cashier:${expected.cashierRef}`:`employee:${expected.id}`,state:'shift',note:'По рабочему месту и смене · кассир в 1С пока не указан'};
  return {name:'Не определён',key:'unassigned',state:'unknown',note:'Нет кассира 1С и однозначного ответственного по рабочему месту и смене. Проверьте настройки.'};
}
export function applyFiscalManagers(report:DailyFiscalReport, managers:Map<string,FiscalManager>) {
  const owners=new Map<string,FiscalManager>();
  for(const transaction of report.transactions){
    const manager=managers.get(transaction.key);if(!manager)continue;
    transaction.manager=manager.name;transaction.managerAttribution=manager;
    // A conflicting group must not erase the actual per-document cashiers.
    if(manager.key==='unassigned')continue;
    for(const cell of transaction.bank)owners.set(`bank:${cell.key}`,manager);
    for(const cell of transaction.oneC)owners.set(`oneC:${cell.key}`,manager);
    for(const cell of transaction.ofd)owners.set(`ofd:${cell.key.substring(cell.key.indexOf('|')+1)}`,manager);
  }
  const oldRows=new Map(report.rows.map(r=>[r.key,r]));
  const rows=new Map<string,DailyFiscalRow>();
  for(const movement of report.movements){
    const manager=owners.get(`${movement.source}:${movement.key}`);
    const key=manager?.key??movement.managerKey;
    const name=manager?.name??oldRows.get(key)?.name??'Не распределено';
    movement.managerKey=key;
    if(!rows.has(key))rows.set(key,{key,name:key==='unassigned'?'Не распределено':name,bankKopecks:0,oneCKopecks:0,ofdKopecks:0,bankDifferenceKopecks:0,fiscalDifferenceKopecks:0});
    const row=rows.get(key)!;row[`${movement.source}Kopecks`]+=movement.amountKopecks;
  }
  report.rows=[...rows.values()].map(r=>({...r,bankDifferenceKopecks:r.bankKopecks-r.oneCKopecks,fiscalDifferenceKopecks:r.oneCKopecks-r.ofdKopecks})).sort((a,b)=>a.key==='unassigned'?1:b.key==='unassigned'?-1:a.name.localeCompare(b.name,'ru'));
  if(report.status==='balanced'&&[...managers.values()].some(m=>m.state==='conflict'||m.state==='unknown'))report.status='review';
  const attention=(t:DailyFiscalReport['transactions'][number])=>t.status==='review'||t.status==='incomplete'||t.managerAttribution?.state==='conflict'||t.managerAttribution?.state==='unknown';
  report.transactions.sort((a,b)=>Number(attention(b))-Number(attention(a))||Date.parse(a.at)-Date.parse(b.at));
  return report;
}
