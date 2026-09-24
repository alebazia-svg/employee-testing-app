import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierNamesForManager} from '../lib/procurement-supplier-roster';
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const payload=()=>({ok:true,complete:true,mode:'read-only',write_operations:false,contract_version:'supplier-manager-roster-v1',scope:'posted_nondeleted_orders_all_history',rows:[
  {manager_ref:id(1),manager:'Астемир',supplier_ref:id(2),supplier_partner:'Старый поставщик'},
  {manager_ref:id(3),manager:'Другой',supplier_ref:id(4),supplier_partner:'Чужой'}]});
test('all-history roster scopes suppliers by exact manager, not recent orders',()=>{
  assert.deepEqual(supplierNamesForManager(payload(),' астемир '),['Старый поставщик']);
});
test('old API response, truncated roster and ambiguous identities fail closed',()=>{
  assert.throws(()=>supplierNamesForManager({ok:true},'Астемир'));
  const p=payload();p.complete=false;assert.throws(()=>supplierNamesForManager(p,'Астемир'));
  const q=payload();q.rows.push({...q.rows[0],supplier_ref:id(8)});assert.throws(()=>supplierNamesForManager(q,'Астемир'));
});
