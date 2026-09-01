import { memo } from 'react';
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

export const BoardPlayer = memo(function BoardPlayer({
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
    <div
      className={`board-player board-player-${position} ${current ? 'is-current' : ''} ${you ? 'is-you' : ''}`}
      aria-current={current ? 'true' : undefined}
    >
      {current ? <span className="board-turn-pill">出牌中</span> : null}
      <div className={`board-avatar avatar-${player.seat}`}>
        <span>{avatar}</span>
        <i>{SEAT_NAMES[player.seat]}</i>
      </div>
      <div className="board-player-copy">
        <strong>{player.nickname}{you ? ' · 你' : ''}</strong>
        <span className="board-player-status">
          <i className={`board-status-dot ${player.online ? 'is-online' : 'is-offline'}`} />
          {player.isDealer ? <b className="board-dealer">庄</b> : null}
          {player.closed ? <b className="board-closed">关</b> : null}
          {player.isBot ? '陪练' : player.isHost ? '房主' : player.online ? '在线' : '离线'}
        </span>
      </div>
      <em aria-label={`积分 ${player.score}`}><small>分</small>{player.score > 0 ? `+${player.score}` : player.score}</em>
    </div>
  );
});

export const ConcealedHand = memo(function ConcealedHand({
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
});

export const DiscardRiver = memo(function DiscardRiver({
  player,
  position,
  lastDiscardId,
  flyingDiscardId,
  highlightKey,
  onTileHover,
}: {
  player: PublicPlayerView;
  position: BoardPosition;
  lastDiscardId?: string;
  flyingDiscardId?: string | null;
  highlightKey?: string | null;
  onTileHover?: (key: string | null) => void;
}) {
  if (player.discards.length === 0) return null;

  return (
    <div className={`board-discard board-discard-${position}`} aria-label={`${SEAT_NAMES[player.seat]}弃牌区`}>
      <div className="board-discard-grid">
        {player.discards.map((tile) => {
          return (
            <div
              key={tile.id}
              className={`board-discard-cell ${tile.id === flyingDiscardId ? 'is-flight-target' : ''}`}
              data-discard-tile-id={tile.id}
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
});
