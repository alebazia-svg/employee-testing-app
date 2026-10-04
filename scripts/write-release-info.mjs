import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function releaseInfo({ version, revision, dirty, builtAt }) {
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid release version');
  if (!Number.isFinite(Date.parse(builtAt))) throw new Error('Invalid build date');
  const commit = /^[0-9a-f]{7,40}$/.test(revision || '') ? revision : null;
  return { version, revision: commit, source: commit ? (dirty ? 'modified' : 'clean') : 'unknown', builtAt };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = new URL('../', import.meta.url);
  const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  let revision = null;
  let dirty = true;
  try {
    revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    dirty = Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim());
  } catch { /* Archives/Docker without Git must not claim a known clean commit. */ }
  const info = releaseInfo({ version, revision, dirty, builtAt: new Date().toISOString() });
  writeFileSync(new URL('public/release-info.json', root), JSON.stringify(info, null, 2) + '\n');
  console.log(`Release ${info.version} (${info.source}) built ${info.builtAt}`);
}
