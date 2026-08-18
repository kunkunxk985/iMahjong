import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['dist', 'dist-electron', 'release'];

await Promise.all(
  targets.map(async (name) => {
    await fs.rm(path.join(root, name), { recursive: true, force: true });
    console.log(`cleaned apps/desktop/${name}`);
  }),
);
