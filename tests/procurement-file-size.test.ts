import assert from 'node:assert/strict';
import test from 'node:test';
import {procurementFileSize} from '../lib/procurement-file-size';
test('attachment sizes remain readable below one megabyte',()=>{
 assert.equal(procurementFileSize(0),'0 Б');
 assert.equal(procurementFileSize(25),'25 Б');
 assert.equal(procurementFileSize(1024),'1 КБ');
 assert.equal(procurementFileSize(1536),'1,5 КБ');
 assert.equal(procurementFileSize(1024*1024),'1 МБ');
 assert.equal(procurementFileSize(10*1024*1024),'10 МБ');
});
