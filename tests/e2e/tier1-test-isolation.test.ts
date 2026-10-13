import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';
import { DiskAccountStore } from '@pizhou/server-core';
import { createTestServer } from './helpers/test-harness.ts';

test('每个 E2E 服务拥有独立临时数据目录并在关闭后删除', async () => {
  const first = await createTestServer();
  const second = await createTestServer();
  try {
    const a = first.server.accountStore as DiskAccountStore;
    const b = second.server.accountStore as DiskAccountStore;
    // Inspect the configured path; no writes to the user's default store.
    const firstPath = a.dirPath;
    const secondPath = b.dirPath;
    assert.equal(typeof firstPath, 'string');
    assert.equal(typeof secondPath, 'string');
    assert.notEqual(firstPath, secondPath, '两个测试服务不能共用账号存储');
  } finally {
    await first.close();
    await second.close();
  }
  assert.equal(existsSync((first.server.accountStore as DiskAccountStore).dirPath), false);
  assert.equal(existsSync((second.server.accountStore as DiskAccountStore).dirPath), false);
});
