import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceCheckIsStale } from '../lib/admin-inbox-source-health';
test('only a known successful source check older than one hour warrants a stale-source warning',()=>{
 const checked=new Date('2026-10-12T09:00Z');
 assert.equal(sourceCheckIsStale(checked,new Date(+checked+59*60000)),false);
 assert.equal(sourceCheckIsStale(checked,new Date(+checked+60*60000)),true);
 assert.equal(sourceCheckIsStale(new Date('invalid'),checked),false);
 assert.equal(sourceCheckIsStale(null,checked),false);
 assert.equal(sourceCheckIsStale(new Date(+checked+60000),checked),false);
});
