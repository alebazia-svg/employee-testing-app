import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PortalAccessDevicesView} from '../components/PortalAccessDevices';
import type {AccessJournalRow} from '../components/PortalAccessJournal';
const now='2026-11-07T06:30:00.000Z';
const base:AccessJournalRow={id:'edge',name:'Администратор',login:'admin',role:'ADMIN',device:'Mac',browser:'Edge',connectionLabel:'Mac Бэлы',deviceGroupId:'bela-group',browserInstanceId:'edge-code',firstSeenAt:now,loginAt:now,lastSeenAt:now,loggedOutAt:null,expiresAt:'2026-12-01T00:00:00Z',pushLabel:'Подключены',pushCheckedAt:now,ownerBrowser:true,appUpdate:{version:'1.21.43',builtAt:now,checkedAt:now,state:'current'}};
const rows:AccessJournalRow[]=[base,{...base,id:'edge-employee',name:'Астемир',login:'astemir',role:'EMPLOYEE',ownerBrowser:false,ownerInspection:true,pushLabel:'Не подключены',appUpdate:{...base.appUpdate!,version:'1.21.33'}},{...base,id:'safari',browserInstanceId:'safari-code',browser:'Safari',isCurrentBrowser:true,device:'Mac / iPad'},{...base,id:'yandex',browserInstanceId:'yandex-code',browser:'Яндекс'},{...base,id:'aslan',browserInstanceId:'aslan-code',browser:'Chrome',connectionLabel:'Mac Аслана',deviceGroupId:null},{...base,id:'codex',browserInstanceId:'codex-code',browser:'Chrome',connectionLabel:'Служебный браузер Codex',deviceGroupId:'codex-group'},{...base,id:'claude',browserInstanceId:'claude-code',browser:'Chrome',connectionLabel:'Служебный браузер Claude',deviceGroupId:null}];
function render(q=''){return renderToStaticMarkup(<PortalAccessDevicesView rows={rows} query={q} service history={false} page={1} hasMore={false} unavailable={false} nowIso={now}/>);}
test('only confirmed groups consolidate; all cabinets, browser names, versions and notifications remain visible',()=>{
 const before=JSON.stringify(rows),html=render();
 assert.equal((html.match(/<h2>Mac Бэлы<\/h2>/g)||[]).length,1);
 assert.equal((html.match(/<article /g)||[]).length,rows.length);
 for(const s of ['Mac Аслана','Служебный браузер Codex','Служебный браузер Claude','<h3>Edge</h3>','<h3>Safari</h3>','<h3>Яндекс</h3>','Кабинет: Администратор','Кабинет: Астемир','1.21.43','1.21.33','Этот браузер'])assert.ok(html.includes(s),s);
 assert.equal((html.match(/Этот браузер/g)||[]).length,1);
 assert.equal(JSON.stringify(rows),before);
 const filtered=render('safari-code');assert.ok(filtered.includes('<h3>Яндекс</h3>'),'search retains the full matching confirmed device');assert.ok(!filtered.includes('<h2>Mac Аслана</h2>'));
});
