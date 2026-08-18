import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { bundleElectron } from './bundle-electron.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  root,
  configFile: path.join(root, 'vite.config.ts'),
});
await bundleElectron();
console.log('desktop build done: dist/ + dist-electron/');
