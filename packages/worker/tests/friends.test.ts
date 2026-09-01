import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { HubDatabase } from '../src/db.js';

describe('Cloudflare DO HubDatabase Friends & Social', () => {
  const db = new HubDatabase();

  let userA: any = null;
  let userB: any = null;

  test('创建两个测试用户', async () => {
    const resA = await db.register('player_a', '123456', '雀圣A');
    const resB = await db.register('player_b', '123456', '雀友B');

    assert.ok(typeof resA !== 'string');
    assert.ok(typeof resB !== 'string');

    userA = resA.user;
    userB = resB.user;

    assert.equal(userA.nickname, '雀圣A');
    assert.equal(userB.nickname, '雀友B');
  });

  test('支持按账号、昵称、ID 检索玩家', async () => {
    const results = await db.searchUsers('player_b', userA.userId);
    assert.equal(results.length, 1);
    assert.equal(results[0].userId, userB.userId);
    assert.equal(results[0].isFriend, false);
    assert.equal(results[0].hasPendingRequest, false);
  });

  test('不能添加自己为好友，不能重复发送申请', async () => {
    const selfErr = await db.sendFriendRequest(userA.userId, userA.userId);
    assert.equal(selfErr, '不能添加自己为好友');

    const sendRes = await db.sendFriendRequest(userA.userId, userB.userId);
    assert.deepEqual(sendRes, { success: true });

    const dupErr = await db.sendFriendRequest(userA.userId, userB.userId);
    assert.equal(dupErr, '好友申请已发送，等待对方同意');
  });

  test('被申请人收到好友申请并成功同意', async () => {
    const requests = await db.getFriendRequests(userB.userId);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].fromUserId, userA.userId);
    assert.equal(requests[0].fromNickname, '雀圣A');

    const acceptRes = await db.respondFriendRequest(requests[0].id, userB.userId, true);
    assert.deepEqual(acceptRes, { success: true });

    // 检查双向好友关系
    const friendsA = await db.getFriends(userA.userId);
    assert.equal(friendsA.length, 1);
    assert.equal(friendsA[0].userId, userB.userId);

    const friendsB = await db.getFriends(userB.userId);
    assert.equal(friendsB.length, 1);
    assert.equal(friendsB[0].userId, userA.userId);
  });

  test('支持删除好友并双向解除关系', async () => {
    await db.deleteFriend(userA.userId, userB.userId);

    const friendsA = await db.getFriends(userA.userId);
    assert.equal(friendsA.length, 0);

    const friendsB = await db.getFriends(userB.userId);
    assert.equal(friendsB.length, 0);
  });
});
