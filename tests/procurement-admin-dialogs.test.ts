import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('compact production list exposes dates, basis, method and warnings without opening a request',async()=>{
  const output=await build({entryPoints:['components/ProcurementAdminList.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',loader:{'.css':'empty'}});
  const module={exports:{} as {ProcurementAdminList:React.ComponentType<any>}};
  new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  let details=0;
  const html=renderToStaticMarkup(React.createElement(module.exports.ProcurementAdminList,{items:[{id:'test',name:'Поставщик',amount:'100 000 ₽',dateLabel:'11 октября',basis:'Заказ 425',method:'Перевод на карту',group:'Сегодня',priority:'today',warning:'Частично оплачено'}],renderDetail:()=>{details++;return 'details';}}));
  for(const text of ['11 октября','Заказ 425','Перевод на карту','100 000 ₽','Частично оплачено','Подробности оплаты Поставщик'])assert.ok(html.includes(text));
  assert.equal(details,0);assert.ok(!html.includes('<dialog'));
});
test('native dialog guards dirty and busy states and restores focus and scrolling',()=>{
  const source=read('components/ProcurementAdminList.tsx');
  for(const text of ['dialog.showModal()','aria-labelledby={title}','if(busy)return','if(dirty)setDiscard(true)','document.body.style.overflow=overflow','opener?.isConnected','Продолжить редактирование','onCancel={e=>{e.preventDefault();requestClose();}}'])assert.ok(source.includes(text),text);
  const css=read('components/procurement-admin-list.css');
  for(const text of ['max-width:720px','overflow-y:auto','max-height:100dvh','.pam-dialog-footer'])assert.ok(css.includes(text));
});
test('production actions, monetary warnings, receipt access and history remain wired',()=>{
  const source=read('app/(dashboard)/admin/procurement/AdminProcurementClient.tsx');
  for(const text of ['act(id,"APPROVE")','act(id,"RETURN")','act(id,"CANCEL")','returnReason.trim().length<3','paymentAmountNeedsConfirmation','ProcurementCompletionAction','ProcurementCollectionNotice','ProcurementChangeHistory','funding.detail','sourceWarnings','single hideEmptyBeforePayment','splitView adminDialogs'])assert.ok(source.includes(text),text);
  assert.ok(!source.includes('window.confirm'));
  assert.equal((source.match(/setInterval/g)||[]).length,0);
  const receipts=read('components/ProcurementReceipts.tsx');
  assert.ok(receipts.includes('ready&&!receipts.length&&!hasPayment'));
});
test('pending request edits stay separate from approval and use the existing dirty guard',()=>{
  const source=read('app/(dashboard)/admin/procurement/AdminProcurementClient.tsx');
  for(const text of ['pendingEditState.editing?','pendingEditState.dirty','pendingEditState.busy','beforeApproval disabled={!!busy}','onStateChange={setPendingEditState}'])assert.ok(source.includes(text),text);
  const editor=read('components/ProcurementApprovedEdit.tsx');
  assert.ok(editor.includes('editing:open'));
  assert.ok(editor.includes('Изменения сохранены. Заявка ждёт вашего согласования.'));
  assert.ok(!editor.includes('!beforeApproval?<button'));
  assert.ok(editor.includes('beforeApproval={beforeApproval}'));
  const schedule=read('components/ProcurementFundingSchedule.tsx');
  assert.ok(schedule.includes('editing:true'));
  assert.ok(schedule.includes('Заявка останется на согласовании.'));
  assert.ok(schedule.includes('После сохранения: оплата отложена · дата уточняется'));
});
