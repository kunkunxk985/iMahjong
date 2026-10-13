import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { evaluateAchievements, calculateCareerStats, type UserProfile } from '@pizhou/shared';
import { ProfileLookTab } from '../src/components/profile/ProfileLookTab.tsx';
import { ProfileStatsTab } from '../src/components/profile/ProfileStatsTab.tsx';
import { ProfileLeaderboardTab } from '../src/components/profile/ProfileLeaderboardTab.tsx';
import { ProfileAchievementsTab } from '../src/components/profile/ProfileAchievementsTab.tsx';
import { ProfileSecurityTab } from '../src/components/profile/ProfileSecurityTab.tsx';

function elements(node: React.ReactNode): React.ReactElement<any>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!React.isValidElement(node)) return [];
  return [node, ...elements((node.props as any).children)];
}
function button(tree: React.ReactNode, label: string) {
  const match = elements(tree).find((element) => element.type === 'button' && elementsText(element.props.children).includes(label));
  assert.ok(match, `button ${label} exists`);
  return match;
}
function elementsText(node: React.ReactNode): string {
  if (Array.isArray(node)) return node.map(elementsText).join('');
  if (React.isValidElement(node)) return elementsText((node.props as any).children);
  return typeof node === 'string' || typeof node === 'number' ? String(node) : '';
}

test('look tab forwards edits, picker mode and file selection to retained parent state', () => {
  const changes: unknown[] = [];
  const record = (value: unknown) => changes.push(value);
  const tree = ProfileLookTab({ avatar: '🀄', nickname: '雀友', title: '初学雀友', bio: '签名', avatarTab: 'custom', uploadingAvatar: false,
    avatarError: null, unlockedTitles: ['初学雀友'], setAvatar: record, setNickname: record, setTitle: record,
    setBio: record, setAvatarTab: record, handleAvatarFile: record });
  const nodes = elements(tree);
  nodes.find((node) => node.type === 'input' && node.props.type === 'text')!.props.onChange({ target: { value: '新昵称' } });
  nodes.find((node) => node.type === 'textarea')!.props.onChange({ target: { value: '新签名' } });
  nodes.find((node) => node.type === 'select')!.props.onChange({ target: { value: '新称号' } });
  button(tree, '预设头像').props.onClick();
  button(tree, '🀄').props.onClick();
  const fileEvent = { target: { files: [] } };
  nodes.find((node) => node.type === 'input' && node.props.type === 'file')!.props.onChange(fileEvent);
  assert.deepEqual(changes, ['新昵称', '新签名', '新称号', 'guofeng', '🀄', fileEvent]);
});

test('stats mode and leaderboard sort callbacks retain their exact keys', () => {
  const modes: string[] = [];
  const stats = ProfileStatsTab({ activeStats: calculateCareerStats([]), statsMode: 'online', setStatsMode: (value) => modes.push(value) });
  button(stats, '单机人机演练').props.onClick();
  button(stats, '4人联机实战').props.onClick();
  const board = ProfileLeaderboardTab({ sortedLeaderboard: [], userId: 'me', leaderboardSort: 'score', setLeaderboardSort: (value) => modes.push(value) });
  for (const label of ['净胜积分', '胜率榜', '活跃榜', '大赢家']) button(board, label).props.onClick();
  assert.deepEqual(modes, ['local', 'online', 'score', 'winRate', 'matches', 'maxWin']);
});

test('achievement filter and unlocked reward equipment dispatch the selected values', () => {
  const achievements = evaluateAchievements([], { avatar: 'guofeng_yushi', nickname: '雀友', bio: '签名' });
  const unlocked = achievements.find((item) => item.unlocked)!;
  assert.ok(unlocked);
  const equipped: string[] = [];
  const filters: string[] = [];
  const tree = ProfileAchievementsTab({ achievements, title: '', achievementFilter: 'all', setAchievementFilter: (value) => filters.push(value), onEquipTitle: (value) => equipped.push(value) });
  button(tree, '全部').props.onClick();
  button(tree, '称号').props.onClick();
  assert.deepEqual(filters, ['all']);
  assert.deepEqual(equipped, [unlocked.achievement.rewardTitle]);
});

test('security tab distinguishes guest upgrade from password change and forwards account actions', () => {
  for (const isGuest of [true, false]) {
    const calls: string[] = [];
    const tree = ProfileSecurityTab({ effectiveUser: { isGuest, username: '雀友' } as UserProfile,
      onOpenSecurity: () => calls.push('security'), onOpenAuth: () => calls.push('auth'), onLogout: () => calls.push('logout') });
    button(tree, isGuest ? '一键升级转正' : '修改密码').props.onClick();
    button(tree, '切换账号').props.onClick();
    button(tree, '退出当前登录').props.onClick();
    assert.deepEqual(calls, ['security', 'auth', 'logout']);
  }
});
