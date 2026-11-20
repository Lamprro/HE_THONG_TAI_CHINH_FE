import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const [app, task, ...args] = process.argv.slice(2);
if (!['admin', 'user', 'all'].includes(app) || !['build', 'test', 'typecheck', 'dev'].includes(task)) {
  throw new Error('Choose admin, user or all and build, test, typecheck or dev');
}
if (!process.env.npm_execpath) throw new Error('Run this script through npm or pnpm');
for (const name of app === 'all' ? ['admin', 'user'] : [app]) {
  const cwd = fileURLToPath(new URL(`../apps/${name}/`, import.meta.url));
  const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', task, ...args], { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
