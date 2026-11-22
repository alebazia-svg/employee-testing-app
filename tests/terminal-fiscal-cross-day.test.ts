import test from 'node:test';
import assert from 'node:assert/strict';
import {checkCrossDayClaims} from '../lib/terminal-fiscal-cross-day';
import type {FiscalTransactionRow} from '../lib/terminal-fiscal-transaction-report';
function row(bank:string,status:'matched'|'covered',id='844'):FiscalTransactionRow{
  const at='2026-11-21T07:40:00Z',cell={at,amountKopecks:50000,label:'',key:id};
  return {key:bank,at,manager:'Кассир',bank:[{...cell,key:bank}],oneC:[cell],ofd:[{...cell,key:'KKT|FN|'+id+'|FP'}],complete:{bank:true,oneC:true,ofd:true},message:'',status,chain:status==='covered'};
}
test('both reports retain both sources and managers when a later day covers an already claimed receipt',async()=>{
  for(const late of [true,false]){
    const a=row('RRN1','matched'),b=row('RRN2','covered'),normal=row('RRN3','matched','842');
    const current=late?a:b,peer=late?b:a,day=late?'2026-11-20':'2026-11-21',other=late?'2026-11-21':'2026-11-20';
    const rows=[current,normal],before=structuredClone(rows);
    const disputed=await checkCrossDayClaims(day,rows,async d=>({complete:true,transactions:d===other?[peer]:[]}));
    assert.deepEqual([...disputed],[current.key]);
    assert.equal(current.status,'review');
    assert.deepEqual(rows[1],before[1]);
    assert.deepEqual({...current,status:before[0].status,message:before[0].message},before[0]);
  }
});
test('coverage stays valid when amounts coincide but receipt keys differ',async()=>{
  const current=row('RRN2','covered');
  await checkCrossDayClaims('2026-11-21',[current],async()=>({complete:true,transactions:[row('RRN1','matched','833')]}));
  assert.equal(current.status,'covered');
});

test('only the earlier individually matched payment keeps a receipt issued between the payments',async()=>{
  const earlier=row('terminal|earlier','matched'), later=row('terminal|later','covered');
  earlier.bank[0].at='2026-11-20T15:41:48Z';
  later.bank[0].at='2026-11-21T13:22:40Z';
  const peer=(day:string, candidate:FiscalTransactionRow)=>(date:string)=>Promise.resolve({complete:true,transactions:day===date?[candidate]:[]});
  assert.equal((await checkCrossDayClaims('2026-11-20',[earlier],peer('2026-11-21',later))).size,0);
  assert.deepEqual([...await checkCrossDayClaims('2026-11-21',[later],peer('2026-11-20',earlier))],[later.key]);
  assert.equal(earlier.status,'matched');
  assert.equal(later.status,'review');
});

test('a competing individual match, different terminal or incomplete peer keeps the earlier payment under review',async()=>{
  for (const scenario of ['two matched','different terminal','incomplete peer','receipt after both','different 1C document']) {
    const earlier=row('terminal|earlier','matched');
    const later=row(scenario==='different terminal'?'other|later':'terminal|later',scenario==='two matched'?'matched':'covered');
    earlier.bank[0].at='2026-11-20T15:41:48Z';
    later.bank[0].at=scenario==='receipt after both'?'2026-11-21T07:20:00Z':'2026-11-21T13:22:40Z';
    if (scenario==='different 1C document') later.oneC[0].key='another document';
    await checkCrossDayClaims('2026-11-20',[earlier],async date=>({
      complete:date!=='2026-11-21'||scenario!=='incomplete peer',
      transactions:date==='2026-11-21'?[later]:[],
    }));
    assert.equal(earlier.status,'review',scenario);
  }
});
