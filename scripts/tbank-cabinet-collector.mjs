#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const CDP_LIST_URL = process.env.TBANK_CABINET_CDP_URL || 'http://127.0.0.1:9333/json/list';
const COMPANY_ID = process.env.TBANK_CABINET_COMPANY_ID || '5-3I1ANBJ8R';
const REMOTE = process.env.TBANK_CABINET_REMOTE || 'bela@portal.alebazia.xyz';
const REMOTE_DIR = process.env.TBANK_CABINET_REMOTE_DIR || '/home/bela/offonika-tbank-cabinet';
const LOCAL_DIR = process.env.TBANK_CABINET_LOCAL_DIR || path.join(os.homedir(), 'Library', 'Application Support', 'OFFONIKA TBank Monitor', 'collector');
const TERMINALS = new Map([
  ['1010808747019437', '10693079'],
  ['2332022071', '10630337'],
]);

function httpJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = '';
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

async function cdpClient(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let id = 0;
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  return {
    call(method, params = {}) {
      return new Promise((resolve) => {
        const requestId = ++id;
        pending.set(requestId, resolve);
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

function moscowLocalIso(date) {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).format(date).replace(' ', 'T');
  return `${parts}+03:00`;
}

async function collect() {
  const targets = await httpJson(CDP_LIST_URL);
  const page = targets.find((target) => target.type === 'page' && target.url.includes('business.tbank.ru/cashier/operations'));
  if (!page) throw new Error('TBANK_CABINET_LOGIN_REQUIRED');
  const generatedAt = new Date();
  const periodFromDate = new Date(generatedAt.getTime() - 72 * 60 * 60 * 1000);
  const periodToDate = new Date(generatedAt.getTime() + 2 * 60 * 1000);
  const client = await cdpClient(page.webSocketDebuggerUrl);
  try {
    const expression = `(async()=>{
      const output=[]; let page=0; let last=false;
      while(!last && page<100){
        const query=new URLSearchParams({periodFrom:${JSON.stringify(moscowLocalIso(periodFromDate))},periodTo:${JSON.stringify(moscowLocalIso(periodToDate))},page:String(page),size:'100',companyId:${JSON.stringify(COMPANY_ID)}});
        const response=await fetch('/cashier/analytics/api/v5/operations?'+query,{credentials:'include',cache:'no-store'});
        if(!response.ok) throw new Error('HTTP_'+response.status);
        const body=await response.json();
        if(body?.success!==true || !Array.isArray(body?.result?.content)) throw new Error('INVALID_RESPONSE');
        output.push(...body.result.content); last=body.result.last===true; page+=1;
      }
      if(!last) throw new Error('PAGINATION_LIMIT');
      return output;
    })()`;
    const response = await client.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.result?.exceptionDetails) throw new Error('TBANK_CABINET_FETCH_FAILED');
    const rows = response.result?.result?.value;
    if (!Array.isArray(rows)) throw new Error('TBANK_CABINET_RESPONSE_INVALID');
    const operations = rows.map((row) => {
      const terminalKey = TERMINALS.get(String(row.serialNumber || ''));
      const transactionDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(String(row.transactionDate || ''))
        ? `${row.transactionDate}+03:00` : String(row.transactionDate || '');
      if (!terminalKey || !row.operationId || !Number.isSafeInteger(row.amount) || row.amount <= 0
        || !['Debit', 'Credit'].includes(row.operationType)
        || !['TERM_CARD', 'TERM_SBP'].includes(row.source)
        || !Number.isFinite(new Date(transactionDate).getTime())) throw new Error('TBANK_CABINET_UNKNOWN_OPERATION');
      return {
        operationId: String(row.operationId), terminalKey, transactionDate,
        amountKopecks: row.amount, type: row.operationType, source: row.source,
      };
    });
    if (new Set(operations.map((item) => item.operationId)).size !== operations.length) throw new Error('TBANK_CABINET_DUPLICATE_OPERATION');
    return {
      version: 1,
      generatedAt: generatedAt.toISOString(),
      periodFrom: periodFromDate.toISOString(),
      periodTo: periodToDate.toISOString(),
      complete: true,
      operations,
    };
  } finally {
    client.close();
  }
}

async function main() {
  await mkdir(LOCAL_DIR, { recursive: true, mode: 0o700 });
  const snapshot = await collect();
  const temporary = path.join(LOCAL_DIR, `current.${process.pid}.json`);
  const current = path.join(LOCAL_DIR, 'current.json');
  await writeFile(temporary, `${JSON.stringify(snapshot)}\n`, { mode: 0o600 });
  await rename(temporary, current);
  const sshOptions = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15'];
  await execFileAsync('ssh', [...sshOptions, REMOTE, 'mkdir', '-p', REMOTE_DIR]);
  const remoteTemporary = `${REMOTE_DIR}/current.${process.pid}.json`;
  await execFileAsync('scp', [...sshOptions, '-q', current, `${REMOTE}:${remoteTemporary}`]);
  await execFileAsync('ssh', [...sshOptions, REMOTE, 'chmod', '600', remoteTemporary]);
  await execFileAsync('ssh', [...sshOptions, REMOTE, 'mv', remoteTemporary, `${REMOTE_DIR}/current.json`]);
  process.stdout.write(JSON.stringify({ ok: true, generatedAt: snapshot.generatedAt, operations: snapshot.operations.length }) + '\n');
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : 'UNKNOWN' }) + '\n');
  process.exitCode = 1;
});
