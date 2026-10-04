import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
let build = {};
try {
  const saved = JSON.parse(readFileSync(new URL('./public/release-info.json', import.meta.url), 'utf8'));
  if (saved.version === version) build = saved;
} catch { /* A development checkout may not have been built yet. */ }
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_APP_BUILT_AT: build.builtAt || '',
    NEXT_PUBLIC_APP_REVISION: build.revision || '',
    NEXT_PUBLIC_APP_SOURCE: build.source || 'unknown',
  },
};
export default nextConfig;
