/** Open only a native document link supplied by the configured transfer source. */
export function warehouseTransferHref(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source=value as Record<string,unknown>;
  const infobase=process.env.WAREHOUSE_BASE;
  if (!infobase || !['Teleinvest_UT11','trade83_ut11_Test'].includes(infobase) || source.base!==infobase || typeof source.navigation!=='string' ||
      !/^e1cib\/data\/Документ\.ПеремещениеТоваров\?ref=[\da-f]{32}$/iu.test(source.navigation)) return null;
  return 'e1c://server/1cserv:1741/'+encodeURIComponent(infobase)+'#'+source.navigation;
}
