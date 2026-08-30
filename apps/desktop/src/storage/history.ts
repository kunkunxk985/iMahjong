export interface MatchPlayerScore {
  seat: number;
  nickname: string;
  score: number;
  isWinner: boolean;
  isDealer: boolean;
  notes?: string[];
}

export interface MatchRecord {
  id: string;
  timestamp: number;
  dateStr: string;
  roomCode: string;
  winType: string;
  winnerNickname?: string;
  winnerSeat: number | null;
  hu: number;
  yao: number;
  dealerMultiplier: number;
  hunDi: boolean;
  liuju: boolean;
  drawReason?: string;
  baoZhuang: { reason: string; payerSeat: number; winnerSeat: number } | null;
  scores: MatchPlayerScore[];
}

const HISTORY_STORAGE_KEY = 'pizhou_match_history_v1';

export function getMatchHistory(): MatchRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function saveMatchToHistory(record: MatchRecord): void {
  try {
    const current = getMatchHistory();
    // Keep up to 30 most recent matches
    const updated = [record, ...current.filter((r) => r.id !== record.id)].slice(0, 30);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
  } catch {}
}

export function clearMatchHistory(): void {
  try {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  } catch {}
}
