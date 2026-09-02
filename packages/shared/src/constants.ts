export const PROTOCOL_VERSION = 1;

export const SERVER_PORT = 8787;
export const DEFAULT_WS_URL = 'wss://pizhou-mahjong-server.kunkunxk985.workers.dev';

export const PLAYER_COUNT = 4;
export const ROOM_CODE_LENGTH = 6;
export const HAND_SIZE = 13;
export const TILE_COPIES = 4;
export const DECK_SIZE = 120;

export const ACTION_TIMEOUT_MS = 30_000;
export const HEARTBEAT_INTERVAL_MS = 10_000;
export const HEARTBEAT_TIMEOUT_MS = 35_000;
export const RECONNECT_WINDOW_MS = 30 * 60 * 1000;
export const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;
export const CHAT_MESSAGE_MAX = 48;

export const NICKNAME_MAX = 12;
export const BASE_HU = 10;
export const HU_RATE = 1;
export const YAO_RATE = 10;
export const HUN_DI = 30;

export const SEAT_NAMES = ['东', '南', '西', '北'] as const;

export const ROOM_CODE_CHARS = '0123456789';
