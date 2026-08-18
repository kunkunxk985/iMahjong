import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repo = path.resolve(root, '../..');

export async function bundleElectron() {
  const common = {
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['electron'],
    sourcemap: true,
    alias: {
      '@pizhou/shared': path.join(repo, 'packages/shared/src/index.ts'),
      '@pizhou/rules': path.join(repo, 'packages/rules/src/index.ts'),
      '@pizhou/server-core': path.join(repo, 'packages/server-core/src/index.ts'),
    },
  };
  await esbuild.build({
    ...common,
    entryPoints: [path.join(root, 'electron/main.ts')],
    outfile: path.join(root, 'dist-electron/main.js'),
  });
  await esbuild.build({
    ...common,
    entryPoints: [path.join(root, 'electron/preload.ts')],
    outfile: path.join(root, 'dist-electron/preload.js'),
  });
}

if (process.argv[1] && path.normalize(process.argv[1]) === path.normalize(fileURLToPath(import.meta.url))) {
  await bundleElectron();
}
