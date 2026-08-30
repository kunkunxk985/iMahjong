import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures: string[] = [];

interface LayerRule {
  directory: string;
  forbiddenPackages: string[];
  forbidNodeBuiltins?: boolean;
}

const layers: LayerRule[] = [
  {
    directory: 'packages/shared/src',
    forbiddenPackages: ['@pizhou/rules', '@pizhou/server-core'],
    forbidNodeBuiltins: true,
  },
  {
    directory: 'packages/rules/src',
    forbiddenPackages: ['@pizhou/server-core'],
    forbidNodeBuiltins: true,
  },
  {
    directory: 'packages/server-core/src',
    forbiddenPackages: ['@pizhou/server-core'],
  },
];

function sourceFiles(directory: string): string[] {
  const absolute = path.join(root, directory);
  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(relative));
    else if (/\.(?:ts|tsx|mts)$/.test(entry.name)) files.push(relative);
  }
  return files;
}

for (const layer of layers) {
  for (const file of sourceFiles(layer.directory)) {
    const source = readFileSync(path.join(root, file), 'utf8');
    const imports = source.matchAll(/\b(?:from|import)\s*(?:\(\s*)?['"]([^'"]+)['"]/g);
    for (const match of imports) {
      const specifier = match[1]!;
      if (layer.forbidNodeBuiltins && specifier.startsWith('node:')) {
        failures.push(`${file}: 浏览器可复用层不能导入 ${specifier}`);
      }
      if (layer.forbiddenPackages.some((name) => specifier === name || specifier.startsWith(`${name}/`))) {
        failures.push(`${file}: 不允许反向依赖 ${specifier}`);
      }
    }
  }
}

const tileNames = [
  ...['wan', 'tong', 'tiao'].flatMap((suit) => Array.from({ length: 9 }, (_, index) => `tiles/${suit}-${index + 1}.png`)),
  ...Array.from({ length: 3 }, (_, index) => `tiles/dragon-${index + 1}.png`),
];
const runtimeAssets = ['tile-back.png', 'felt.jpg', 'wood.jpg', 'corner.png', ...tileNames];

for (const asset of runtimeAssets) {
  const relative = path.join('apps/desktop/public/assets', asset);
  const absolute = path.join(root, relative);
  if (!existsSync(absolute)) {
    failures.push(`${relative}: 运行素材缺失`);
  } else if (statSync(absolute).size === 0) {
    failures.push(`${relative}: 运行素材为空文件`);
  }
}

if (!existsSync(path.join(root, 'apps/server/src/index.ts'))) {
  failures.push('apps/server/src/index.ts: 独立服务适配入口缺失');
}

if (failures.length > 0) {
  console.error('架构检查失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`架构边界与 ${runtimeAssets.length} 个运行素材检查通过`);
}
