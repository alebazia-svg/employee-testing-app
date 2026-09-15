import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const requiredIdentityAssets = [
  'public/brand/mobo-master/mobo-symbol.svg',
  'public/brand/mobo-master/mobo-wordmark.svg',
  'public/brand/mobo-master/mobo-symbol-3d-premium.svg',
  'public/brand/mobo-master/mobo-symbol-3d-ui.svg',
  'public/brand/mobo-master/mobo-symbol-3d-light-ui.svg',
  'public/portal-app-icon-180.png',
  'public/portal-app-icon-192.png',
  'public/portal-app-icon-512.png',
  'public/portal-app-icon-maskable-512.png',
  'public/favicon-32x32.png',
];

test('approved MOBO identity assets and PWA metadata stay connected', async () => {
  await Promise.all(requiredIdentityAssets.map((path) => access(path)));

  const [manifestText, layoutSource, loginSource, identitySource, adminSource, procurementSource, employeeHeaderSource, employeeSource, brandStyles, serviceWorkerSource, dimensionalSymbol, uiDimensionalSymbol, lightUiSymbol, flatSymbol, wordmark] = await Promise.all([
    readFile('public/manifest.webmanifest', 'utf8'),
    readFile('app/layout.tsx', 'utf8'),
    readFile('app/login/page.tsx', 'utf8'),
    readFile('components/PortalIdentityBlock.tsx', 'utf8'),
    readFile('components/AdminShell.tsx', 'utf8'),
    readFile('components/ProcurementShell.tsx', 'utf8'),
    readFile('app/(dashboard)/employee/EmployeePortalHeader.tsx', 'utf8'),
    readFile('app/(dashboard)/employee/EmployeeTodayClient.tsx', 'utf8'),
    readFile('app/mobo-brand.css', 'utf8'),
    readFile('public/workday-sw.js', 'utf8'),
    readFile('public/brand/mobo-master/mobo-symbol-3d-premium.svg', 'utf8'),
    readFile('public/brand/mobo-master/mobo-symbol-3d-ui.svg', 'utf8'),
    readFile('public/brand/mobo-master/mobo-symbol-3d-light-ui.svg', 'utf8'),
    readFile('public/brand/mobo-master/mobo-symbol.svg', 'utf8'),
    readFile('public/brand/mobo-master/mobo-wordmark.svg', 'utf8'),
  ]);

  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.name, 'MOBO · Портал компании');
  assert.equal(manifest.short_name, 'MOBO');
  assert.deepEqual(manifest.icons.map((icon) => icon.src), [
    '/portal-app-icon-192.png',
    '/portal-app-icon-512.png',
    '/portal-app-icon-maskable-512.png',
  ]);
  assert.match(layoutSource, /applicationName: 'MOBO'/);
  assert.match(loginSource, /mobo-symbol-3d-ui\.svg/);
  assert.match(loginSource, /mobo-wordmark\.svg/);
  assert.match(loginSource, /grid w-\[314px\][\s\S]*?sm:w-\[74px\][\s\S]*?text-\[13px\][\s\S]*?Портал компании/);
  assert.doesNotMatch(loginSource, /blur-\[12px\]/);
  assert.match(loginSource, /radial-gradient\(ellipse at 28% 4%[\s\S]*?linear-gradient\(145deg, #fffefa 0%, #faf7f1 50%, #f1ebe2 100%\)/);
  assert.match(loginSource, /inset_0_1px_0_rgba\(255,255,255,0\.92\)/);
  assert.match(loginSource, /data\.portalArea === 'PROCUREMENT' \? '\/procurement'/);
  for (const symbolSource of [dimensionalSymbol, flatSymbol]) {
    assert.match(symbolSource, /feMorphology[\s\S]*?operator="erode" radius="5"/);
  }
  assert.match(uiDimensionalSymbol, /feDropShadow dx="5" dy="6" stdDeviation="2\.2"/);
  assert.doesNotMatch(uiDimensionalSymbol, /feTurbulence|feGaussianBlur|feMorphology/);
  assert.match(uiDimensionalSymbol, /<use href="#ui-shape" fill="url\(#ui-face\)"\/>/);
  assert.match(lightUiSymbol, /linearGradient id="pearl-face"/);
  assert.match(lightUiSymbol, /stdDeviation="1\.8"/);
  assert.doesNotMatch(lightUiSymbol, /feMorphology|feGaussianBlur/);
  assert.match(wordmark, /stroke-width="12"/);
  assert.match(wordmark, /<rect x="116" y="10" width="72" height="62" rx="31"/);
  assert.match(identitySource, /\/brand\/mobo-master\/mobo-symbol-3d-light-ui\.svg/);
  assert.match(identitySource, /\/brand\/mobo-master\/mobo-wordmark\.svg/);
  assert.match(adminSource, /PortalIdentityBlock variant='mobo-master'/);
  assert.match(adminSource, /mobo-symbol-3d-light-ui\.svg/);
  assert.match(procurementSource, /PortalIdentityBlock variant='mobo-master'/);
  assert.match(brandStyles, /\.mobo-master-admin \.admin-mobile-header \.mobo-master-wordmark/);
  assert.match(brandStyles, /\.procurement-shell-header \.mobo-master-wordmark[\s\S]*?brightness\(0\) invert\(1\)/);
  assert.match(employeeHeaderSource, /employee-material-profile-initials/);
  assert.match(employeeSource, /function ColleaguesGlyph\(\)[\s\S]*?portal-brand-strong[\s\S]*?portal-brand-colleague-blue/);
  assert.match(employeeSource, /secondaryColor=\{active \? 'var\(--portal-brand-colleague-blue\)' : '#b6babd'\}/);
  assert.match(brandStyles, /--portal-brand-colleague-blue: #829fbd;/);
  assert.match(brandStyles, /--portal-brand-qr-blue: #b8cce0;/);
  assert.doesNotMatch(serviceWorkerSource, /pwa-wordmark-blue/);
  assert.match(serviceWorkerSource, /icon: '\/portal-app-icon-192\.png'/);
});
