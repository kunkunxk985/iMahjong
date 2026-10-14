import { join } from 'node:path';
import { createRequire } from 'node:module';

// Tests run from apps/desktop, so resolve electron from this workspace's own
// node_modules rather than the repo root (which may pin a different version).
const require = createRequire(import.meta.url);

/**
 * Resolve an Electron executable that `child_process.spawn` can actually launch.
 *
 * `require('electron')` returns the `.app` bundle path (Electron's documented
 * contract for the Electron runtime itself), but spawning a `.app` *directory*
 * is rejected with EACCES on current macOS — only the inner Mach-O binary is
 * directly executable. Every test harness that launches Electron for a headless
 * render must go through this helper instead of spawning the bundle path.
 */
export function electronBinary() {
  const electronPath = require('electron');
  if (process.platform === 'darwin' && electronPath.endsWith('.app')) {
    return join(electronPath, 'Contents', 'MacOS', 'Electron');
  }
  return electronPath;
}
