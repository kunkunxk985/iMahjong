import type { ClientView, GameAction, Settlement } from './types.ts';

export const C2S = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_READY: 'room:ready',
  ROOM_START: 'room:start',
  ROOM_AGAIN: 'room:again',
  GAME_ACTION: 'game:action',
  GAME_NEXT_ROUND: 'game:nextRound',
  PLAYER_RECONNECT: 'player:reconnect',
  PLAYER_HEARTBEAT: 'player:heartbeat',
  PING: 'ping',
} as const;

export const S2C = {
  ROOM_CREATED: 'room:created',
  ROOM_JOINED: 'room:joined',
  ROOM_STATE: 'room:state',
  GAME_STATE: 'game:state',
  GAME_ACTION_REQUIRED: 'game:actionRequired',
  GAME_SETTLEMENT: 'game:settlement',
  GAME_ROUND_STARTED: 'game:roundStarted',
  PLAYER_RECONNECTED: 'player:reconnected',
  PLAYER_DISCONNECTED: 'player:disconnected',
  PLAYER_HEARTBEAT: 'player:heartbeat',
  PONG: 'pong',
  ERROR: 'error',
} as const;

export type C2SMessage =
  | { type: 'room:create'; nickname: string; solo?: boolean }
  | { type: 'room:join'; roomCode: string; nickname: string }
  | { type: 'room:leave' }
  | { type: 'room:ready'; ready?: boolean }
  | { type: 'room:start' }
  | { type: 'room:again' }
  | { type: 'game:nextRound' }
  | { type: 'game:action'; sequence: number; actionId: string; action: GameAction }
  | { type: 'player:reconnect'; roomCode: string; token: string }
  | { type: 'player:heartbeat' }
  | { type: 'ping' };

export type S2CMessage =
  | { type: 'room:created'; roomCode: string; token: string; seat: number }
  | { type: 'room:joined'; roomCode: string; token: string; seat: number }
  | { type: 'room:state'; view: ClientView }
  | { type: 'game:state'; view: ClientView }
  | { type: 'game:actionRequired'; view: ClientView }
  | { type: 'game:settlement'; settlement: Settlement; view: ClientView }
  | { type: 'game:roundStarted'; view: ClientView }
  | { type: 'player:reconnected'; roomCode: string; token: string; seat: number }
  | { type: 'player:disconnected'; seat: number; nickname: string }
  | { type: 'player:heartbeat' }
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
  | { type: 'room:state' }
  | { type: 'game:state' }
  | { type: 'game:actionRequired' }
  | { type: 'game:settlement' }
  | { type: 'game:roundStarted' }
> {
  return (
    message.type === 'room:state' ||
    message.type === 'game:state' ||
    message.type === 'game:actionRequired' ||
    message.type === 'game:settlement' ||
    message.type === 'game:roundStarted'
  );
}
