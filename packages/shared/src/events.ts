import type { ClientView, GameAction, Settlement } from './types.ts';

export const C2S = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_START: 'room:start',
  ROOM_AGAIN: 'room:again',
  ROOM_CONFIG: 'room:config',
  GAME_ACTION: 'game:action',
  GAME_NEXT_ROUND: 'game:nextRound',
  PLAYER_RECONNECT: 'player:reconnect',
  PLAYER_UPDATE_PROFILE: 'player:updateProfile',
  PLAYER_HEARTBEAT: 'player:heartbeat',
  FRIEND_BIND_USER: 'friend:bindUser',
  FRIEND_UNBIND_USER: 'friend:unbindUser',
  FRIEND_INVITE: 'friend:invite',
  PING: 'ping',
} as const;

export const S2C = {
  ROOM_CREATED: 'room:created',
  ROOM_JOINED: 'room:joined',
  GAME_STATE: 'game:state',
  GAME_SETTLEMENT: 'game:settlement',
  GAME_ROUND_STARTED: 'game:roundStarted',
  PLAYER_RECONNECTED: 'player:reconnected',
  PLAYER_DISCONNECTED: 'player:disconnected',
  PLAYER_HEARTBEAT: 'player:heartbeat',
  FRIEND_INVITED: 'friend:invited',
  FRIEND_PRESENCE: 'friend:presence',
  PONG: 'pong',
  ERROR: 'error',
} as const;

export type C2SMessage =
  | { type: 'room:create'; nickname: string; avatar?: string; solo?: boolean; pointRate?: number }
  | { type: 'room:join'; roomCode: string; nickname: string; avatar?: string }
  | { type: 'room:leave' }
  | { type: 'room:ready'; ready?: boolean }
  | { type: 'room:start' }
  | { type: 'room:again' }
  | { type: 'room:config'; pointRate: number }
  | { type: 'game:nextRound' }
  | { type: 'game:action'; sequence: number; actionId: string; action: GameAction }
  | { type: 'player:reconnect'; roomCode: string; token: string; nickname?: string; avatar?: string }
  | { type: 'player:updateProfile'; nickname: string; avatar?: string }
  | { type: 'player:heartbeat' }
  | { type: 'friend:bindUser'; userId: string; token: string }
  | { type: 'friend:unbindUser' }
  | { type: 'friend:invite'; toUserId: string; roomCode: string }
  | { type: 'ping' };

export type S2CMessage =
  | { type: 'room:created'; roomCode: string; token: string; seat: number }
  | { type: 'room:joined'; roomCode: string; token: string; seat: number }
  | { type: 'game:state'; view: ClientView }
  | { type: 'game:settlement'; settlement: Settlement; view: ClientView }
  | { type: 'game:roundStarted'; view: ClientView }
  | { type: 'player:reconnected'; roomCode: string; token: string; seat: number }
  | { type: 'player:disconnected'; seat: number; nickname: string }
  | { type: 'player:heartbeat' }
  | { type: 'friend:invited'; fromUserId: string; fromNickname: string; fromAvatar: string; roomCode: string }
  | { type: 'friend:presence'; userId: string; status: 'online' | 'playing' | 'offline'; playingRoomCode?: string }
  | { type: 'pong' }
  | { type: 'error'; message: string; code?: string };

export function newActionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `act-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function isViewMessage(
  message: S2CMessage,
): message is Extract<
  S2CMessage,
  | { type: 'game:state' }
  | { type: 'game:settlement' }
  | { type: 'game:roundStarted' }
> {
  return (
    message.type === 'game:state' ||
    message.type === 'game:settlement' ||
    message.type === 'game:roundStarted'
  );
}
