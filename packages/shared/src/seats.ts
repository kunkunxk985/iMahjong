import { NICKNAME_MAX, PLAYER_COUNT, ROOM_CODE_CHARS, ROOM_CODE_LENGTH, SEAT_NAMES } from './constants.ts';

export function nextSeat(seat: number): number {
  return (seat + 1) % PLAYER_COUNT;
}

export function prevSeat(seat: number): number {
  return (seat + PLAYER_COUNT - 1) % PLAYER_COUNT;
}

export function oppositeSeat(seat: number): number {
  return (seat + 2) % PLAYER_COUNT;
}

export function seatName(seat: number): string {
  return SEAT_NAMES[seat] ?? `座${seat}`;
}

export function clockwiseDistance(from: number, to: number): number {
  return (to - from + PLAYER_COUNT) % PLAYER_COUNT;
}

export function sanitizeNickname(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NICKNAME_MAX);
}

export function normalizeRoomCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) {
    if (!ROOM_CODE_CHARS.includes(ch)) return false;
  }
  return true;
}

export function generateRoomCode(exists: (code: string) => boolean): string {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)]!;
    }
    if (!exists(code)) return code;
  }
  throw new Error('无法生成房间号');
}

export function relativeSeat(mySeat: number, targetSeat: number): 'self' | 'right' | 'opposite' | 'left' {
  const d = clockwiseDistance(mySeat, targetSeat);
  if (d === 0) return 'self';
  if (d === 1) return 'right';
  if (d === 2) return 'opposite';
  return 'left';
}
