import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.SOLO_APP_ROOT ||= fileURLToPath(new URL('../', import.meta.url));
for (const scenario of ['normal', 'failure', 'timeout', 'occupied']) {
  const child = spawn(require('electron'), [fileURLToPath(new URL('./solo-launch.cjs', import.meta.url))], {
    env: { ...env, SOLO_SCENARIO: scenario }, stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) { process.exitCode = code || 1; break; }
}
