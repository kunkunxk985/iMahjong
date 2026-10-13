import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pbkdf2Sync } from 'node:crypto';
import * as passwords from '../src/password.ts';

const password = 'fixture-only-passphrase';
function stored(iterations: number): string {
  const salt = Buffer.from('0123456789abcdef');
  return `pbkdf2-sha256$${iterations}$${salt.toString('base64url')}$${pbkdf2Sync(password, salt, iterations, 32, 'sha256').toString('base64url')}`;
}

test('密码算法共享但保留 Node/Worker 各自的平台策略', async () => {
  const factory = (passwords as any).createPasswordHasher;
  assert.equal(typeof factory, 'function', '缺少支持平台策略的共享工厂');
  const node = factory({ iterations: 120_000, maxVerifyIterations: 1_000_000 });
  const worker = factory({ iterations: 100_000, maxVerifyIterations: 100_000 });
  const nodeHash = await node.hashPassword(password);
  const workerHash = await worker.hashPassword(password);
  assert.equal(nodeHash.split('$')[1], '120000');
  assert.equal(workerHash.split('$')[1], '100000');
  assert.deepEqual(await node.verifyPassword(password, stored(120_000)), { valid: true, needsUpgrade: false });
  assert.deepEqual(await node.verifyPassword(password, stored(100_000)), { valid: true, needsUpgrade: true });
  assert.deepEqual(await worker.verifyPassword(password, stored(120_000)), { valid: false, needsUpgrade: false });
  assert.deepEqual(await worker.verifyPassword(password, stored(100_000)), { valid: true, needsUpgrade: false });
});

test('正确密码、错误密码和 legacy SHA256 均保持兼容', async () => {
  const hash = await passwords.hashPassword(password);
  assert.equal((await passwords.verifyPassword(password, hash)).valid, true);
  assert.equal((await passwords.verifyPassword('wrong', hash)).valid, false);
  const legacy = await passwords.legacyHashPassword(password);
  assert.deepEqual(await passwords.verifyPassword(password, legacy), { valid: true, needsUpgrade: true });
});

test('拒绝截断/空盐/非法格式哈希', async () => {
  const truncated = stored(100_000).split('$');
  truncated[3] = Buffer.from(pbkdf2Sync(password, Buffer.from('0123456789abcdef'), 100_000, 32, 'sha256').subarray(0, 1)).toString('base64url');
  for (const hash of ['', truncated.join('$'), 'pbkdf2-sha256$100000$$', 'pbkdf2-sha256$100000$!!!!$!!!!', 'pbkdf2-sha256$999999999$salt$hash']) {
    assert.equal((await passwords.verifyPassword(password, hash)).valid, false, hash);
  }
});
