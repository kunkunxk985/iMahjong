import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { electronBinary } from './helpers/electronSpawn.mjs';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.SOLO_APP_ROOT ||= fileURLToPath(new URL('../', import.meta.url));
for (const scenario of ['normal', 'failure', 'timeout', 'occupied']) {
  const child = spawn(electronBinary(), [fileURLToPath(new URL('./solo-launch.cjs', import.meta.url))], {
    env: { ...env, SOLO_SCENARIO: scenario }, stdio: 'inherit',
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) { process.exitCode = code || 1; break; }
}
