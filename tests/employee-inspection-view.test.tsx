import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmployeePreviewProvider } from '../components/EmployeePreviewProvider';
import { EmployeeInspectionDevice } from '../components/EmployeeInspectionDevice';
import type { InspectionDeviceSnapshot } from '../lib/employee-inspection-state';

const at='2026-11-10T15:53:00.000Z';
const snapshot:InspectionDeviceSnapshot={selectedId:'phone',connections:[{id:'phone',label:'iPhone · Приложение',lastSeenAt:at,checkedAt:at,pushLabel:'Подключены',fresh:true,displayMode:'app',state:'ready',isPhone:true,isIos:true,live:false,runtimeAt:at,runtime:{setup:'ready',busy:false,error:null,online:true,sampledAt:at,screen:{section:'day'}}}]};

test('inspection renders the actual cabinet immediately while device evidence is loading, including phone frames',()=>{
 for(const frame of [undefined,'phone','desktop'] as const){
  const html=renderToStaticMarkup(<EmployeePreviewProvider visitId='review' employeeName='Пример' expiresAt='2030-01-01T00:00:00Z' follow frame={frame}><main>Настоящий кабинет сотрудника</main></EmployeePreviewProvider>);
  assert.match(html,/<main>Настоящий кабинет сотрудника<\/main>/);
  assert.doesNotMatch(html,/Нет подтверждения текущего экрана|отключите «По данным сотрудника»/);
 }
});

test('stale evidence stays dated and every control/fact remains inside a closed disclosure',()=>{
 const before=JSON.stringify(snapshot);
 const html=renderToStaticMarkup(<EmployeeInspectionDevice snapshot={snapshot} selectedId='phone' onSelect={()=>{throw Error('render mutated selection');}} framed={false} followScreen onFollow={()=>{throw Error('render changed follow mode');}}/>);
 const summary=html.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)![1];
 assert.match(summary,/Последний сигнал/);assert.match(summary,/18:53/);assert.match(summary,/Подробнее/);
 assert.match(html,/18:53:00/,'full timestamp remains available in the details');
 assert.doesNotMatch(summary,/checkbox|Настройка уведомлений|изменения не сохраняются/);
 assert.doesNotMatch(html,/<details[^>]*\bopen(?:=|\s|>)/);
 for(const text of ['Последний известный экран: ','Рабочий день','По данным сотрудника','Подключены','Проверка интерфейса · изменения не сохраняются.','не сохранённый снимок'])assert.ok(html.includes(text),text);
 assert.match(html,/type="checkbox" checked=""/);
 assert.equal(JSON.stringify(snapshot),before);
});

test('fresh, missing, unavailable and manual states do not invent a live device or discard connection choices',()=>{
 const render=(s:InspectionDeviceSnapshot|null,follow=true)=>renderToStaticMarkup(<EmployeeInspectionDevice snapshot={s} selectedId={s?.selectedId??''} onSelect={()=>{}} framed={false} followScreen={follow} onFollow={()=>{}}/>);
 const live={...snapshot,connections:snapshot.connections.map(c=>({...c,live:true}))};
 assert.match(render(live),/Свежие сведения/);
 assert.match(render(null),/Получаем сведения об устройстве/);
 assert.match(render({connections:[],selectedId:null,unavailable:true}),/Сведения устройства временно недоступны/);
 assert.match(render({connections:[],selectedId:null}),/Сведения об экране пока не получены/);
 assert.match(render(snapshot,false),/Самостоятельный просмотр/);
 const multiple={...snapshot,connections:[...snapshot.connections,{...snapshot.connections[0],id:'other',label:'Рабочий iPad'}]};
 assert.match(render(multiple),/Рабочий iPad/);assert.match(render(multiple),/aria-label="Устройство сотрудника"/);
});
