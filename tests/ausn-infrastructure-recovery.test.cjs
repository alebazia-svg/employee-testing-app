const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

const bashMajor = Number(spawnSync('bash',['--version'],{encoding:'utf8'}).stdout?.match(/version (\d+)/)?.[1]);
test('actual host checks cannot recover AUSN during a running or scheduled retry', {skip: bashMajor < 4 ? 'Linux host script requires GNU Bash4+; run on the VPS test fixture' : false}, () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mobo-ausn-health-'));
  try {
    const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'systemctl'), `#!/bin/bash
if [ "$1" = is-active ]; then
 if [ "$2" = ausn-report-cache-refresh.service ]; then echo "$AUSN_TEST_STATE"; else echo active; fi
elif [ "$1" = show ]; then
 if [ "$2" = ausn-report-cache-refresh.service ]; then echo "$AUSN_TEST_RESULT"; else echo success; fi
fi
`, {mode:0o700});
    fs.writeFileSync(path.join(bin, 'docker'), `#!/bin/bash
if [ "$1" = inspect ]; then echo healthy; else
 for item in "$@"; do
 case "$item" in INFRASTRUCTURE_CHECKS_JSON=*) printf '%s' "\${item#INFRASTRUCTURE_CHECKS_JSON=}" > "$AUSN_TEST_OUTPUT";; esac
 done
fi
`, {mode:0o700});
    for (const [state,result,expected] of [['active','success',false],['activating','exit-code',false],['inactive','exit-code',false],['inactive','success',true]]) {
      const output = path.join(root,'checks.json');
      const run = spawnSync('bash',['ops/systemd/run-offonika-infrastructure-watchdog.sh'], {cwd:process.cwd(),encoding:'utf8',env:{...process.env,PATH:bin+':'+process.env.PATH,BACKUP_ROOT:root,AUSN_TEST_STATE:state,AUSN_TEST_RESULT:result,AUSN_TEST_OUTPUT:output}});
      assert.equal(run.status,0,run.stderr);
      assert.ok(fs.existsSync(output), JSON.stringify({stdout:run.stdout,stderr:run.stderr}));
      const checks = JSON.parse(fs.readFileSync(output,'utf8'));
      assert.equal(checks.find(row=>row.key==='unit.ausn-report-cache-refresh').ok,expected, state+'/'+result);
      assert.equal(checks.find(row=>row.key==='unit.offonika-procurement-forecast-snapshot').ok,true);
    }
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
