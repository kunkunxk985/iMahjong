import {
  isPrivatePlayerView,
  SEAT_NAMES,
  type ClientView,
  type PublicPlayerView,
} from '@pizhou/shared';
import { TileView } from '../components/TileView';

export type BoardPosition = 'top' | 'right' | 'bottom' | 'left';
type ViewPlayer = ClientView['players'][number];

export function relativeSeat(seat: number, mySeat: number): number {
  return (seat - mySeat + 4) % 4;
}

export function BoardPlayer({
  player,
  position,
  you,
  current,
}: {
  player: ViewPlayer;
  position: BoardPosition;
  you?: boolean;
  current: boolean;
}) {
  const avatar = player.isBot ? '陪' : player.nickname.slice(0, 1);
  return (
    <div className={`board-player board-player-${position} ${current ? 'is-current' : ''} ${you ? 'is-you' : ''}`}>
      <div className={`board-avatar avatar-${player.seat}`}>
        <span>{avatar}</span>
        <i>{SEAT_NAMES[player.seat]}</i>
      </div>
      <div className="board-player-copy">
        <strong>{player.nickname}{you ? ' · 你' : ''}</strong>
        <span>
          {player.isDealer ? <b className="board-dealer">庄</b> : null}
          {player.closed ? <b className="board-closed">关</b> : null}
          {player.isBot ? '陪练' : player.isHost ? '房主' : player.online ? '在线' : '离线'}
        </span>
      </div>
      <em>{player.score}</em>
    </div>
  );
}

export function ConcealedHand({
  player,
  position,
  reveal = false,
}: {
  player: ViewPlayer;
  position: BoardPosition;
  reveal?: boolean;
}) {
  const count = Math.min(player.handCount, 14);
  if (count === 0) return null;
  const revealed = reveal && isPrivatePlayerView(player);

  return (
    <div
      className={`board-concealed board-concealed-${position} ${revealed ? 'is-revealed' : ''}`}
      aria-label={`${SEAT_NAMES[player.seat]}${revealed ? '手牌' : '手牌背面'}`}
    >
      {revealed
        ? player.hand.map((tile) => (
            <TileView key={tile.id} tile={tile} small pose="rack" className="board-concealed-tile" />
          ))
        : Array.from({ length: count }, (_, index) => (
            <TileView key={`${player.seat}-hand-${index}`} back small pose="rack" className="board-concealed-tile" />
          ))}
    </div>
  );
}

export function DiscardRiver({
  player,
  position,
  lastDiscardId,
  highlightKey,
  onTileHover,
}: {
  player: PublicPlayerView;
  position: BoardPosition;
  lastDiscardId?: string;
  highlightKey?: string | null;
  onTileHover?: (key: string | null) => void;
}) {
  if (player.discards.length === 0) return null;

  return (
    <div className={`board-discard board-discard-${position}`} aria-label={`${SEAT_NAMES[player.seat]}弃牌区`}>
      <div className="board-discard-grid">
        {player.discards.map((tile, idx) => {
          // Deterministic natural physical tile scatter angle (-1.8deg ~ +1.8deg)
          const charCode = tile.id.charCodeAt(tile.id.length - 1) || idx;
          const rot = ((charCode % 7) - 3) * 0.6;

          return (
            <div
              key={tile.id}
              className="board-discard-cell"
              style={{ transform: `rotate(${rot}deg)` }}
            >
              <TileView
                tile={tile}
                small
                pose="lie"
                last={tile.id === lastDiscardId}
                highlightSame={Boolean(highlightKey && tile.key === highlightKey)}
                onHover={(hovered) => onTileHover?.(hovered ? tile.key : null)}
                className="board-discard-tile"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
