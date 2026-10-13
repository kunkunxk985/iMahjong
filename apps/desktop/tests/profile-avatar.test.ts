import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encodeAvatarFile } from '../src/components/profile/avatarImage.ts';

test('avatar encoder rejects unsupported types and oversized source images before decoding', async () => {
  await assert.rejects(encodeAvatarFile({ type: 'image/gif', size: 1 } as File), /仅支持 JPG、PNG 或 WebP/);
  await assert.rejects(encodeAvatarFile({ type: 'image/png', size: 8 * 1024 * 1024 + 1 } as File), /不能超过 8MB/);
});

test('avatar encoder crops centrally, lowers quality and revokes its source URL', async (t) => {
  const revoked: string[] = [];
  t.mock.method(URL, 'createObjectURL', () => 'blob:avatar-test');
  t.mock.method(URL, 'revokeObjectURL', (url) => { revoked.push(url); });
  const drawCalls: unknown[][] = [];
  const qualityCalls: [string, number][] = [];
  const context = { clearRect() {}, drawImage(...args: unknown[]) { drawCalls.push(args); } };
  const canvas = { width: 0, height: 0, getContext: () => context, toDataURL(mime: string, quality: number) {
    qualityCalls.push([mime, quality]);
    return quality === 0.82 ? 'data:image/webp;base64,' + 'A'.repeat(100_000) : 'data:image/webp;base64,AAAA';
  } };
  class FakeImage {
    naturalWidth = 200; naturalHeight = 100; onload: (() => void) | null = null;
    set src(_value: string) { this.onload?.(); }
  }
  for (const [name, value] of [['Image', FakeImage], ['document', { createElement: () => canvas }]] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : Reflect.deleteProperty(globalThis, name));
  }
  assert.equal(await encodeAvatarFile({ type: 'image/png', size: 100 } as File), 'data:image/webp;base64,AAAA');
  assert.equal(canvas.width, 96);
  assert.equal(canvas.height, 96);
  assert.deepEqual(drawCalls[0].slice(1), [-48, 0, 192, 96]);
  assert.deepEqual(qualityCalls, [['image/webp', 0.82], ['image/webp', 0.82], ['image/webp', 0.72]]);
  assert.deepEqual(revoked, ['blob:avatar-test']);
});

test('avatar encoder revokes the source URL even when image decoding fails', async (t) => {
  const revoked: string[] = [];
  t.mock.method(URL, 'createObjectURL', () => 'blob:invalid-avatar');
  t.mock.method(URL, 'revokeObjectURL', (url) => { revoked.push(url); });
  class InvalidImage {
    onerror: (() => void) | null = null;
    set src(_value: string) { this.onerror?.(); }
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: InvalidImage });
  t.after(() => descriptor ? Object.defineProperty(globalThis, 'Image', descriptor) : Reflect.deleteProperty(globalThis, 'Image'));
  await assert.rejects(encodeAvatarFile({ type: 'image/jpeg', size: 100 } as File), /图片读取失败/);
  assert.deepEqual(revoked, ['blob:invalid-avatar']);
});
