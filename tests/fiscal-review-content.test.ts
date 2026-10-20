import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
test('fiscal window exposes evidence without offering duplicate or premature receipt requests',async()=>{
 const mocks:Record<string,any>={
  './FiscalAdminApproval':{FiscalAdminApproval:()=>React.createElement('button',null,'Передать менеджерам')},
  './FiscalTestPaymentButton':{FiscalTestPaymentButton:()=>React.createElement('button',null,'Это тестовая оплата')},
  './TerminalFiscalChainEvidence':{TerminalFiscalChainEvidence:()=>null},
  './TerminalFiscalReviewConversation':{TerminalFiscalReviewConversation:()=>null},
 };
 const out=await build({entryPoints:['components/FiscalReviewContent.tsx'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',jsx:'automatic',plugins:[{name:'fixture',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
 const require=createRequire(import.meta.url),mod={exports:{} as any};
 new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n]??require(n),mod,mod.exports);
 const base:any={id:'r',resolved:false,pendingAdmin:true,simpleCheck:true,reasonCode:'ONE_C_CANDIDATE_NOT_FOUND',elapsedMinutes:25,amount:'6 800 ₽',at:'20.10.2026, 11:29',checkedAt:'20.10, 11:54',sources:{bank:true,oneC:true,ofd:true},view:{title:'Неоднозначная сверка'},proposed:{users:[],primary:null,confidence:'uncertain'},canApprove:true,canTest:true};
 const render=(d:any)=>renderToStaticMarkup(React.createElement(mod.exports.FiscalReviewContent,{detail:{...base,...d}}));
 const missing=render({});assert.match(missing,/Чек в 1С не найден/);assert.match(missing,/Связанный документ не найден/);assert.match(missing,/Ваше решение/);
 const pending=render({reasonCode:'ONE_C_CANDIDATE_PENDING'});assert.match(pending,/Чек 1С пока не найден/);assert.match(pending,/Ваше решение/);assert.match(pending,/Передать менеджерам/);
 const incomplete=render({reasonCode:'SOURCE_ONE_C_INCOMPLETE',simpleCheck:false,sources:{bank:true,oneC:false,ofd:true}});assert.match(incomplete,/Данные неполные/);assert.doesNotMatch(incomplete,/Передать менеджерам/);
 const unknown=render({sources:{bank:null,oneC:null,ofd:null}});assert.match(unknown,/Нет результата сверки/);assert.doesNotMatch(unknown,/Данные неполные/);
 const confirmed=render({resolved:true,pendingAdmin:false,canApprove:false,canTest:false,manager:'Чеченова Милана',workstation:'Касса Чеченовой',terminal:'aQsi · 10693079',message:'Чек подтверждён ОФД',hasOneCCheck:true});assert.match(confirmed,/Проверка завершена/);assert.match(confirmed,/Кассир в 1С/);assert.match(confirmed,/10693079/);assert.doesNotMatch(confirmed,/Передать менеджерам|Это тестовая оплата/);
 const hypothesis=render({googleHint:{name:'Магомед',basis:'По отметке Приложение'}});assert.match(hypothesis,/не подтверждено чеком 1С/);
});
