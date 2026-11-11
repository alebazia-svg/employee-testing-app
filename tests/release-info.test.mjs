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

test('Docker archive metadata accepts only a full supplied commit and refuses Git mismatches', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, cpSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const root = mkdtempSync(join(tmpdir(), 'portal-release-info-'));
  try {
    mkdirSync(join(root, 'scripts'));
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '1.0.1' }));
    cpSync(new URL('../scripts/write-release-info.mjs', import.meta.url), join(root, 'scripts/write-release-info.mjs'));
    const execute = revision => spawnSync(process.execPath, ['scripts/write-release-info.mjs'], {
      cwd: root, env: { ...process.env, PORTAL_BUILD_REVISION: revision }, encoding: 'utf8',
    });
    // Hide Git discovery of ancestor directories, as in the Docker build context.
    const full = 'b'.repeat(40);
    assert.equal(execute(full).status, 0);
    const metadata = JSON.parse(readFileSync(join(root, 'public/release-info.json'), 'utf8'));
    assert.equal(metadata.revision, full);
    assert.equal(metadata.source, 'clean');
    assert.notEqual(execute('HEAD').status, 0);
    assert.notEqual(execute('abcdef1').status, 0);
    assert.equal(spawnSync('git', ['init', '-q'], { cwd: root }).status, 0);
    assert.equal(spawnSync('git', ['add', 'package.json'], { cwd: root }).status, 0);
    assert.equal(spawnSync('git', ['-c', 'user.name=Release test', '-c', 'user.email=release@example.test',
      'commit', '-qm', 'fixture'], { cwd: root }).status, 0);
    assert.notEqual(execute(full).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
