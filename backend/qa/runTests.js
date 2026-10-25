import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backend = fileURLToPath(new URL('../', import.meta.url));
const selected = [];
const excluded = [];
for (const file of fs.readdirSync(`${backend}/test`).filter(f => f.endsWith('.test.js')).sort()) {
  const source = fs.readFileSync(`${backend}/test/${file}`, 'utf8');
  // Legacy local-demo suites are intentionally excluded: they seed/reset existing accounts.
  if (/mongoose\.connect|connectDB|seedInitialDemoWorkspaces/.test(source) && !source.includes('MongoMemoryServer')) excluded.push(file);
  else selected.push(`test/${file}`);
}
console.log('Legacy local-database suites excluded:', excluded.join(', '));
const run = spawnSync(process.execPath, ['--import', './qa/noLiveDatabase.js', '--test', '--test-concurrency=4', ...selected], {
  cwd: backend, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', EMAIL_PROVIDER: 'inmemory', AUTH_REQUIRE_EMAIL_VERIFICATION: 'true' },
});
process.exit(run.status ?? 1);
