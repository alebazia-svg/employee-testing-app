"""Trusted release policy and read-only probes of the actual compiled image.

This policy is installed with the release tools, not taken from a candidate
manifest. Changing an agreed capability requires a separately reviewed policy.
No credentials, application startup, network calls or production records.
"""
import json
from pathlib import Path
import re

BUILD_ARGS = {'NEXT_PUBLIC_PROCUREMENT_RECEIPTS_ENABLED': '1'}
BUILD_METADATA_ARGS = {'TARGETARCH', 'PORTAL_BUILD_REVISION'}
PUBLIC_METADATA_KEYS = {'NEXT_PUBLIC_APP_VERSION', 'NEXT_PUBLIC_APP_BUILT_AT',
                        'NEXT_PUBLIC_APP_REVISION', 'NEXT_PUBLIC_APP_SOURCE'}
POLICY_VERSION = 1


class ContractError(ValueError):
    pass


def require(ok, message):
    if not ok:
        raise ContractError(message)


def build_arguments(source, compose, receipts_override=None):
    """Only committed/exported source and uninterpolated Compose data are read."""
    require(receipts_override in (None, '1'),
            'Receipt collection is required; --receipts-enabled 0 is forbidden by approved production policy')
    dockerfile = (Path(source) / 'Dockerfile').read_text()
    args = set(re.findall(r'^\s*ARG\s+([A-Za-z_][A-Za-z0-9_]*)(?:=|\s|$)', dockerfile, re.M | re.I))
    require(args == set(BUILD_ARGS) | BUILD_METADATA_ARGS,
            'Docker build arguments changed; review the production capability policy')
    configured = compose.get('services', {}).get('portal-app', {}).get('build', {}).get('args', {})
    require(configured == BUILD_ARGS, 'Compose build arguments differ from approved production policy')
    public_keys = set()
    for path in Path(source).rglob('*'):
        if path.is_file() and path.suffix in ('.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'):
            matches = re.findall(r'''process\.env(?:\.(NEXT_PUBLIC_[A-Z0-9_]+)|\[['"](NEXT_PUBLIC_[A-Z0-9_]+)['"]\])''', path.read_text())
            public_keys.update(value for match in matches for value in match if value)
    require(public_keys <= set(BUILD_ARGS) | PUBLIC_METADATA_KEYS,
            'Unreviewed public build feature; extend the production capability policy explicitly')
    return dict(BUILD_ARGS)


# Read from the real image. Inspecting the runner ENV is insufficient because
# Next.js replaces build-time public flags and can remove a component entirely.
ARTIFACT_PROBE = r'''
const fs=require('node:fs'),path=require('node:path');
function walk(root){
 const result=[];
 function visit(dir){for(const file of fs.readdirSync(dir,{withFileTypes:true})){
  if(file.isSymbolicLink())throw Error('Artifact contains unsupported symlink');
  const name=path.join(dir,file.name);
  if(file.isDirectory())visit(name);else if(file.isFile())result.push(name);
  if(result.length>10000)throw Error('Artifact inventory exceeds safe bound');
 }}visit(root);return result;
}
const app=JSON.parse(fs.readFileSync('/app/.next/server/app-paths-manifest.json','utf8'));
const routes=Object.keys(app).sort();
const assets=walk('/app/public').map(p=>path.relative('/app/public',p))
 .filter(p=>p!=='release-info.json').sort();
const chunks=walk('/app/.next/static/chunks').filter(p=>p.endsWith('.js'));
let receiptLoader=false;
for(const file of chunks){if(fs.readFileSync(file,'utf8').includes('/api/procurement/receipts?')){
 receiptLoader=true;break;
}}
process.stdout.write(JSON.stringify({format:1,routes,assets,capabilities:{procurement_receipts:receiptLoader}}));
'''


def validate_artifact(report):
    require(isinstance(report, dict) and type(report.get('format')) is int and report['format'] == POLICY_VERSION,
            'Missing or unsupported compiled capability report; prepare with current release tools')
    capabilities = report.get('capabilities')
    require(isinstance(capabilities, dict) and set(capabilities) == {'procurement_receipts'}
            and capabilities['procurement_receipts'] is True,
            'Compiled receipt/requisite loader is missing; release blocked')
    for field in ('routes', 'assets'):
        values = report.get(field)
        require(isinstance(values, list) and 0 < len(values) <= 10000
                and all(isinstance(v, str) and 0 < len(v) <= 512 and '\x00' not in v and '..' not in v.split('/') for v in values)
                and values == sorted(set(values)), 'Invalid compiled artifact inventory: ' + field)
    require('/api/procurement/receipts/route' in report['routes'], 'Receipt read endpoint missing from compiled image')
    return report


def verify_continuity(previous, candidate):
    # An already broken baseline must not prevent its repair. Required candidate
    # capabilities are independently enforced above, even if the baseline lacked them.
    validate_artifact(candidate)
    require(isinstance(previous, dict) and previous.get('format') == POLICY_VERSION,
            'Unable to inspect the current compiled artifact')
    for field in ('routes', 'assets'):
        require(isinstance(previous.get(field), list) and previous[field],
                'Current artifact inventory unavailable: ' + field)
        removed = sorted(set(previous[field]) - set(candidate[field]))
        require(not removed, 'Existing ' + field + ' removed; separately review the intended change: ' + ', '.join(removed[:8]))


def validate_manifest_contract(manifest):
    require(manifest.get('build_args') == BUILD_ARGS, 'Missing or changed approved build arguments; prepare with current release tools')
    validate_artifact(manifest.get('artifact'))


def probe(host, image=None):
    if image:
        command = ['docker', 'run', '--rm', '--network', 'none', '--read-only',
                   '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory', '256m',
                   '--cpus', '1', '--pids-limit', '64', '--entrypoint', 'node', image]
    else:
        command = ['docker', 'exec', 'portal-app', 'node']
    output = host.run(*command, '-e', ARTIFACT_PROBE, timeout=60)
    require(len(output.encode()) <= 48000, 'Compiled capability report exceeds session plan budget')
    return json.loads(output)
