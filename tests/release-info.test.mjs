import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { releaseInfo } from '../scripts/write-release-info.mjs';

const builtAt = '2026-10-04T12:00:00.000Z';
test('release metadata distinguishes committed, modified and unknown sources', () => {
  assert.equal(releaseInfo({ version: '1.1.0-rc.1', revision: 'abcdef1234567', dirty: false, builtAt }).source, 'clean');
  assert.equal(releaseInfo({ version: '1.1.0', revision: 'abcdef1234567', dirty: true, builtAt }).source, 'modified');
  assert.deepEqual(releaseInfo({ version: '1.1.0', revision: 'not-a-commit', dirty: false, builtAt }), {
    version: '1.1.0', revision: null, source: 'unknown', builtAt,
  });
});
test('invalid versions and build dates fail rather than inventing release data', () => {
  assert.throws(() => releaseInfo({ version: 'latest', builtAt }));
  assert.throws(() => releaseInfo({ version: '1.1.0', builtAt: 'invalid' }));
});
test('package and lock agree; footer no longer contains a hardcoded version', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const pkg = JSON.parse(read('../package.json'));
  const lock = JSON.parse(read('../package-lock.json'));
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(pkg.scripts.prebuild, 'node scripts/write-release-info.mjs');
  assert.doesNotMatch(read('../components/AdminShell.tsx'), /Версия 1\.0\.0/);
  assert.match(read('../components/AdminShell.tsx'), /<ReleaseLabel \/>/);
});

test('admin release label shows version and date without technical source details', () => {
  const source = readFileSync(new URL('../components/ReleaseLabel.tsx', import.meta.url), 'utf8');
  assert.match(source, /Версия \{version\}/);
  assert.match(source, /Сборка \{date\} МСК/);
  assert.match(source, /preview \? ' · тестовая'/);
  assert.doesNotMatch(source, /revision|source,|Исходный коммит|локальными изменениями/);
});

test('buyer and admin use the same release label and responsive footer styling', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
  const buyer = read('../components/ProcurementShell.tsx');
  const admin = read('../components/AdminShell.tsx');
  for (const shell of [buyer, admin]) {
    assert.match(shell, /MOBO · Портал компании/);
    assert.doesNotMatch(shell, /© 2026|Все права защищены/);
  }
  assert.match(buyer, /<ReleaseLabel \/>/);
  assert.equal(buyer.match(/<footer className='([^']+)'/)[1], admin.match(/<footer className='([^']+)'/)[1]);
  assert.ok(buyer.indexOf('<footer') > buyer.indexOf('{children}'));
  assert.doesNotMatch(buyer, /fixed|sticky|Версия \d/);
});
