export function handoverEnvironment() {
  const test = process.env.RETAIL_CASH_HANDOVER_TEST_ENABLED === '1';
  const production = process.env.RETAIL_CASH_HANDOVER_ENABLED === '1';
  if (test === production) return null;
  const base = test ? 'trade83_ut11_Test' : 'Teleinvest_UT11';
  try {
    const url = new URL(process.env['1C_BASE_URL'] ?? '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.search || url.hash || url.pathname.replace(/\/$/, '').toLowerCase() !==
        `/${base}/hs/agent`.toLowerCase()) return null;
    return { base, environment: test ? 'test' : 'production', url: url.href.replace(/\/$/, '') };
  } catch {
    return null;
  }
}
