import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileModal } from '../src/components/ProfileModal.tsx';

const snapshots = JSON.parse(readFileSync(new URL('./profile-modal.snapshots.json', import.meta.url), 'utf8'));
const user = {
  userId: 'profile_fixture_abc123', username: 'fixture', nickname: '测试雀友',
  avatar: 'guofeng_yushi', title: '初学雀友', bio: '测试签名', isGuest: false,
  createdAt: 0, updatedAt: 0,
};

for (const isGuest of [false, true]) {
  for (const initialTab of ['look', 'stats', 'leaderboard', 'achievements', 'security'] as const) {
    test(`profile ${isGuest ? 'guest' : 'registered'} ${initialTab} preserves DOM, text and styles`, () => {
      const html = renderToStaticMarkup(React.createElement(ProfileModal, {
        user: { ...user, isGuest }, initialTab, onClose() {},
      }));
      const hash = createHash('sha256').update(html).digest('hex');
      assert.equal(hash, snapshots[`${isGuest}:${initialTab}`]);
    });
  }
}
