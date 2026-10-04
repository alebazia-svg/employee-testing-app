import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';

const html = readFileSync('public/offline.html', 'utf8');
const worker = readFileSync('public/workday-sw.js', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

test('offline recovery script is unchanged from the existing application', () => {
  const original = execFileSync('git', ['show', 'HEAD:public/offline.html'], {encoding:'utf8'});
  assert.equal(script, original.match(/<script>([\s\S]*?)<\/script>/)[1]);
});
test('offline logo is the existing symbol embedded without a network dependency', () => {
  const encoded = html.match(/src="data:image\/svg\+xml,([^"]+)"/)[1];
  assert.equal(decodeURIComponent(encoded), readFileSync('public/brand/mobo-master/mobo-symbol-3d-ui.svg', 'utf8'));
});
test('desktop expands the canvas, not reading width; mobile zoom remains allowed', () => {
  assert.match(html, /@media \(min-width: 760px\)[\s\S]*?\.shell \{ max-width: none;/);
  assert.match(html, /\.card \{ max-width: 480px;/);
  assert.doesNotMatch(html, /maximum-scale/);
});
test('only the offline cache version changes in the service worker', () => {
  const original = execFileSync('git', ['show', 'HEAD:public/workday-sw.js'], {encoding:'utf8'});
  assert.equal(worker, original.replaceAll('portal-offline-v5', 'portal-offline-v6'));
});
for (const online of [false, true]) test(`connection result remains correct: online=${online}`, async () => {
  const listeners = {}, timers = {}, status = {}, retry = {addEventListener:(event, fn)=>{listeners[event]=fn;}};
  let target = null;
  const context = vm.createContext({document:{getElementById:id=>id==='retry'?retry:status},
    fetch:async(url,opts)=>{assert.equal(url,'/api/health?connection-check=1');assert.equal(opts.cache,'no-store');if(!online)throw Error('offline');return {ok:true};},
    window:{addEventListener:(event,fn)=>{listeners[event]=fn;},setInterval:(fn,ms)=>{timers.interval=ms;},setTimeout:(fn,ms)=>{timers.timeout=ms;},location:{replace:url=>{target=url;}}}});
  vm.runInContext(script,context);
  await listeners.click();
  assert.equal(target,online?'/employee':null);
  assert.equal(status.textContent,online?'Связь восстановлена':'Связи пока нет');
  assert.equal(retry.disabled,false);
  assert.equal(timers.interval,10000);
  assert.equal(timers.timeout,800);
  assert.equal(typeof listeners.online,'function');
});
