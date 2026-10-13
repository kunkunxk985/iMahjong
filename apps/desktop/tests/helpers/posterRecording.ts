import type { TestContext } from 'node:test';

/** Records commands/property writes, not pixels. Text metrics are deterministic. */
export function recordPoster(t: TestContext, options: {
  fonts?: { ready: Promise<unknown> };
  missingContext?: boolean;
  drawError?: Error;
  exportError?: Error;
} = {}) {
  const calls: unknown[][] = [];
  let gradientId = 0;
  const values: Record<string, unknown> = {};
  const context = new Proxy(values, {
    get(target, key: string) {
      if (key in target) return target[key];
      return (...args: unknown[]) => {
        calls.push([key, ...args]);
        if (options.drawError && key === 'fillRect') throw options.drawError;
        if (key === 'measureText') return { width: String(args[0]).length * 8 };
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          const id = ++gradientId;
          return { id, addColorStop: (...stops: unknown[]) => calls.push(['colorStop', id, ...stops]) };
        }
      };
    },
    set(target, key: string, value) {
      calls.push(['set', key, value]);
      target[key] = value;
      return true;
    },
  });
  const canvas = {
    width: 0, height: 0,
    getContext: (kind: string) => {
      calls.push(['getContext', kind]);
      return options.missingContext ? null : context;
    },
    toDataURL: (...args: unknown[]) => {
      calls.push(['toDataURL', ...args]);
      if (options.exportError) throw options.exportError;
      return 'data:image/png;base64,recorded';
    },
  };
  const link = { href: '', download: '', click: () => calls.push(['click']) };
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    fonts: options.fonts,
    createElement: (tag: string) => {
      calls.push(['createElement', tag]);
      return tag === 'canvas' ? canvas : link;
    },
    body: {
      appendChild: (child: unknown) => calls.push(['appendChild', child === link]),
      removeChild: (child: unknown) => calls.push(['removeChild', child === link]),
    },
  } });
  return { calls, canvas, link };
}
