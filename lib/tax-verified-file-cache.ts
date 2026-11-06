import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';

const maxFileBytes = BigInt(12 * 1024 * 1024);
const entries = new Map<string, Promise<unknown>>();
const fingerprint = (s: Awaited<ReturnType<typeof metadata>>) => `${s.dev}:${s.ino}:${s.size}:${s.mtimeNs}:${s.ctimeNs}`;
const metadata = (file: string) => lstat(file, { bigint: true });

// Only parsed, checksum-verified immutable file contents are reused. Callers
// still authorize and select the newest document and resolve its current links.
// A missing/changed/broken latest file never falls back to an older success.
export async function loadVerifiedTaxFile<T>(namespace: string, file: string, sha: string, parse: (bytes: Buffer) => T | undefined | Promise<T | undefined>): Promise<T | undefined> {
  let cacheKey: string | undefined;
  try {
    if (!/^[0-9a-f]{64}$/i.test(sha)) return;
    const stat = await metadata(file);
    if (!stat.isFile() || stat.size > maxFileBytes) return;
    const stamp = fingerprint(stat);
    const key = JSON.stringify([namespace, file, sha, stamp]);
    cacheKey = key;
    let pending = entries.get(key) as Promise<T | undefined> | undefined;
    if (!pending) {
      pending = (async () => {
        const bytes = await readFile(file);
        if (createHash('sha256').update(bytes).digest('hex') !== sha.toLowerCase()) return;
        const parsed = await parse(bytes);
        if (fingerprint(await metadata(file)) !== stamp) return;
        return parsed;
      })();
      entries.set(key, pending);
      while (entries.size > 12) entries.delete(entries.keys().next().value!);
    }
    const parsed = await pending;
    if (parsed === undefined || fingerprint(await metadata(file)) !== stamp) {
      entries.delete(key);
      return;
    }
    return structuredClone(parsed);
  } catch {
    if (cacheKey) entries.delete(cacheKey);
    return;
  }
}
