// Presentation only: keep the existing source and shift-state decisions intact.
export type TeamStatusRow = {
  id:number;name:string;state:string;start:string;end:string;planState:string;
  sourceUnavailable:boolean;missing:boolean;
};
export const teamStatusFilters = [
  ['working','Работает'], ['missing','Не отметились по плану'],
  ['unfinished','Не завершили смену'], ['expected','Ожидается начало'],
  ['arrival','Приход отмечен'], ['finished','Завершили'],
  ['off','Выходной'], ['vacation','Отпуск'],
  ['unknown','График не заполнен'], ['unavailable','Нет данных'],
] as const;
export type TeamStatus = typeof teamStatusFilters[number][0];
export function teamRowStatus(row:TeamStatusRow):TeamStatus {
  if(row.end!=='—')return 'finished';
  if(row.state==='Работает')return 'working';
  if(row.state==='Не завершил смену')return 'unfinished';
  if(row.state==='Приход отмечен')return 'arrival';
  if(row.sourceUnavailable&&row.start==='—')return 'unavailable';
  if(row.missing)return 'missing';
  if(row.planState==='off')return 'off';
  if(row.planState==='vacation')return 'vacation';
  if(row.planState==='unavailable')return 'unavailable';
  if(row.planState==='unknown')return 'unknown';
  return 'expected';
}
export function compareTeamRows(a:TeamStatusRow,b:TeamStatusRow) {
  const rank=(row:TeamStatusRow)=>teamStatusFilters.findIndex(([id])=>id===teamRowStatus(row));
  return rank(a)-rank(b)||a.name.localeCompare(b.name,'ru')||a.id-b.id;
}
